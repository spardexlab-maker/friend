import { useApp } from "./app-state";
import { Card, format } from "./components";
import { nutrition, today } from "./domain";
export function WeeklyReport() {
  const { s } = useApp();
  const end = today(),
    start = new Date(Date.parse(end + "T12:00:00+03:00") - 6 * 86400000)
      .toISOString()
      .slice(0, 10);
  const meals = s.meals.filter((x) => x.date >= start && x.date <= end),
    days = new Set(meals.map((x) => x.date)).size,
    totals = nutrition(meals);
  const sessions = s.completed.filter(
    (x) => x.time.slice(0, 10) >= start && x.time.slice(0, 10) <= end,
  ).length;
  const waters = s.water.filter((x) => x.date >= start && x.date <= end),
    waterDays = new Set(waters.map((x) => x.date)).size;
  return (
    <Card
      title="أسبوعك، بالصورة الأوضح"
      action={<span className="pill">آخر 7 أيام</span>}
    >
      <div className="weekly-grid">
        <div>
          <b>{sessions}</b>
          <span>جلسات مكتملة</span>
        </div>
        <div>
          <b>{days ? format(totals.kcal / days) : "—"}</b>
          <span>متوسط سعرات الأيام المسجّلة</span>
        </div>
        <div>
          <b>{days ? format(totals.protein / days) : "—"}</b>
          <span>متوسط البروتين (غ)</span>
        </div>
        <div>
          <b>
            {waterDays
              ? format(waters.reduce((a, x) => a + x.ml, 0) / waterDays / 1000)
              : "—"}
          </b>
          <span>متوسط الماي المسجّل (لتر)</span>
        </div>
      </div>
      <p className="caption">
        الأكل مسجل في {days} من 7 أيام. المتوسط يحسب الأيام المسجلة فقط؛ اليوم
        الناقص مو بالضرورة يمثل كل أكلك. الأرقام ما تثبت عجزاً دقيقاً لوحدها.
      </p>
    </Card>
  );
}
