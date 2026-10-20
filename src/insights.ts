import type { State } from "./domain";
import { sourceSamples } from "./health-quality";
import type { HealthSample } from "@capgo/capacitor-health";
export const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(n, b));
export const mean = (a: number[]) =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
export function shiftDay(date: string, n: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function dailyHealth(s: State, date: string) {
  return [s.health, ...s.healthHistory]
    .filter((h) => h.date === date)
    .sort((a, b) => b.syncedAt.localeCompare(a.syncedAt))[0];
}
export function sleepMinutes(s: State, date: string) {
  const h = dailyHealth(s, date);
  if (h?.values.sleep != null && h.values.sleep > 0)
    return { minutes: h.values.sleep, source: "Health Connect" };
  const manual = s.sleep
    .filter((x) => x.date === date)
    .map((x) => ({ start: Date.parse(x.start), end: Date.parse(x.end) }))
    .filter((x) => Number.isFinite(x.start) && x.end > x.start)
    .sort((a, b) => a.start - b.start);
  let total = 0,
    end = -Infinity;
  for (const p of manual) {
    total += Math.max(0, p.end - Math.max(p.start, end));
    end = Math.max(end, p.end);
  }
  return {
    minutes: total ? total / 60000 : null,
    source: total ? "تسجيلك اليدوي" : "لا توجد بيانات",
  };
}
export function recovery(s: State, date: string) {
  const h = dailyHealth(s, date),
    sleep = sleepMinutes(s, date),
    check = s.checkins.filter((c) => c.date === date).at(-1);
  const previous = Array.from({ length: 14 }, (_, i) =>
    dailyHealth(s, shiftDay(date, -i - 1)),
  ).filter(Boolean);
  const hrvs = previous
    .filter((x) => x!.values.hrvDailyMedian === h?.values.hrvDailyMedian)
    .map((x) => x!.values.heartRateVariability)
    .filter((n): n is number => n != null && n > 0);
  const rhrs = previous
    .filter((x) => x!.values.rhrDailyMedian === h?.values.rhrDailyMedian)
    .map((x) => x!.values.restingHeartRate)
    .filter((n): n is number => n != null && n > 0);
  const hrvBase = mean(hrvs),
    rhrBase = mean(rhrs),
    hrv = h?.values.heartRateVariability,
    rhr = h?.values.restingHeartRate;
  const parts: {
    label: string;
    score: number;
    weight: number;
    detail: string;
  }[] = [];
  if (sleep.minutes != null)
    parts.push({
      label: "مدة النوم",
      score: clamp((sleep.minutes / (s.wellness.sleepGoal * 60)) * 100),
      weight: 40,
      detail: `${(sleep.minutes / 60).toFixed(1)} / ${s.wellness.sleepGoal} ساعة`,
    });
  if (hrv != null && hrv > 0 && hrvBase && hrvs.length >= 3)
    parts.push({
      label: "HRV مقابل خطك الأساسي",
      score: clamp(70 + 100 * (hrv / hrvBase - 1)),
      weight: 30,
      detail: `${Math.round(hrv)} / ${Math.round(hrvBase)} ms`,
    });
  if (rhr != null && rhr > 0 && rhrBase && rhrs.length >= 3)
    parts.push({
      label: "نبض الراحة مقابل خطك الأساسي",
      score: clamp(75 - 4 * (rhr - rhrBase)),
      weight: 20,
      detail: `${Math.round(rhr)} / ${Math.round(rhrBase)} bpm`,
    });
  if (check)
    parts.push({
      label: "شعورك اليوم",
      score: clamp(
        ((check.energy * 2 + 6 - check.soreness + 6 - check.stress) / 20) * 100,
      ),
      weight: 10,
      detail: `طاقة ${check.energy}/5 • إجهاد ${check.stress}/5`,
    });
  const physiological = parts.some((p) => p.weight === 30 || p.weight === 20),
    enough = parts.length >= 2 && physiological;
  const score = enough
    ? Math.round(
        parts.reduce((sum, p) => sum + p.score * p.weight, 0) /
          parts.reduce((sum, p) => sum + p.weight, 0),
      )
    : null;
  return {
    score,
    parts,
    sleep,
    hrvBase,
    rhrBase,
    baselineDays: Math.max(hrvs.length, rhrs.length),
    label:
      score == null
        ? "نبني خطك الأساسي"
        : score >= 75
          ? "جاهزية أعلى"
          : score >= 50
            ? "وازن مجهودك"
            : "خذ يومك بهدوء",
  };
}
export function sleepCoach(s: State, date: string) {
  const days = Array.from({ length: 7 }, (_, i) =>
    sleepMinutes(s, shiftDay(date, -i)),
  );
  const recorded = days.filter((x) => x.minutes != null),
    debt = recorded.reduce(
      (sum, x) => sum + Math.max(0, s.wellness.sleepGoal * 60 - x.minutes!),
      0,
    );
  const target = Math.round(s.wellness.sleepGoal * 60 + Math.min(60, debt / 7));
  const [h, m] = s.wellness.wakeTime.split(":").map(Number),
    bed = (h * 60 + m - target - 20 + 1440 * 2) % 1440;
  return {
    debt,
    days: recorded.length,
    target,
    bedtime: `${Math.floor(bed / 60)
      .toString()
      .padStart(2, "0")}:${(bed % 60).toString().padStart(2, "0")}`,
  };
}
export function habitInsights(s: State, date: string) {
  return (["caffeineLate", "lateMeal"] as const).map((key) => {
    const pairs = s.checkins
      .filter((x) => x.date < date && x.date >= shiftDay(date, -90))
      .map((c) => ({
        flag: c[key],
        minutes: sleepMinutes(s, shiftDay(c.date, 1)).minutes,
      }))
      .filter(
        (x): x is { flag: boolean; minutes: number } => x.minutes != null,
      );
    const yes = pairs.filter((x) => x.flag).map((x) => x.minutes),
      no = pairs.filter((x) => !x.flag).map((x) => x.minutes);
    return {
      key,
      label: key === "caffeineLate" ? "الكافيين المتأخر" : "الوجبة المتأخرة",
      yes: yes.length,
      no: no.length,
      diff:
        yes.length >= 3 && no.length >= 3
          ? Math.round(mean(yes)! - mean(no)!)
          : null,
    };
  });
}
export function heartSeries(s: State, date: string) {
  const raw = (dailyHealth(s, date)?.samples ?? []) as {
    dataType?: string;
    startDate?: string;
    value?: number;
  }[];
  const imported = sourceSamples(
    raw.filter((x) => x.dataType === "heartRate") as HealthSample[],
  );
  const occupied = new Set(
    imported.map((x) => Math.floor(Date.parse(x.startDate) / 60000)),
  );
  const items = [
    ...imported
      .filter(
        (x) =>
          x.dataType === "heartRate" && x.startDate && Number.isFinite(x.value),
      )
      .map((x) => ({ time: x.startDate!, bpm: x.value! })),
    ...s.sensorReadings.filter(
      (x) =>
        x.date === date &&
        !occupied.has(Math.floor(Date.parse(x.time) / 60000)),
    ),
  ];
  return [...new Map(items.map((x) => [Date.parse(x.time), x])).values()]
    .filter((x) => x.bpm >= 25 && x.bpm <= 240)
    .sort((a, b) => a.time.localeCompare(b.time));
}
export function zoneMinutes(s: State, date: string) {
  const series = heartSeries(s, date),
    max = 208 - 0.7 * s.profile.age,
    zones = [0, 0, 0, 0, 0];
  let sampled = 0;
  for (let i = 1; i < series.length; i++) {
    const gap =
      (Date.parse(series[i].time) - Date.parse(series[i - 1].time)) / 60000;
    if (gap <= 0 || gap > 2) continue;
    const ratio = series[i - 1].bpm / max;
    const index =
      ratio < 0.6 ? 0 : ratio < 0.7 ? 1 : ratio < 0.8 ? 2 : ratio < 0.9 ? 3 : 4;
    zones[index] += gap;
    sampled += gap;
  }
  return {
    zones,
    sampled,
    max: Math.round(max),
    effort:
      sampled >= 10
        ? Math.round(zones.reduce((sum, m, i) => sum + m * (i + 1), 0))
        : null,
  };
}
