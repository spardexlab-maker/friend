import { TrainingIntelligence } from "./training-intelligence";
import { SensorCoverage } from "./sensor-coverage";
import { PerformanceHub, HealthInsights } from "./performance";
import { UpdatePanel } from "./updates";
import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpLeft,
  Check,
  ChevronLeft,
  Dumbbell,
  Flame,
  Footprints,
  Moon,
  Plus,
  Droplets,
  Pencil,
  Mic,
  Send,
  Camera,
  Trash2,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Watch,
  RefreshCw,
  Heart,
  Download,
  Upload,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";
import { useApp } from "./app-state";
import { AccountPanel } from "./account";
import { cloudEnabled } from "./cloud-client";
import { Card, Empty, Meals, Metric, format, Field } from "./components";
import {
  bodyMetrics,
  id,
  nutrition,
  stamp,
  type Meal,
  type Exercise,
  type Message,
  type State,
  mealFromProposal,
  today,
} from "./domain";
import { api, askAI } from "./ai";
import { backup, restore } from "./storage";
import { dictate, download, imageData, syncHealth } from "./native";
import { WeeklyReport } from "./reports";
import { printCourse } from "./print";
import { Health } from "@capgo/capacitor-health";
const unit = (e: Exercise) => (e.unit === "lb" ? "باوند" : "كغ");
export const basisLabels = {
  total: "كلي",
  each: "لكل يد",
  machine: "رقم الجهاز",
  bodyweight: "وزن الجسم",
};
export function Dashboard() {
  const { s, date, open, change, setTab, notify } = useApp();
  const meals = s.meals.filter((m) => m.date === date),
    totals = nutrition(meals),
    water = s.water
      .filter((x) => x.date === date)
      .reduce((a, x) => a + x.ml, 0);
  const goal = s.restDates.includes(date) ? s.goals.restKcal : s.goals.kcal;
  const h = s.health.date === date ? s.health.values : {};
  return (
    <>
      <PerformanceHub />
      <div className="section-line">
        <h3>التغذية وخطة اليوم</h3>
        <span className="caption">تفاصيلك تصنع الفرق</span>
      </div>
      <div className="overview">
        <Card
          className="calories"
          title={
            <>
              <Flame size={19} />
              تغذيتك اليوم
            </>
          }
          action={
            <button className="text-button" onClick={() => open("goals")}>
              <Pencil size={14} />
              تعديل الهدف
            </button>
          }
        >
          <div className="calorie-body">
            <div
              className="ring"
              style={
                {
                  "--progress": `${Math.min(totals.kcal / goal, 1) * 360}deg`,
                } as React.CSSProperties
              }
            >
              <div>
                <Flame size={22} />
                <strong>{format(Math.max(0, goal - totals.kcal))}</strong>
                <span>
                  {totals.kcal > goal
                    ? `تجاوزت الهدف بـ ${format(totals.kcal - goal)}`
                    : "سعرة متبقية"}
                </span>
              </div>
            </div>
            <div className="calorie-side">
              <div>
                <span className="muted">أكلت</span>
                <b>
                  {format(totals.kcal)} <small>سعرة</small>
                </b>
              </div>
              <div>
                <span className="muted">
                  هدف {s.restDates.includes(date) ? "الراحة" : "التمرين"}
                </span>
                <b>
                  {format(goal)} <small>سعرة</small>
                </b>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  change("تغيير نوع اليوم", (d) => ({
                    ...d,
                    restDates: d.restDates.includes(date)
                      ? d.restDates.filter((x) => x !== date)
                      : [...d.restDates, date],
                  }))
                }
              >
                تبديل نوع اليوم
              </button>
            </div>
          </div>
          <div className="macros">
            {[
              ["البروتين", totals.protein, s.goals.protein, "green"],
              ["الكارب", totals.carbs, s.goals.carbs, "orange"],
              ["الدهون", totals.fat, s.goals.fat, "purple"],
            ].map(([l, v, t, c]) => (
              <div key={l}>
                <div>
                  <span>{l}</span>
                  <span dir="ltr">
                    <b>{format(Number(v))}</b> / {t} g
                  </span>
                </div>
                <div className="bar">
                  <i
                    className={String(c)}
                    style={{
                      width: `${Math.min((Number(v) / Math.max(Number(t), 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <section className="workout-hero">
          <div className="hero-noise" />
          <div className="card-heading">
            <span>
              <Dumbbell size={19} />
              خطوتك الجاية
            </span>
            <span className="pill">حسب ظروفك</span>
          </div>
          <span className="hero-kicker">جاهز لجولة أقوى؟</span>
          <h2>
            {s.plans[s.session].name} <span>DAY</span>
          </h2>
          <p>
            {
              [
                "صدر، كتف وتراي",
                "ظهر، خلفي وباي",
                "رجل وبطن",
                "الجزء العلوي",
                "الجزء السفلي والبطن",
              ][s.session]
            }
          </p>
          <div className="hero-meta">
            <span>
              {
                (s.overrides[s.sessionId] ?? s.plans[s.session].exercises)
                  .length
              }{" "}
              تمارين
            </span>
            <span>خطتك قابلة للتعديل</span>
          </div>
          <button onClick={() => setTab("workout")}>
            افتح تمرينك <ArrowUpLeft size={20} />
          </button>
        </section>
      </div>
      <div className="stats-grid">
        <Metric
          title="خطواتك"
          icon={<Footprints size={20} />}
          value={h.steps == null ? "—" : format(h.steps)}
          unit="خطوة"
          detail={
            s.health.date === date ? "من Health Connect" : "بانتظار المزامنة"
          }
          color="orange"
        />
        <Metric
          title="نومك"
          icon={<Moon size={20} />}
          value={h.sleep == null ? "—" : format(h.sleep / 60)}
          unit="ساعة"
          detail="آخر جلسة نوم متاحة من Health Connect"
          color="purple"
        />
        <Card className="metric water">
          <div className="metric-title">
            <span className="metric-icon blue">
              <Droplets size={20} />
            </span>
            الماي
            <button
              className="icon-button"
              aria-label="تراجع عن آخر ماء"
              onClick={() => {
                const last = s.water.filter((x) => x.date === date).at(-1);
                if (last)
                  change("حذف آخر ماء", (d) => ({
                    ...d,
                    water: d.water.filter((x) => x.id !== last.id),
                  }));
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <div className="metric-value">
            {format(water / 1000)}{" "}
            <span>من {format(s.goals.water / 1000)} لتر</span>
          </div>
          <div className="water-bottom">
            <div className="water-drops">
              {Array.from({ length: 8 }, (_, i) => (
                <span
                  className={
                    i < (water / Math.max(s.goals.water, 1)) * 8 ? "filled" : ""
                  }
                  key={i}
                />
              ))}
            </div>
            <button
              onClick={() => {
                change("تسجيل ماء", (d) => ({
                  ...d,
                  water: [...d.water, { ...stamp(date), ml: 250 }],
                }));
                notify("سجّلنا 250 مل ماي");
              }}
            >
              + 250 مل
            </button>
            <button onClick={() => open("water")}>كمية أخرى</button>
          </div>
        </Card>
      </div>
      <div className="bottom-grid">
        <Card
          title={
            <>
              وجبات اليوم <b className="count">{meals.length}</b>
            </>
          }
          action={
            <button className="text-button" onClick={() => setTab("food")}>
              عرض الكل <ChevronLeft size={14} />
            </button>
          }
        >
          <Meals
            meals={meals.slice(-3)}
            onAdd={() => open("meal")}
            onEdit={(m) => open("meal", m)}
            onDelete={(m) => open("deleteMeal", m)}
          />
        </Card>
        <Card
          className="companion"
          title={
            <>
              <span className="spark">✦</span>من رفيقك
            </>
          }
          action={<span className="pill">كل التفاصيل تفرق</span>}
        >
          <h3>خطوة واضحة، كل يوم.</h3>
          <p>
            {meals.length
              ? `مسجّل ${meals.length} وجبات. باقي ${format(Math.max(0, s.goals.protein - totals.protein))} غ حتى هدف البروتين اليوم.`
              : "أول وجبة اليوم؟ سجّل الكمية وطريقة الطبخ، حتى تكون حساباتك أوضح."}
          </p>
          <button className="text-button" onClick={() => setTab("chat")}>
            خلّينا نحچي <ArrowUpLeft size={17} />
          </button>
          <div className="connection-note">
            <ShieldCheck size={15} />
            البيانات محفوظة محلياً • المشاركة بالـAI حسب إعدادك
          </div>
        </Card>
      </div>
    </>
  );
}
export function FoodPage() {
  const { s, date, open, change } = useApp();
  const list = s.meals.filter((m) => m.date === date),
    t = nutrition(list);
  return (
    <>
      <div className="summary-strip">
        <span>
          مجموع اليوم <b>{format(t.kcal)}</b> سعرة
        </span>
        <span>
          بروتين <b>{format(t.protein)}</b> غ
        </span>
        <button className="text-button" onClick={() => open("recipe")}>
          <Plus size={15} />
          حساب وصفة / وجبة
        </button>
      </div>
      <Card
        title="سجل أكلك"
        action={
          <button className="text-button" onClick={() => open("meal")}>
            إضافة يدوية <Plus size={16} />
          </button>
        }
      >
        <Meals
          meals={list}
          onAdd={() => open("meal")}
          onEdit={(m) => open("meal", m)}
          onDelete={(m) => open("deleteMeal", m)}
        />
      </Card>
      <div className="section-line">
        <h3>وجباتك السابقة</h3>
        <span className="muted small">إعادة تسجيل ثم تعديل التفاصيل</span>
      </div>
      <div className="repeat-meals">
        {[...new Map([...s.meals].reverse().map((m) => [m.name, m])).values()]
          .slice(0, 8)
          .map((m) => (
            <button
              className="repeat-meal"
              key={m.id}
              onClick={() =>
                open("meal", {
                  ...m,
                  id: undefined,
                  date,
                  source: "نسخ وجبة سابقة",
                })
              }
            >
              <Utensil /> <span>{m.name}</span>
              <Plus size={14} />
            </button>
          ))}
      </div>
      <p className="info-note">
        كل رقم يحافظ على مصدره. الحساب من الوصفة تقديري؛ الملصق الغذائي والوزن
        الفعلي يساعدان على تحسينه. تقدر تعدّل أي سجل وتراجع أثر التعديل من
        الإعدادات.
      </p>
    </>
  );
}
function Utensil() {
  return <Flame size={16} />;
}
export function WorkoutPage() {
  const { s, change, open, date, confirm, notify } = useApp();
  const list = s.overrides[s.sessionId] ?? s.plans[s.session].exercises;
  const actual = s.sets.filter((x) => x.sessionId === s.sessionId);
  return (
    <>
      <div className="stage-row">
        {s.plans.map((p, i) => (
          <button
            key={p.name}
            className={i === s.session ? "chosen" : ""}
            onClick={() => {
              if (i === s.session) return;
              confirm(`تبدّل الجلسة إلى ${p.name}؟`, () =>
                change("تغيير الجلسة يدوياً", (d) => ({
                  ...d,
                  session: i,
                  sessionId: id(),
                })),
              );
            }}
          >
            <span>0{i + 1}</span>
            {p.name}
          </button>
        ))}
      </div>
      <div className="section-line">
        <h3>خطة {s.plans[s.session].name}</h3>
        <button
          className="text-button"
          onClick={() => printCourse().catch(() => notify("تعذر فتح الطباعة"))}
        >
          طباعة / حفظ PDF
        </button>
        <button className="text-button" onClick={() => open("exercise")}>
          <Plus size={16} />
          إضافة تمرين
        </button>
      </div>
      <p className="caption">
        أوزان الخطة منفصلة عن الأداء. تعديلك ممكن يكون لهذه الجلسة أو للخطة
        الدائمة.
      </p>
      <Card className="exercises">
        {list.map((e, i) => (
          <div className="exercise" key={e.id}>
            <span className="exercise-num">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="exercise-name">
              <h3>{e.name}</h3>
              <span>
                {e.english} • {basisLabels[e.basis]}
              </span>
              <div className="caption">
                {actual.filter((x) => x.exerciseId === e.id).length} جولات مسجلة
                • راحة {e.rest} ث
              </div>
            </div>
            <div className="exercise-prescription">
              <b>
                {e.sets} × {e.reps}
              </b>
              <span>
                {e.weight} {unit(e)} • الخطة
              </span>
            </div>
            <button
              className="icon-button"
              aria-label={`تعديل ${e.name}`}
              onClick={() => open("exercise", e)}
            >
              <Pencil size={14} />
            </button>
            <button
              className="round-add"
              aria-label={`سجل ${e.name}`}
              onClick={() => open("set", e)}
            >
              <Plus size={18} />
            </button>
          </div>
        ))}
      </Card>
      <RestTimer />
      <div className="section-line">
        <h3>أداؤك في الجلسة</h3>
        <span className="small muted">{actual.length} جولات</span>
      </div>
      <Card>
        {actual.length ? (
          actual.map((x) => (
            <div className="record-row" key={x.id}>
              <Check size={17} />
              <div className="grow">
                <b>{x.name}</b>
                <span className="caption block">
                  {basisLabels[x.basis]} • {x.date} • RIR {x.rir ?? "غير مسجّل"}
                </span>
              </div>
              <b dir="ltr">
                {x.weight} {x.unit} × {x.reps}
              </b>
              <button
                className="icon-button"
                aria-label={`تعديل جولة ${x.name}`}
                onClick={() => open("setEdit", x)}
              >
                <Pencil size={14} />
              </button>
              <button
                className="icon-button"
                aria-label="حذف الجولة"
                onClick={() =>
                  confirm("حذف الجولة؟", () =>
                    change("حذف جولة", (d) => ({
                      ...d,
                      sets: d.sets.filter((a) => a.id !== x.id),
                    })),
                  )
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <Empty
            title="كل جولة إلها مكان."
            text="سجّل الوزن والتكرارات الحقيقية من + يم التمرين."
          />
        )}
      </Card>
      <div className="section-line">
        <h3>الكارديو</h3>
        <button className="text-button" onClick={() => open("cardio")}>
          <Plus size={15} />
          تسجيل نشاط
        </button>
      </div>
      <Card>
        {s.cardio
          .filter((x) => x.date === date)
          .map((x) => (
            <div className="record-row" key={x.id}>
              <Activity size={18} />
              <div className="grow">
                <b>{x.name}</b>
                <span className="caption block">
                  {x.minutes} دقيقة • {x.distance} كم • {x.source}
                </span>
              </div>
              <b>{x.kcal} سعرة</b>
              <button
                className="icon-button"
                aria-label="تعديل الكارديو"
                onClick={() => open("cardio", x)}
              >
                <Pencil size={14} />
              </button>
              <button
                className="icon-button"
                aria-label="حذف الكارديو"
                onClick={() =>
                  confirm("حذف الكارديو؟", () =>
                    change("حذف كارديو", (d) => ({
                      ...d,
                      cardio: d.cardio.filter((a) => a.id !== x.id),
                    })),
                  )
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        <p className="caption">
          نسجل رقم الجهاز أو تقديرك كما هو. لا نضيفه مرة ثانية فوق إجمالي حرق
          Health Connect. لا نستنتج حرق الحديد من وزن الدمبل.
        </p>
      </Card>
      <button
        className="primary finish"
        onClick={() =>
          confirm("خلصت الجلسة ونجهز التالية؟", () => {
            change("إنهاء جلسة", (d) => ({
              ...d,
              completed: [
                ...d.completed,
                {
                  id: d.sessionId,
                  name: d.plans[d.session].name,
                  time: new Date().toISOString(),
                },
              ],
              session: (d.session + 1) % 5,
              sessionId: id(),
            }));
            notify("جولاتك محفوظة. جهزنا التمرين التالي.");
          })
        }
      >
        <Check size={17} />
        إنهاء الجلسة والانتقال للتالية
      </button>
      <div className="section-line">
        <h3>الجلسات السابقة</h3>
      </div>
      <Card>
        {[...s.completed]
          .reverse()
          .slice(0, 30)
          .map((c) => (
            <details className="session-history" key={c.id}>
              <summary>
                {c.name} •{" "}
                {new Date(c.time).toLocaleString("ar-IQ", {
                  timeZone: "Asia/Baghdad",
                })}
              </summary>
              {s.sets
                .filter((x) => x.sessionId === c.id)
                .map((x) => (
                  <div className="record-row" key={x.id}>
                    <span className="grow">{x.name}</span>
                    <b>
                      {x.weight} {x.unit} × {x.reps}
                    </b>
                    <button
                      className="icon-button"
                      aria-label="تعديل جولة سابقة"
                      onClick={() => open("setEdit", x)}
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                ))}
            </details>
          ))}
      </Card>
    </>
  );
}
function RestTimer() {
  const [remaining, setRemaining] = useState(90),
    [running, setRunning] = useState(false);
  const target = useRef(0);
  useEffect(() => {
    if (!running) return;
    target.current = Date.now() + remaining * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((target.current - Date.now()) / 1000));
      setRemaining(left);
      if (!left) {
        setRunning(false);
        navigator.vibrate?.([200, 100, 200]);
      }
    }, 250);
    return () => clearInterval(t);
  }, [running]);
  return (
    <div className="rest-timer">
      <Timer size={20} />
      <span>راحة بين الجولات</span>
      <b dir="ltr">
        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
      </b>
      <button
        aria-label={running ? "إيقاف المؤقت" : "بدء المؤقت"}
        onClick={() => setRunning(!running)}
      >
        {running ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <button
        aria-label="إعادة المؤقت"
        onClick={() => {
          setRunning(false);
          setRemaining(90);
        }}
      >
        <RotateCcw size={16} />
      </button>
      <select
        aria-label="مدة الراحة"
        defaultValue="90"
        onChange={(e) => {
          setRunning(false);
          setRemaining(Number(e.target.value));
        }}
      >
        <option value="60">60 ث</option>
        <option value="90">90 ث</option>
        <option value="120">دقيقتان</option>
        <option value="180">3 دقائق</option>
      </select>
    </div>
  );
}
export function ProgressPage() {
  const { s, open, confirm, change, setTab } = useApp();
  const metrics = bodyMetrics(s);
  const [compare, setCompare] = useState<string[]>([]);
  const sorted = [...s.weights].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
  );
  const first = sorted[0],
    last = sorted.at(-1);
  return (
    <>
      <div className="stats-grid">
        <Metric
          title="بداية الرحلة"
          icon={<Activity size={20} />}
          value={first?.value ?? "—"}
          unit="كغ"
          detail={first?.date ?? "أضف قراءة"}
          color="orange"
        />
        <Metric
          title="آخر وزن محفوظ"
          icon={<TrendingIcon />}
          value={last?.value ?? "—"}
          unit="كغ"
          detail={last?.date ?? "بدون قراءة"}
        />
        <Metric
          title="فرق الوزن"
          icon={<Flame size={20} />}
          value={first && last ? format(first.value - last.value) : "—"}
          unit="كغ"
          detail="فرق وزن؛ لا يساوي دهوناً صافية"
          color="purple"
        />
      </div>
      <Card
        title="محطات رحلتك"
        action={
          <button className="text-button" onClick={() => open("weight")}>
            قراءة جديدة <Plus size={15} />
          </button>
        }
      >
        <WeightChart weights={sorted} />
      </Card>
      <WeeklyReport />
      <div className="section-line">
        <h3>حسابات الجسم</h3>
        <button className="text-button" onClick={() => open("profile")}>
          تعديل بياناتك <Pencil size={15} />
        </button>
      </div>
      <div className="stats-grid">
        {[
          ["BMI", metrics?.bmi, "كغ/م²"],
          ["BMR", metrics?.bmr, "سعرة / يوم"],
          ["TDEE", metrics?.tdee, "سعرة / يوم"],
        ].map(([title, v, u]) => (
          <Metric
            key={title}
            title={String(title)}
            icon={<Activity size={18} />}
            value={v == null ? "—" : format(Number(v))}
            unit={String(u)}
            detail={
              title === "BMI"
                ? "الوزن ÷ مربع الطول"
                : title === "BMR"
                  ? "معادلة Mifflin–St Jeor"
                  : "BMR × معامل النشاط"
            }
          />
        ))}
      </div>
      <p className="caption">
        المدخلات: {s.profile.height} سم، {s.profile.age} سنة، معامل نشاط{" "}
        {s.profile.activity}. BMR وTDEE تقديرات، ولا نضيف حرق التمرين مرة أخرى
        إلى TDEE. «عمر الجسم» لا يُستخرج بدقة من الساعة أو الصورة، لذلك ما نعرض
        رقماً مخترعاً.
      </p>
      <div className="section-line">
        <h3>صور تطورك</h3>
        <button className="text-button" onClick={() => open("photo")}>
          <Camera size={16} />
          إضافة صورة
        </button>
      </div>
      <Card>
        <p className="small muted">
          نفس الوقفة والإضاءة والمسافة تساعد بالمقارنة. اختار صورتين؛ الإرسال
          للـAI يتم فقط عند الضغط على تحليل المقارنة.
        </p>
        {s.photos.length ? (
          <div className="photo-grid">
            {s.photos.map((p) => (
              <article
                className={compare.includes(p.id) ? "photo selected" : "photo"}
                key={p.id}
              >
                <button
                  onClick={() =>
                    setCompare((c) =>
                      c.includes(p.id)
                        ? c.filter((x) => x !== p.id)
                        : [...c.slice(-1), p.id],
                    )
                  }
                >
                  <img src={p.data} alt={`${p.pose} بتاريخ ${p.date}`} />
                  <span>
                    {p.date} • {p.pose}
                  </span>
                  <small>{p.weight || "—"} كغ</small>
                </button>
                <button
                  className="photo-delete"
                  aria-label="حذف الصورة"
                  onClick={() =>
                    confirm("حذف الصورة نهائياً؟", () => {
                      change("حذف صورة", (d) => ({
                        ...d,
                        photos: d.photos.filter((x) => x.id !== p.id),
                      }));
                      setCompare((c) => c.filter((x) => x !== p.id));
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="رحلتك تستاهل التوثيق."
            text="صورك الأصلية ما كانت بملف التسليم. أضفها مع تاريخها ووقفتها."
            action="إضافة أول صورة"
            onAction={() => open("photo")}
          />
        )}
        <button
          className="secondary"
          disabled={compare.length !== 2}
          onClick={() => open("compare", compare)}
        >
          عرض المقارنة
        </button>
      </Card>
      <div className="section-line">
        <h3>سجل الوزن والقياسات</h3>
      </div>
      <Card>
        {[...sorted].reverse().map((w) => (
          <div className="record-row" key={w.id}>
            <div className="grow">
              <b>{w.date}</b>
              <span className="caption block">
                {w.source} {w.waist ? `• خصر ${w.waist} سم` : ""}{" "}
                {w.neck ? `• رقبة ${w.neck} سم` : ""}
              </span>
            </div>
            <b>{w.value} كغ</b>
            <button
              className="icon-button"
              aria-label="تعديل الوزن"
              onClick={() => open("weight", w)}
            >
              <Pencil size={15} />
            </button>
            <button
              className="icon-button"
              aria-label="حذف الوزن"
              onClick={() =>
                confirm("حذف قراءة الوزن؟", () =>
                  change("حذف وزن", (d) => ({
                    ...d,
                    weights: d.weights.filter((x) => x.id !== w.id),
                  })),
                )
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </Card>
    </>
  );
}
function TrendingIcon() {
  return <Activity size={20} />;
}
function WeightChart({ weights }: { weights: State["weights"] }) {
  const points = weights.slice(-20);
  if (!points.length)
    return <Empty title="أضف أول وزن" text="مخططك يبدأ من أول قراءة." />;
  const min = Math.min(...points.map((x) => x.value)) - 3,
    max = Math.max(...points.map((x) => x.value)) + 3;
  const coords = points.map(
    (p, i) =>
      `${30 + (i * 540) / Math.max(1, points.length - 1)},${170 - ((p.value - min) / (max - min)) * 140}`,
  );
  return (
    <div className="line-chart">
      <svg
        role="img"
        aria-label="اتجاه الوزن حسب القراءات"
        viewBox="0 0 600 210"
      >
        <defs>
          <linearGradient id="chartfill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#c9e8a0" stopOpacity=".22" />
            <stop offset="1" stopColor="#c9e8a0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[40, 100, 170].map((y) => (
          <line
            key={y}
            x1="25"
            x2="580"
            y1={y}
            y2={y}
            stroke="#34402f"
            strokeDasharray="4 5"
          />
        ))}
        <polygon
          points={`30,180 ${coords.join(" ")} ${30 + ((points.length - 1) * 540) / Math.max(1, points.length - 1)},180`}
          fill="url(#chartfill)"
        />
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="#d4ef9c"
          strokeWidth="3"
        />
        {coords.map((p, i) => {
          const [x, y] = p.split(",");
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#d4ef9c" />
              <title>
                {points[i].date}: {points[i].value} كغ
              </title>
            </g>
          );
        })}
        <text x="30" y="205" fill="#9ca994" fontSize="11">
          {points[0].date}
        </text>
        <text x="570" y="205" fill="#9ca994" fontSize="11" textAnchor="end">
          {points.at(-1)?.date}
        </text>
      </svg>
    </div>
  );
}
export function HealthPage() {
  const { s, date, change, notify, open, confirm } = useApp();
  const [busy, setBusy] = useState(false);
  async function sync(request: boolean) {
    setBusy(true);
    try {
      const health = await syncHealth(date, request);
      await change("مزامنة Health Connect", (d) => ({
        ...d,
        health,
        healthHistory: [
          ...d.healthHistory.filter((h) => h.date !== health.date),
          health,
        ].sort((a, b) => a.date.localeCompare(b.date)),
      }));
      notify("تحدّثت البيانات المتاحة. راجع الصلاحيات للحقول الناقصة.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const values = s.health.date === date ? s.health.values : {};
  return (
    <>
      <div className="health-banner">
        <span className="brand-icon">
          <Watch />
        </span>
        <div className="grow">
          <h2>Galaxy Watch 6 + S26 Ultra</h2>
          <p>
            فعّل المشاركة من Samsung Health إلى Health Connect، بعدها امنح رفيق
            صلاحية القراءة.
          </p>
        </div>
        <button className="primary" disabled={busy} onClick={() => sync(true)}>
          {busy ? "نزامن…" : "ربط / صلاحيات"}
          <RefreshCw size={17} />
        </button>
      </div>
      <div className="button-row">
        <button
          className="secondary"
          disabled={busy}
          onClick={() => sync(false)}
        >
          تحديث البيانات
        </button>
        <button
          className="text-button"
          onClick={() =>
            Health.openHealthConnectSettings().catch(() =>
              notify("إعدادات Health Connect متاحة بنسخة أندرويد"),
            )
          }
        >
          إدارة الصلاحيات
        </button>
        <a
          className="text-button"
          href="/privacypolicy.html"
          target="_blank"
          rel="noreferrer"
        >
          الخصوصية
        </a>
      </div>
      <SensorCoverage />
      <HealthInsights />
      <TrainingIntelligence />
      <details className="raw-health">
        <summary>كل القياسات ومصادرها</summary>
        <div className="stats-grid">
          {[
            ["steps", "الخطوات", "خطوة"],
            ["heartRate", "متوسط النبض", "نبضة/د"],
            ["restingHeartRate", "نبض الراحة", "نبضة/د"],
            ["heartRateVariability", "تباين النبض HRV", "مللي ثانية"],
            ["respiratoryRate", "معدل التنفس", "نفس/د"],
            ["calories", "سعرات النشاط", "سعرة تقديرية"],
            ["totalCalories", "إجمالي الحرق", "سعرة تقديرية"],
            ["distance", "المسافة", "متر"],
            ["sleep", "النوم في يوم الاستيقاظ", "دقيقة"],
            ["oxygenSaturation", "الأكسجين", "%"],
            ["weight", "الوزن", "كغ"],
            ["bodyFat", "نسبة الدهن من الجهاز", "%"],
            ["vo2Max", "VO₂ max", "مل/كغ/د"],
          ].map(([k, t, u]) => (
            <Metric
              key={k}
              title={t}
              icon={<Heart size={18} />}
              value={values[k] == null ? "—" : format(values[k]!)}
              unit={u}
              detail="من Health Connect؛ يعتمد على البيانات المتاحة"
            />
          ))}
        </div>
        <p className="caption">
          آخر مزامنة:{" "}
          {s.health.syncedAt
            ? new Date(s.health.syncedAt).toLocaleString("ar-IQ", {
                timeZone: "Asia/Baghdad",
              })
            : "لم تتم بعد"}
          . لا تعني المزامنة الناجحة أن كل الحقول متوفرة. حرق الكارديو المسجل
          يدوياً لا يُجمع مع الإجمالي.
        </p>
        {s.health.errors.length > 0 && (
          <details className="info-note">
            <summary>
              تفاصيل الحقول غير المتاحة ({s.health.errors.length})
            </summary>
            {s.health.errors.map((x) => (
              <div dir="ltr" key={x}>
                {x}
              </div>
            ))}
          </details>
        )}
      </details>
      <div className="section-line">
        <h3>نومك اليدوي</h3>
        <button className="text-button" onClick={() => open("sleep")}>
          <Plus size={15} />
          تسجيل نوم
        </button>
      </div>
      <Card>
        {s.sleep
          .filter((x) => x.date === date)
          .map((x) => (
            <div className="record-row" key={x.id}>
              <Moon size={18} />
              <div className="grow">
                <b>
                  {format((Date.parse(x.end) - Date.parse(x.start)) / 3600000)}{" "}
                  ساعات
                </b>
                <span className="caption block">
                  {x.start.replace("T", " ")} ← {x.end.replace("T", " ")} • جودة{" "}
                  {x.quality}/5
                </span>
              </div>
              <button
                className="icon-button"
                onClick={() => open("sleep", x)}
                aria-label="تعديل النوم"
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button"
                aria-label="حذف النوم"
                onClick={() =>
                  confirm("حذف النوم؟", () =>
                    change("حذف نوم", (d) => ({
                      ...d,
                      sleep: d.sleep.filter((a) => a.id !== x.id),
                    })),
                  )
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        <p className="caption">
          السجل اليدوي منفصل عن الساعة، ولا نجمعهما لنفس الفترة تلقائياً.
        </p>
      </Card>
      <div className="section-line">
        <h3>كل تفاصيل يومك</h3>
        <button className="text-button" onClick={() => open("note")}>
          <Plus size={15} />
          تسجيل ملاحظة / مشكلة
        </button>
      </div>
      <Card>
        {s.journal
          .filter((x) => x.date === date)
          .map((x) => (
            <div className="journal-entry" key={x.id}>
              <div className="section-line">
                <h3>{x.title}</h3>
                <span className="pill">{x.category}</span>
                <button
                  className="icon-button"
                  onClick={() => open("note", x)}
                  aria-label="تعديل الملاحظة"
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label="حذف الملاحظة"
                  onClick={() =>
                    confirm("حذف الملاحظة؟", () =>
                      change("حذف ملاحظة", (d) => ({
                        ...d,
                        journal: d.journal.filter((a) => a.id !== x.id),
                      })),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <p>{x.text}</p>
              <span className="caption">
                {x.source} •{" "}
                {new Date(x.time).toLocaleTimeString("ar-IQ", {
                  timeZone: "Asia/Baghdad",
                })}
              </span>
            </div>
          ))}
        {!s.journal.some((x) => x.date === date) && (
          <p className="muted small">
            مزاجك، تعبك، مكملاتك، وأي شي سويته. اكتبه مثل ما تحچي واحفظه بسجلك.
          </p>
        )}
      </Card>
    </>
  );
}
export function ChatPage() {
  const { s, change, notify, open } = useApp();
  const [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [listening, setListening] = useState(false),
    [images, setImages] = useState<string[]>([]),
    [failure, setFailure] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [s.messages.length, busy]);
  useEffect(() => {
    const raw = sessionStorage.getItem("rafiq-comparison");
    if (raw) {
      try {
        const p = JSON.parse(raw);
        setDraft(p.text);
        setImages(p.images);
      } finally {
        sessionStorage.removeItem("rafiq-comparison");
      }
    }
  }, []);
  async function submit(retry = false) {
    if (busy || (!retry && !draft.trim())) return;
    setFailure("");
    if (!s.settings.consent) {
      notify("فعّل مشاركة السجل مع Gemini من إعدادات الاتصال.");
      open("connection");
      return;
    }
    const message: Message = {
      id: id(),
      role: "user",
      text: draft.trim(),
      time: new Date().toISOString(),
    };
    const messages = retry ? s.messages : [...s.messages, message];
    if (!retry) {
      change("حفظ رسالة", (d) => ({ ...d, messages }));
      setDraft("");
    }
    setBusy(true);
    try {
      const result = await askAI(s, messages, images);
      const reply: Message = {
        id: id(),
        role: "assistant",
        text: String(result.reply),
        time: new Date().toISOString(),
        proposal: result.proposal ?? undefined,
      };
      change("حفظ رد Gemini", (d) => ({
        ...d,
        messages: [...d.messages, reply],
      }));
      setImages([]);
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function voice() {
    setListening(true);
    try {
      const text = await dictate();
      setDraft((d) => [d, text].filter(Boolean).join(" "));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setListening(false);
    }
  }
  return (
    <Card className="chat">
      <div className="chat-heading">
        <span className="brand-icon">
          <Activity />
        </span>
        <div className="grow">
          <h3>رفيق {s.profile.name}</h3>
          <span className="small muted">
            Google Gemini • {s.settings.model || "اختر النموذج من الاتصال"}
          </span>
        </div>
        <button className="text-button" onClick={() => open("connection")}>
          الاتصال
        </button>
      </div>
      <div className="chat-messages">
        {!s.messages.length && (
          <div className="assistant-bubble">
            هلا {s.profile.name} 👋
            <br />
            احچيلي شنو أكلت أو تمرنت، وأسألك عن التفاصيل الناقصة قبل التسجيل.
            <p>
              رسائلك محفوظة محلياً. عند الإرسال تشارك سجل المتابعة وملف الذاكرة
              مع Gemini حسب موافقتك. الصور تُرسل فقط إذا أرفقتها.
            </p>
          </div>
        )}
        {s.messages.map((m) => (
          <div
            className={m.role === "user" ? "user-bubble" : "assistant-bubble"}
            key={m.id}
          >
            <div className="message-text">{m.text}</div>
            <span className="message-time">
              {new Date(m.time).toLocaleString("ar-IQ", {
                timeZone: "Asia/Baghdad",
                hour: "2-digit",
                minute: "2-digit",
                day: "numeric",
                month: "short",
              })}
            </span>
            {m.role === "assistant" && m.proposal != null && (
              <button
                className="secondary"
                disabled={m.applied}
                onClick={() => open("proposal", m)}
              >
                {m.applied
                  ? "تم تسجيل الاقتراح"
                  : "راجع تفاصيل الاقتراح وسجّله"}
              </button>
            )}
          </div>
        ))}
        {busy && (
          <div className="assistant-bubble typing">
            <span className="loader" />
            رفيقك يراجع التفاصيل…
          </div>
        )}
        <div ref={end} />
      </div>
      {failure && (
        <div className="inline-error" role="alert">
          {failure}
          <button className="text-button" onClick={() => submit(true)}>
            إعادة المحاولة
          </button>
        </div>
      )}
      <div className="attachments">
        {images.map((src, i) => (
          <button
            key={i}
            onClick={() => setImages((a) => a.filter((_, j) => j !== i))}
            aria-label="إزالة المرفق"
          >
            <img src={src} alt="صورة مرفقة للإرسال" />
            <span>×</span>
          </button>
        ))}
      </div>
      <div className="suggestions">
        {["أريد أسجل فطوري", "خلصت تمرين اليوم", "راجع تقدمي حسب سجلي"].map(
          (x) => (
            <button key={x} onClick={() => setDraft(x)}>
              {x}
            </button>
          ),
        )}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button
          type="button"
          className={listening ? "icon-button recording" : "icon-button"}
          aria-label="تسجيل صوتي"
          disabled={listening || busy}
          onClick={voice}
        >
          <Mic size={21} />
        </button>
        <label className="attachment-button" aria-label="إرفاق صورة">
          <Camera size={19} />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const data = await imageData(file);
                setImages((a) => [...a.slice(-1), data]);
              } catch (e) {
                notify((e as Error).message);
              }
              e.target.value = "";
            }}
          />
        </label>
        <input
          aria-label="رسالتك لرفيق"
          placeholder={listening ? "نسمعك…" : "احچيلي عن يومك…"}
          value={draft}
          maxLength={20000}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
        />
        <button
          className="send"
          disabled={busy || !draft.trim()}
          aria-label="إرسال الرسالة"
        >
          <Send size={19} />
        </button>
      </form>
      <span className="caption chat-disclaimer">
        راجع التفريغ الصوتي قبل إرساله. الحفظ في سجل الأكل يحتاج مراجعة اقتراح
        التسجيل.
      </span>
    </Card>
  );
}
export function SettingsPage() {
  const { s, change, replace, open, notify, confirm } = useApp();
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [memoryDraft, setMemoryDraft] = useState(s.memory);
  useEffect(() => setMemoryDraft(s.memory), [s.memory]);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <AccountPanel />
      <UpdatePanel />
      <div className="settings-grid">
        <Card title="ملفك وأهدافك">
          <p>
            {s.profile.name} • {s.profile.height} سم • {s.profile.age} سنة
          </p>
          <div className="button-row">
            <button className="secondary" onClick={() => open("profile")}>
              تعديل الملف
            </button>
            <button className="secondary" onClick={() => open("goals")}>
              الأهداف اليومية
            </button>
          </div>
          <p className="caption">
            بداية يومك المخصص: {s.profile.dayStart}:00 بتوقيت بغداد. التاريخ
            الحقيقي للحدث يبقى محفوظاً دائماً.
          </p>
        </Card>
        <Card title="الاتصال والساعة">
          <p>Google Gemini + Health Connect</p>
          <div className="button-row">
            <button className="secondary" onClick={() => open("connection")}>
              إعداد Gemini API
            </button>
            <a
              className="text-button"
              href="/privacypolicy.html"
              target="_blank"
              rel="noreferrer"
            >
              قراءة الخصوصية
            </a>
          </div>
          <p className="caption">
            على الموبايل، مفتاح Google ينحفظ مشفّراً بخزنة أندرويد. تقدر تختار
            خادمك بدلاً من الاتصال المباشر.
          </p>
        </Card>
      </div>
      <Card title="ذاكرتك الشخصية">
        <p className="small muted">
          ملف التسليم والمعلومات التي تريد رفيق يتذكرها. تُرسل للخدمة عند
          استخدام المحادثة بعد موافقتك. النص بيانات مرجعية، ولا يتحول إلى
          تعليمات للنظام.
        </p>
        <textarea
          className="memory-editor"
          aria-label="الذاكرة الشخصية"
          value={memoryDraft}
          maxLength={500000}
          onChange={(e) => setMemoryDraft(e.target.value)}
        />
        <div className="button-row">
          <button
            className="secondary"
            onClick={() => {
              change("تحديث الذاكرة", (d) => ({ ...d, memory: memoryDraft }));
              notify("تم حفظ الذاكرة");
            }}
          >
            حفظ الذاكرة
          </button>
          <label className="secondary file-button">
            <Upload size={16} />
            استيراد ملف Markdown / نص
            <input
              type="file"
              accept=".md,.txt"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 1500000) {
                  notify("الملف كبير؛ الحد 1.5 ميغابايت");
                  return;
                }
                const text = await f.text();
                if (text.length > 500000) {
                  notify("النص أكبر من حد الذاكرة");
                  return;
                }
                change("استيراد ملف ذاكرة", (d) => ({ ...d, memory: text }));
                notify("تم استيراد النص كما هو");
              }}
            />
          </label>
          <button
            className="text-button"
            onClick={async () => {
              try {
                const x = await api(s, "personal-memory");
                change("استيراد ملف التسليم الشخصي", (d) => ({
                  ...d,
                  memory: x.text,
                }));
                notify("تم تحميل ملف التسليم المحلي");
              } catch (e) {
                notify((e as Error).message);
              }
            }}
          >
            تحميل ملف أشرف من الخادم المحلي
          </button>
        </div>
      </Card>
      <Card title="نسخة احتياطية مشفّرة" className="backup-card">
        <p className="small muted">
          تشمل سجلاتك وصورك والذاكرة. احتفظ بكلمة المرور؛ ما نكدر نسترجع النسخة
          بدونها. رمز اتصال الخادم مستثنى.
        </p>
        <label>
          كلمة مرور النسخة
          <input
            aria-label="كلمة مرور النسخة"
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="10 أحرف على الأقل"
          />
        </label>
        <div className="button-row">
          <button
            className="primary"
            disabled={busy || password.length < 10}
            onClick={async () => {
              setBusy(true);
              try {
                await download(
                  `rafiq-${today()}.json`,
                  await backup(s, password),
                );
                notify("تم تجهيز النسخة المشفرة");
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={16} />
            تصدير نسخة
          </button>
          <button
            className="secondary"
            disabled={busy || password.length < 10}
            onClick={() => input.current?.click()}
          >
            <Upload size={16} />
            استعادة نسخة
          </button>
          <input
            type="file"
            accept=".json"
            hidden
            ref={input}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                if (f.size > 100 * 1024 * 1024)
                  throw Error("الملف أكبر من 100 ميغابايت");
                const recovered = await restore(await f.text(), password);
                confirm("استبدال السجل الحالي بالنسخة الاحتياطية؟", () => {
                  replace(recovered);
                  notify("تمت استعادة النسخة");
                });
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </div>
      </Card>
      <Card
        title="سجل التعديلات"
        action={<span className="pill">{s.audit.length} عملية</span>}
      >
        <input
          className="search-input"
          aria-label="بحث في سجل التعديلات"
          placeholder="ابحث عن تعديل…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="audit-list">
          {[...s.audit]
            .reverse()
            .filter((a) => a.label.includes(search))
            .slice(0, 100)
            .map((a) => (
              <details key={a.id}>
                <summary>
                  {a.label}
                  <span>
                    {new Date(a.time).toLocaleString("ar-IQ", {
                      timeZone: "Asia/Baghdad",
                    })}
                  </span>
                </summary>
                <div className="audit-diff">
                  <pre>{a.before}</pre>
                  <pre>{a.after}</pre>
                </div>
              </details>
            ))}
        </div>
      </Card>
      {!cloudEnabled && (
        <Card title="بيانات الجهاز">
          <p className="small muted">
            السجلات والصور محفوظة داخل قاعدة بيانات الجهاز. مسح التطبيق أو
            بيانات المتصفح قد يحذفها؛ صدّر نسخة قبل الانتقال لجهاز آخر.
          </p>
          <button
            className="danger"
            onClick={() =>
              confirm("مسح كل سجلاتك وصورك من هذا الجهاز؟", async () => {
                const { initialState } = await import("./domain");
                const cleared = initialState();
                cleared.weights = [];
                replace(cleared);
                notify("تم مسح السجل المحلي؛ النسخ التي صدّرتها تبقى عندك");
              })
            }
          >
            مسح بياناتي المحلية
          </button>
        </Card>
      )}
    </>
  );
}
