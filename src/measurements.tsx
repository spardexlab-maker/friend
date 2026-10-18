import { useState } from "react";
import { HeartPulse, Plus, Trash2 } from "lucide-react";
import { useApp } from "./app-state";
import { Card } from "./components";
import { dailyHealth } from "./insights";
import { stamp } from "./domain";
export function Measurements() {
  const { s, date, change, notify, confirm } = useApp(),
    [expanded, setExpanded] = useState(false),
    [busy, setBusy] = useState(false),
    h = dailyHealth(s, date);
  const imported = (h?.samples ?? []) as {
    dataType?: string;
    systolic?: number;
    diastolic?: number;
    endDate?: string;
    sourceName?: string;
  }[];
  const pressure = imported
    .filter(
      (x) =>
        x.dataType === "bloodPressure" &&
        x.systolic != null &&
        x.diastolic != null,
    )
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""));
  const manual = s.journal.filter(
    (x) => x.date === date && x.category === "قياس ضغط",
  );
  return (
    <Card
      className="measurements"
      title={
        <>
          <HeartPulse size={18} />
          الضغط والقياسات الإضافية
        </>
      }
      action={
        <button className="text-button" onClick={() => setExpanded(!expanded)}>
          <Plus size={16} />
          تسجيل قراءة جهاز
        </button>
      }
    >
      {pressure[0] ? (
        <div className="pressure-value">
          <strong>
            {Math.round(pressure[0].systolic!)} /{" "}
            {Math.round(pressure[0].diastolic!)}
          </strong>
          <span>
            mmHg · {pressure[0].sourceName ?? "Health Connect"}
            <small>
              {new Date(pressure[0].endDate!).toLocaleString("ar-IQ")}
            </small>
          </span>
        </div>
      ) : (
        <p className="small muted">
          ما وصلتنا قراءة ضغط من Health Connect. هذا لا يعني أن ضغطك طبيعي أو أن
          الساعة قاست الضغط.
        </p>
      )}
      <p className="caption">
        قياس الضغط عبر Samsung Health Monitor يعتمد على البلد والدعم والمعايرة
        بجهاز ذراع كل 28 يوم. مشاركته مع Health Connect مو مضمونة. تكدر تحفظ
        قراءة جهازك بمصدرها أدناه.
      </p>
      {expanded && (
        <form
          className="pressure-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget),
              sys = Number(f.get("sys")),
              dia = Number(f.get("dia"));
            if (sys <= dia) {
              notify("راجع الأرقام: الانقباضي عادة أعلى من الانبساطي");
              setBusy(false);
              return;
            }
            const ok = await change("تسجيل قراءة ضغط من جهاز", (d) => ({
              ...d,
              journal: [
                ...d.journal,
                {
                  ...stamp(date, String(f.get("source"))),
                  title: `ضغط ${sys}/${dia} mmHg`,
                  category: "قياس ضغط",
                  text: `انقباضي: ${sys} mmHg\nانبساطي: ${dia} mmHg\nالمصدر: ${f.get("source")}\n${f.get("notes") ?? ""}`,
                },
              ],
            }));
            setBusy(false);
            if (ok) {
              setExpanded(false);
              notify("انحفظت القراءة مع مصدرها");
            }
          }}
        >
          <label>
            الانقباضي
            <input name="sys" type="number" min="40" max="300" required />
          </label>
          <label>
            الانبساطي
            <input name="dia" type="number" min="20" max="200" required />
          </label>
          <label>
            مصدر القراءة
            <select name="source">
              <option>جهاز ذراع</option>
              <option>Samsung Health Monitor</option>
              <option>جهاز آخر</option>
            </select>
          </label>
          <label>
            ظروف القياس
            <input
              name="notes"
              placeholder="جالس، بعد الراحة، وقت القياس…"
              maxLength={1000}
            />
          </label>
          <button className="primary" disabled={busy}>
            حفظ قراءة الجهاز
          </button>
        </form>
      )}
      {manual.map((x) => (
        <div className="measurement-record" key={x.id}>
          <div>
            <b>{x.title}</b>
            <small>
              {x.source} ·{" "}
              {new Date(x.time).toLocaleTimeString("ar-IQ", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          </div>
          <button
            className="icon-button"
            aria-label="حذف قراءة ضغط"
            onClick={() =>
              confirm("حذف القراءة؟", () =>
                change("حذف قراءة ضغط", (d) => ({
                  ...d,
                  journal: d.journal.filter((j) => j.id !== x.id),
                })),
              )
            }
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <details>
        <summary>عمر الجسم ودقة الحساسات</summary>
        <p className="small muted">
          Watch 6 ما تقيس «عمر جسم حقيقي». BMI وBMR واللياقة والاتجاهات مؤشرات
          مختلفة، وما نحولها إلى عمر على أنه حقيقة. كذلك ما نضمن دقة أعلى من
          سامسونج دون مقارنة بقياسات مرجعية. الأكسجين وHRV والحرارة وتركيب الجسم
          تظهر فقط إذا شاركها مصدر يدعمها، وقراءة النبض ما تتحول وحدها إلى ضغط
          أو ECG.
        </p>
      </details>
    </Card>
  );
}
