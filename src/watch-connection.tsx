import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { bridge } from "./wear";
import { useApp } from "./app-state";
import { Watch, RefreshCw } from "lucide-react";
export function WatchConnection() {
  const { s, setTab } = useApp();
  const [status, setStatus] = useState<
    "checking" | "connected" | "offline" | "error"
  >("checking");
  const native = Capacitor.isNativePlatform();
  async function check() {
    setStatus("checking");
    try {
      setStatus((await bridge.status()).connected ? "connected" : "offline");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => {
    if (!native) return;
    void check();
    const id = setInterval(() => {
      if (document.visibilityState !== "hidden") void check();
    }, 30000);
    return () => clearInterval(id);
  }, [native]);
  return (
    <section className="watch-connection card" aria-label="حالة ربط الساعة">
      <div className="button-row">
        <Watch size={22} />
        <b>
          {!native
            ? "ربط ساعتك من تطبيق الهاتف"
            : status === "checking"
              ? "نفحص اتصال الساعة…"
              : status === "connected"
                ? "الساعة متصلة بالهاتف"
                : status === "offline"
                  ? "الساعة غير متصلة حالياً"
                  : "تعذر فحص اتصال الساعة"}
        </b>
        {native && (
          <button
            className="icon-button"
            aria-label="فحص اتصال الساعة"
            onClick={check}
            disabled={status === "checking"}
          >
            <RefreshCw size={18} />
          </button>
        )}
      </div>
      <p className="caption">
        {!native
          ? "استخدم نسخة أندرويد لقراءة بيانات Health Connect ومزامنة الساعة."
          : "الاتصال وحده لا يعني وصول كل البيانات. راجع وقت القياس والصلاحية لكل نوع أدناه."}
      </p>
      <ol className="connection-steps">
        <li>
          اربط الساعة بالموبايل عبر Galaxy Wearable، وثبّت رفيق على الجهازين.
        </li>
        <li>
          فعّل مشاركة البيانات المطلوبة من Samsung Health إلى Health Connect.
        </li>
        <li>امنح رفيق صلاحيات القراءة، ثم افحص القيم ووقت آخر قياس.</li>
      </ol>
      <div className="button-row">
        <button className="text-button" onClick={() => setTab("settings")}>
          تحديث التطبيق وإعداداته
        </button>
        <span className="caption">
          آخر استيراد:{" "}
          {s.health.syncedAt
            ? new Date(s.health.syncedAt).toLocaleString("ar-IQ", {
                timeZone: "Asia/Baghdad",
              })
            : "لم تبدأ المزامنة بعد"}
        </span>
      </div>
    </section>
  );
}
