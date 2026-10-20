import { useEffect, useState } from "react";
import { Heart, RefreshCw } from "lucide-react";
import { useApp } from "./app-state";
import { dailyHealth, shiftDay } from "./insights";
import { syncHealth } from "./native";
export function SensorCoverage() {
  const { s, date, change, notify } = useApp(),
    [tick, setTick] = useState(Date.now()),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const last = s.sensorReadings
      .filter((x) => x.date === date)
      .sort((a, b) => b.time.localeCompare(a.time))[0],
    age = last ? Math.max(0, (tick - Date.parse(last.time)) / 1000) : Infinity,
    h = dailyHealth(s, date);
  async function backfill() {
    setBusy(true);
    setProgress(0);
    try {
      // Ask once, then import each historical day. Persist each completed day so interruptions are recoverable.
      await syncHealth(date, true);
      for (let i = 13; i >= 0; i--) {
        const health = await syncHealth(shiftDay(date, -i));
        const ok = await change("استيراد سجل صحي سابق", (d) => ({
          ...d,
          health: health.date === date ? health : d.health,
          healthHistory: [
            ...d.healthHistory.filter((x) => x.date !== health.date),
            health,
          ].sort((a, b) => a.date.localeCompare(b.date)),
        }));
        if (!ok) throw Error("تعذر حفظ السجل المستورد");
        setProgress(14 - i);
      }
      notify("اكتمل استيراد الأيام المتاحة؛ راجع تغطية البيانات");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="sensor-live">
        <Heart size={25} color="#fb8e85" />
        <b>
          {last ? Math.round(last.bpm) : "—"}
          <small>bpm</small>
        </b>
        <div>
          <h3>
            {age <= 30
              ? "نبض حديث من الساعة"
              : last
                ? "آخر نبض محفوظ"
                : "بانتظار أول قراءة نبض"}
          </h3>
          <p>
            {last
              ? `من ${Math.floor(age / 60)} دقيقة · حساس Galaxy Watch`
              : "بالساعة افتح «نبض» واضغط بدء القياس. افتح رفيق بالموبايل للمزامنة."}
            {age > 30 && last ? " · مو بث مباشر حالياً" : ""}
          </p>
        </div>
      </div>
      <div className="sensor-coverage">
        {[
          ["sleep", "النوم والمراحل"],
          ["heartRateVariability", "HRV"],
          ["restingHeartRate", "نبض الراحة"],
          ["respiratoryRate", "التنفس"],
          ["oxygenSaturation", "الأكسجين"],
          ["steps", "الخطوات"],
        ].map(([key, label]) => (
          <div key={key}>
            <b>{label}</b>
            <small className={h?.values[key] != null ? "available" : ""}>
              {h?.metadata?.[key]?.status === "denied"
                ? "صلاحية القراءة غير ممنوحة"
                : h?.metadata?.[key]?.status === "error"
                  ? "تعذرت القراءة؛ أعد المزامنة"
                  : h?.values[key] != null
                    ? "بيانات متاحة"
                    : "غير متاح / بانتظار المزامنة"}
            </small>
            {h?.metadata?.[key]?.source && (
              <small>{h.metadata[key].source}</small>
            )}
            {h?.metadata?.[key]?.time && (
              <small>
                القياس:{" "}
                {new Date(h.metadata[key].time!).toLocaleString("ar-IQ", {
                  timeZone: "Asia/Baghdad",
                })}
              </small>
            )}
            {h?.metadata?.[key]?.method && (
              <small>
                {h.metadata[key].method}{" "}
                {h.metadata[key].count != null
                  ? `· ${h.metadata[key].count} عينة`
                  : ""}
              </small>
            )}
          </div>
        ))}
      </div>
      <div className="health-import">
        <button className="secondary" onClick={backfill} disabled={busy}>
          <RefreshCw size={15} />
          {busy
            ? `نستورد ${progress} / 14 يوم`
            : "استيراد آخر 14 يوم من Health Connect"}
        </button>
        <span className="backfill-note">
          يحتاج نسخة أندرويد والصلاحيات. الأيام الخالية تبقى خالية.
        </span>
      </div>
    </>
  );
}
