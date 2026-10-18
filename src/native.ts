import { summarizeSleep } from "./sleep-data";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Health, type HealthDataType } from "@capgo/capacitor-health";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { State } from "./domain";
export const healthTypes: HealthDataType[] = [
  "steps",
  "distance",
  "calories",
  "totalCalories",
  "heartRate",
  "restingHeartRate",
  "heartRateVariability",
  "respiratoryRate",
  "sleep",
  "oxygenSaturation",
  "weight",
  "bodyFat",
  "vo2Max",
  "bloodPressure",
  "bodyTemperature",
  "workouts",
];
export async function syncHealth(
  date: string,
  request = false,
): Promise<State["health"]> {
  if (!Capacitor.isNativePlatform())
    throw Error("الربط الصحي يعمل من نسخة أندرويد المثبتة، وليس المتصفح.");
  const available = await Health.isAvailable();
  if (!available.available)
    throw Error("Health Connect غير متوفر. فعّله من إعدادات موبايلك.");
  const auth = request
    ? await Health.requestAuthorization({ read: healthTypes })
    : await Health.checkAuthorization({ read: healthTypes });
  if (!auth.readAuthorized.length)
    throw Error(
      "لم تُمنح صلاحيات القراءة. تقدر تمنح بعضها من إعدادات Health Connect.",
    );
  const startDate = new Date(`${date}T00:00:00+03:00`).toISOString(),
    endDate = new Date(
      Math.min(Date.parse(startDate) + 86400000, Date.now()),
    ).toISOString();
  const result: State["health"] = {
    date,
    syncedAt: new Date().toISOString(),
    values: {},
    samples: [],
    errors: [],
  };
  await Promise.all(
    healthTypes.map(async (dataType) => {
      if (!auth.readAuthorized.includes(dataType)) {
        result.errors.push(`${dataType}: لا توجد صلاحية`);
        return;
      }
      try {
        if (dataType === "totalCalories") {
          const extra = registerPlugin<{
            read: (o: {
              start: string;
              end: string;
            }) => Promise<{ value: number | null }>;
          }>("HealthTotals");
          result.values.totalCalories = (
            await extra.read({ start: startDate, end: endDate })
          ).value;
        } else if (dataType === "heartRate") {
          const { samples } = await Health.readSamples({
            dataType,
            startDate,
            endDate,
            limit: 500,
          });
          result.samples.push(...samples);
          result.values.heartRate = samples.length
            ? samples.reduce((sum, x) => sum + x.value, 0) / samples.length
            : null;
        } else if (
          [
            "steps",
            "distance",
            "calories",
            "heartRate",
            "restingHeartRate",
          ].includes(dataType)
        ) {
          const { samples } = await Health.queryAggregated({
            dataType,
            startDate,
            endDate,
            bucket: "day",
            aggregation: [
              "heartRate",
              "restingHeartRate",
              "oxygenSaturation",
            ].includes(dataType)
              ? "average"
              : "sum",
          });
          result.values[dataType] = samples.length
            ? dataType === "restingHeartRate"
              ? samples.reduce((s, x) => s + x.value, 0) / samples.length
              : samples.reduce((s, x) => s + x.value, 0)
            : null;
        } else if (dataType === "workouts") {
          const { workouts } = await Health.queryWorkouts({
            startDate,
            endDate,
            limit: 100,
          });
          result.samples.push(
            ...workouts.map((x) => ({ ...x, dataType: "workouts" })),
          );
        } else {
          const { samples } = await Health.readSamples({
            dataType,
            startDate:
              dataType === "sleep"
                ? new Date(Date.parse(startDate) - 43200000).toISOString()
                : startDate,
            endDate,
            limit: 100,
          });
          if (dataType !== "sleep") result.samples.push(...samples);
          if (dataType === "sleep") {
            const summarized = summarizeSleep(samples, date);
            result.samples.push(...summarized.samples);
            result.values.sleep = summarized.minutes;
            result.values.sleepHasStages = summarized.hasStages ? 1 : 0;
          } else if (dataType === "bloodPressure") {
            const last = [...samples].sort((a, b) =>
              b.endDate.localeCompare(a.endDate),
            )[0];
            result.values.systolic = last?.systolic ?? null;
            result.values.diastolic = last?.diastolic ?? null;
          } else
            result.values[dataType] =
              [...samples].sort((a, b) => b.endDate.localeCompare(a.endDate))[0]
                ?.value ?? null;
        }
      } catch {
        result.errors.push(`${dataType}: تعذرت القراءة`);
      }
    }),
  );
  return result;
}
export async function dictate(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const { speechRecognition } = await SpeechRecognition.requestPermissions();
    if (speechRecognition !== "granted")
      throw Error("صلاحية المايكروفون غير ممنوحة");
    const result = await SpeechRecognition.start({
      language: "ar-IQ",
      popup: true,
      maxResults: 1,
      prompt: "احچي تفاصيلك لرفيق",
    });
    return result.matches?.[0] ?? "";
  }
  const ctor =
    (
      window as unknown as {
        SpeechRecognition?: new () => Recognition;
        webkitSpeechRecognition?: new () => Recognition;
      }
    ).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => Recognition })
      .webkitSpeechRecognition;
  if (!ctor)
    throw Error("التفريغ الصوتي غير مدعوم بهذا المتصفح. استخدم نسخة أندرويد.");
  return new Promise((resolve, reject) => {
    const r = new ctor();
    r.lang = "ar-IQ";
    r.interimResults = false;
    r.onresult = (e) => resolve(e.results[0][0].transcript);
    r.onerror = () =>
      reject(Error("تعذر سماع الصوت؛ تأكد من الصلاحية والاتصال"));
    r.onend = () => resolve("");
    r.start();
  });
}
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: (e: {
    results: { [n: number]: { [n: number]: { transcript: string } } };
  }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
};
export async function download(name: string, text: string) {
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: "نسخة رفيق الاحتياطية", url: file.uri });
  } else {
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export async function imageData(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("اختار صورة JPG أو PNG أو WebP");
  if (file.size > 20 * 1024 * 1024) throw Error("الصورة أكبر من 20 ميغابايت");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
