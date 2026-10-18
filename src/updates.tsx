import version from "./version.json";
import { useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Card } from "./components";
import { Download, RefreshCw } from "lucide-react";
type Release = {
  installed: string;
  version: string;
  available: boolean;
  url: string;
};
const bridge = registerPlugin<{
  check: () => Promise<Release>;
  open: (o: { url: string }) => Promise<void>;
}>("UpdateBridge");
export function UpdatePanel() {
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState<Release | null>(null),
    [error, setError] = useState("");
  const native = Capacitor.isNativePlatform();
  return (
    <Card title="تحديث رفيق">
      <p className="small muted">
        إصدار الواجهة {version.name} • الهاتف والساعة لهما ملف تثبيت منفصل.
        تحديث الموقع وحده ما يحدّث التطبيقات المثبّتة.
      </p>
      {native ? (
        <>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              setResult(null);
              try {
                setResult(await bridge.check());
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshCw size={16} />
            {busy ? "نفحص التحديث…" : "فحص تحديث التطبيق"}
          </button>
          {result && (
            <p role="status">
              {result.available
                ? `متوفر إصدار ${result.version}`
                : `عندك أحدث إصدار منشور (${result.installed})`}
            </p>
          )}
          {result?.available && (
            <button
              className="primary"
              onClick={async () => {
                try {
                  await bridge.open({ url: result.url });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Download size={16} />
              تنزيل تحديث الهاتف
            </button>
          )}
          <p className="caption">
            بعد التنزيل افتح APK ووافق على التحديث. احتفظ بالتطبيق الحالي حتى
            تبقى بياناتك. تحديث الساعة يُثبّت عبر ADB اللاسلكي.
          </p>
        </>
      ) : (
        <p className="small muted">
          نسخة المتصفح تتحدث عند إعادة تحميل الصفحة. ملفات الهاتف والساعة متوفرة
          بصفحة الإصدارات.
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <a
        className="text-button"
        href="https://github.com/spardexlab-maker/friend/releases/latest"
        target="_blank"
        rel="noreferrer"
      >
        تنزيل الهاتف والساعة وتعليمات التثبيت
      </a>
    </Card>
  );
}
