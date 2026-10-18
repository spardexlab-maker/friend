import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";
import { Mic, Pause, Play, Square, Download } from "lucide-react";
import { Dialog } from "./components";
import { useApp } from "./app-state";
import { api } from "./ai";
export function VoiceCapture({
  onText,
  onClose,
}: {
  onText: (text: string) => void;
  onClose: () => void;
}) {
  const { s } = useApp(),
    recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    chunks = useRef<Blob[]>([]),
    bytes = useRef(0),
    mounted = useRef(true);
  const [state, setState] = useState<"idle" | "recording" | "paused" | "ready">(
      "idle",
    ),
    [seconds, setSeconds] = useState(0),
    [file, setFile] = useState<Blob | null>(null),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [consent, setConsent] = useState(false);
  useEffect(
    () => () => {
      mounted.current = false;
      if (recorder.current && recorder.current.state !== "inactive")
        recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(
      () =>
        setSeconds((n) => {
          if (n >= 299) {
            recorder.current?.stop();
            return 300;
          }
          return n + 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [state]);
  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw Error(
          "التسجيل غير مدعوم هنا؛ استعمل نسخة أندرويد أو Chrome محدث",
        );
      if (Capacitor.isNativePlatform()) {
        const p = await SpeechRecognition.requestPermissions();
        if (p.speechRecognition !== "granted")
          throw Error("امنح صلاحية المايكروفون للتسجيل");
      }
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (t) => MediaRecorder.isTypeSupported(t),
      );
      const r = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined,
      );
      recorder.current = r;
      chunks.current = [];
      bytes.current = 0;
      setFile(null);
      setText("");
      setSeconds(0);
      r.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.current.push(e.data);
          bytes.current += e.data.size;
          if (bytes.current > 6000000 && r.state !== "inactive") r.stop();
        }
      };
      r.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        if (mounted.current) {
          setFile(
            new Blob(chunks.current, { type: r.mimeType || "audio/webm" }),
          );
          setState("ready");
        }
      };
      r.onerror = () => {
        if (mounted.current)
          setError("صار خلل بالتسجيل. راجع الصوت المحفوظ قبل التفريغ.");
        if (r.state !== "inactive") r.stop();
        stream.current?.getTracks().forEach((t) => t.stop());
      };
      r.start(1000);
      setState("recording");
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function transcribe() {
    if (!file || !consent) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 6500000)
        throw Error("التسجيل كبير؛ حد التسجيل خمس دقائق");
      const audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await api(s, "transcribe", {
        method: "POST",
        body: JSON.stringify({ audio, model: s.settings.model || undefined }),
      });
      if (typeof result.text !== "string" || !result.text.trim())
        throw Error("ما طلع كلام واضح. اسمع الملف وجرّب مرة ثانية");
      setText(result.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="سجّل براحتك"
      onClose={() => {
        if (state === "recording" || state === "paused" || busy) {
          setError("أوقف التسجيل وانتظر اكتمال التفريغ قبل الإغلاق");
          return;
        }
        onClose();
      }}
    >
      <div className="voice-capture">
        <div className={`voice-orb ${state === "recording" ? "active" : ""}`}>
          <Mic size={35} />
        </div>
        <strong className="voice-time">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </strong>
        <p>
          {state === "recording"
            ? "نسجّل الصوت؛ السكوت ما ينهي التسجيل"
            : state === "paused"
              ? "التسجيل متوقف مؤقتاً"
              : state === "ready"
                ? "تسجيلك جاهز للمراجعة"
                : "اضغط ابدأ، واحچي على راحتك"}
        </p>
        <div className="button-row">
          {state === "idle" || state === "ready" ? (
            <button className="primary" onClick={start} disabled={busy}>
              <Mic size={17} />
              {file ? "تسجيل جديد" : "ابدأ التسجيل"}
            </button>
          ) : (
            <>
              <button
                className="secondary"
                onClick={() => {
                  const r = recorder.current;
                  if (state === "recording") {
                    r?.pause();
                    setState("paused");
                  } else {
                    r?.resume();
                    setState("recording");
                  }
                }}
              >
                {state === "recording" ? (
                  <Pause size={17} />
                ) : (
                  <Play size={17} />
                )}{" "}
                {state === "recording" ? "توقف مؤقت" : "كمل التسجيل"}
              </button>
              <button
                className="primary"
                onClick={() => recorder.current?.stop()}
              >
                <Square size={16} />
                إنهاء التسجيل
              </button>
            </>
          )}
        </div>
        {url && (
          <>
            <audio controls src={url} />
            <a
              href={url}
              download={`Rafiq-voice.${file?.type.includes("mp4") ? "m4a" : "webm"}`}
              className="text-button"
              onClick={async (e) => {
                if (!Capacitor.isNativePlatform() || !file) return;
                e.preventDefault();
                try {
                  const data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () =>
                      resolve(String(reader.result).split(",")[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                  const saved = await Filesystem.writeFile({
                    path: `voice-${Date.now()}.${file.type.includes("mp4") ? "m4a" : "webm"}`,
                    data,
                    directory: Directory.Cache,
                  });
                  await Share.share({ title: "تسجيل رفيق", url: saved.uri });
                } catch {
                  setError("تعذر حفظ التسجيل؛ جرّب المشاركة مرة ثانية");
                }
              }}
            >
              <Download size={14} />
              حفظ نسخة من التسجيل
            </a>
            <label className="habit-check">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              أوافق على إرسال هذا الصوت إلى Google Gemini عبر خادم رفيق لتفريغه
            </label>
            <button
              className="secondary"
              disabled={!consent || busy}
              onClick={transcribe}
            >
              {busy ? "نفرّغ الصوت…" : "تفريغ التسجيل إلى نص"}
            </button>
          </>
        )}
        {text && (
          <label>
            راجع وعدّل الكلام قبل إضافته
            <textarea
              value={text}
              maxLength={20000}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              className="primary"
              onClick={() => {
                onText(text);
                onClose();
              }}
            >
              إضافة النص للمحادثة
            </button>
          </label>
        )}
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <p className="caption">
          حد التسجيل خمس دقائق. بعد التفريغ راجع النص؛ التسجيل ما ينرسل للمحادثة
          ولا يسجّل أكلك تلقائياً. الملف يبقى مؤقتاً هنا إلى أن تغلق النافذة،
          وتكدر تحفظ نسخة منه.
        </p>
      </div>
    </Dialog>
  );
}
