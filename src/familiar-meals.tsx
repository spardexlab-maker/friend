import { useState } from "react";
import { Star, Plus, Check, Trash2, Utensils } from "lucide-react";
import { useApp } from "./app-state";
import { type Meal, id } from "./domain";
import { Card, Dialog } from "./components";
const signature = (
  m: Pick<
    Meal,
    "name" | "grams" | "preparation" | "kcal" | "protein" | "carbs" | "fat"
  >,
) =>
  JSON.stringify([
    m.name.trim(),
    m.grams,
    m.preparation,
    m.kcal,
    m.protein,
    m.carbs,
    m.fat,
  ]);
export function familiarSuggestions(meals: Meal[]) {
  const map = new Map<string, { meal: Meal; dates: Set<string> }>();
  for (const meal of meals) {
    const key = signature(meal),
      old = map.get(key);
    map.set(key, { meal, dates: new Set([...(old?.dates ?? []), meal.date]) });
  }
  return [...map.values()].sort(
    (a, b) =>
      b.dates.size - a.dates.size || b.meal.time.localeCompare(a.meal.time),
  );
}
export function FamiliarMeals() {
  const { s, date, change, open, notify } = useApp(),
    [manage, setManage] = useState(false),
    [busy, setBusy] = useState(false);
  const weekday = new Date(date + "T12:00:00Z").getUTCDay(),
    suggestions = familiarSuggestions(s.meals),
    scheduled = s.mealTemplates.filter(
      (x) => x.enabled && x.days.includes(weekday),
    );
  const learned = suggestions
    .filter(
      (x) =>
        x.dates.size >= 2 &&
        !s.mealTemplates.some((t) => signature(t.meal) === signature(x.meal)),
    )
    .slice(0, 5);
  async function pin(meal: Meal) {
    setBusy(true);
    const { id: _, date: __, time: ___, source: ____, ...value } = meal;
    const ok = await change("تثبيت وجبة معتادة", (d) => ({
      ...d,
      mealTemplates: [
        ...d.mealTemplates,
        { id: id(), meal: value, days: [0, 1, 2, 3, 4, 5, 6], enabled: true },
      ],
    }));
    setBusy(false);
    if (ok) notify("انحفظت بالوجبات المعتادة؛ ما انضافت لأكل اليوم");
  }
  return (
    <>
      <Card
        className="familiar-meals"
        title={
          <>
            <Utensils size={18} />
            وجباتك المعتادة
          </>
        }
        action={
          <button className="text-button" onClick={() => setManage(true)}>
            <Star size={15} />
            إدارة المعتادة
          </button>
        }
      >
        <p className="caption">
          تظهر حسب أيامك أو تكرار سجلك. اضغط الوجبة وراجع الكمية حتى تسجلها؛
          الظهور ما يعني أكلتها.
        </p>
        <div className="familiar-grid">
          {scheduled.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                open("meal", { ...t.meal, date, source: "وجبة معتادة" })
              }
            >
              <span className="familiar-icon">
                <Star size={18} />
              </span>
              <span>
                <b>{t.meal.name}</b>
                <small>
                  {t.meal.grams} غ · {Math.round(t.meal.kcal)} سعرة
                </small>
              </span>
              <Plus size={17} />
            </button>
          ))}
          {learned.map((x) => (
            <button
              key={x.meal.id}
              onClick={() =>
                open("meal", {
                  ...x.meal,
                  id: undefined,
                  date,
                  source: "اقتراح من التكرار",
                })
              }
            >
              <span className="familiar-icon">
                <Utensils size={18} />
              </span>
              <span>
                <b>{x.meal.name}</b>
                <small>
                  مسجلة في {x.dates.size} أيام · {Math.round(x.meal.kcal)} سعرة
                </small>
              </span>
              <Plus size={17} />
            </button>
          ))}
        </div>
        {!scheduled.length && !learned.length && (
          <p className="small muted">
            ثبّت وجبة من سجلك، أو سجّلها في يومين مختلفين حتى تظهر تلقائياً هنا.
          </p>
        )}
      </Card>
      {manage && (
        <Dialog title="إدارة وجباتك المعتادة" onClose={() => setManage(false)}>
          <div className="template-list">
            {s.mealTemplates.map((t) => (
              <div className="template-item" key={t.id}>
                <div className="section-line">
                  <b>{t.meal.name}</b>
                  <button
                    className="icon-button"
                    aria-label={`حذف الوجبة المعتادة ${t.meal.name}`}
                    onClick={() =>
                      change("إزالة وجبة معتادة", (d) => ({
                        ...d,
                        mealTemplates: d.mealTemplates.filter(
                          (x) => x.id !== t.id,
                        ),
                      }))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="day-chips">
                  {[
                    "أحد",
                    "اثنين",
                    "ثلاثاء",
                    "أربعاء",
                    "خميس",
                    "جمعة",
                    "سبت",
                  ].map((name, i) => (
                    <button
                      key={i}
                      className={t.days.includes(i) ? "selected" : ""}
                      aria-pressed={t.days.includes(i)}
                      onClick={() =>
                        change("تعديل أيام وجبة معتادة", (d) => ({
                          ...d,
                          mealTemplates: d.mealTemplates.map((x) =>
                            x.id === t.id
                              ? {
                                  ...x,
                                  days: x.days.includes(i)
                                    ? x.days.filter((n) => n !== i)
                                    : [...x.days, i],
                                }
                              : x,
                          ),
                        }))
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <label className="habit-check">
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={(e) =>
                      change("تفعيل وجبة معتادة", (d) => ({
                        ...d,
                        mealTemplates: d.mealTemplates.map((x) =>
                          x.id === t.id
                            ? { ...x, enabled: e.target.checked }
                            : x,
                        ),
                      }))
                    }
                  />
                  إظهار اقتراح الوجبة
                </label>
              </div>
            ))}
          </div>
          <h3>ثبّت من سجلك</h3>
          <div className="pin-list">
            {suggestions.slice(0, 20).map((x) => {
              const pinned = s.mealTemplates.some(
                (t) => signature(t.meal) === signature(x.meal),
              );
              return (
                <button
                  disabled={busy || pinned}
                  key={x.meal.id}
                  onClick={() => pin(x.meal)}
                >
                  <span>
                    <b>{x.meal.name}</b>
                    <small>
                      {x.meal.grams} غ · {x.meal.preparation}
                    </small>
                  </span>
                  {pinned ? <Check size={16} /> : <Plus size={17} />}
                </button>
              );
            })}
            {!suggestions.length && (
              <p className="small muted">
                سجّل أول وجبة بالكميات، وبعدها تكدر تثبتها هنا.
              </p>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
