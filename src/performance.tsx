import { useEffect, useState, type CSSProperties } from "react";
import {
  Activity,
  ArrowUpLeft,
  Bluetooth,
  Check,
  ChevronLeft,
  CircleHelp,
  Heart,
  Moon,
  RefreshCw,
  Sparkles,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { useApp } from "./app-state";
import { Card, format } from "./components";
import { stamp, type State } from "./domain";
import {
  dailyHealth,
  recovery,
  sleepCoach,
  sleepMinutes,
  shiftDay,
  zoneMinutes,
  heartSeries,
  habitInsights,
  clamp,
} from "./insights";
import { syncHealth } from "./native";
function Arc({
  value,
  color,
  label,
  unit,
}: {
  value: number | null;
  color: string;
  label: string;
  unit?: string;
}) {
  const percentage = value == null ? 0 : clamp(value);
  return (
    <div className="vital-arc" style={{ "--accent": color } as CSSProperties}>
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle className="arc-track" cx="80" cy="80" r="65" />
        <circle
          className="arc-value"
          cx="80"
          cy="80"
          r="65"
          pathLength="100"
          strokeDasharray={`${percentage} 100`}
        />
      </svg>
      <div>
        <strong>
          {value == null ? "—" : Math.round(value)}
          <small>{value == null ? "" : (unit ?? "%")}</small>
        </strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
function Sparkline({
  values,
  color = "#9ae76c",
}: {
  values: (number | null)[];
  color?: string;
}) {
  const valid = values.filter((n): n is number => n != null);
  if (valid.length < 2)
    return <div className="spark-empty">بانتظار يومين من البيانات</div>;
  const min = Math.min(...valid),
    max = Math.max(...valid),
    step = 240 / Math.max(values.length - 1, 1);
  let path = "",
    open = false;
  values.forEach((n, i) => {
    if (n == null) {
      open = false;
      return;
    }
    path += `${open ? "L" : "M"}${i * step},${48 - ((n - min) / Math.max(max - min, 1)) * 36} `;
    open = true;
  });
  return (
    <svg
      className="sparkline"
      viewBox="0 0 240 60"
      preserveAspectRatio="none"
      role="img"
      aria-label="اتجاه القياسات المسجلة"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {values.map((n, i) =>
        n == null ? null : (
          <circle
            key={i}
            cx={i * step}
            cy={48 - ((n - min) / Math.max(max - min, 1)) * 36}
            r="3"
            fill={color}
          />
        ),
      )}
    </svg>
  );
}
function Checkin() {
  const { s, date, change, notify } = useApp(),
    saved = s.checkins.find((x) => x.date === date);
  const [expanded, setExpanded] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <section className="checkin-panel">
      <button className="checkin-toggle" onClick={() => setExpanded(!expanded)}>
        <span className="feature-icon">
          <Sparkles size={21} />
        </span>
        <span>
          <b>{saved ? "إحساسك اليوم مسجّل" : "شلون تحس اليوم؟"}</b>
          <small>30 ثانية تربط إحساسك بأرقامك</small>
        </span>
        <span className="checkin-arrow">
          {saved ? <Check size={19} /> : <ChevronLeft size={21} />}
        </span>
      </button>
      {expanded && (
        <form
          key={date}
          className="checkin-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const record = {
              ...(saved ?? stamp(date)),
              energy: Number(f.get("energy")),
              soreness: Number(f.get("soreness")),
              stress: Number(f.get("stress")),
              caffeineLate: f.has("caffeineLate"),
              lateMeal: f.has("lateMeal"),
              notes: String(f.get("notes") ?? ""),
            };
            const ok = await change("تسجيل إحساس اليوم", (d) => ({
              ...d,
              checkins: [...d.checkins.filter((x) => x.date !== date), record],
            }));
            setBusy(false);
            if (ok) {
              notify("انحفظ إحساسك وعاداتك");
              setExpanded(false);
            }
          }}
        >
          {(
            [
              ["energy", "طاقتك", "من منخفضة إلى عالية"],
              ["soreness", "ألم العضلات", "من خفيف إلى قوي"],
              ["stress", "إجهادك النفسي", "من هادئ إلى عالي"],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key}>
              {label}
              <small>{hint}</small>
              <select name={key} defaultValue={saved?.[key] ?? 3}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="habit-check">
            <input
              name="caffeineLate"
              type="checkbox"
              defaultChecked={saved?.caffeineLate}
            />
            شربت كافيين خلال 6 ساعات قبل النوم
          </label>
          <label className="habit-check">
            <input
              name="lateMeal"
              type="checkbox"
              defaultChecked={saved?.lateMeal}
            />
            أكلت خلال ساعتين قبل النوم
          </label>
          <label className="wide">
            ملاحظات يومك
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={saved?.notes}
              placeholder="تعب، ضغط شغل، تغيير بروتينك…"
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "نحفظ…" : "حفظ إحساس اليوم"}
          </button>
        </form>
      )}
    </section>
  );
}
export function PerformanceHub() {
  const { s, date, setTab, change, notify, open } = useApp(),
    r = recovery(s, date),
    coach = sleepCoach(s, date),
    zones = zoneMinutes(s, date),
    h = dailyHealth(s, date);
  const [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<"recovery" | "sleep" | "effort">(
      "recovery",
    );
  const color =
    r.score == null
      ? "#6e7c8c"
      : r.score >= 75
        ? "#a4ed77"
        : r.score >= 50
          ? "#f2c46d"
          : "#fb8e85";
  const coverage = [
    "sleep",
    "heartRateVariability",
    "restingHeartRate",
    "oxygenSaturation",
    "respiratoryRate",
  ].filter((k) => h?.values[k] != null).length;
  async function sync() {
    setBusy(true);
    try {
      const health = await syncHealth(date);
      await change("تحديث القياسات الصحية", (d) => ({
        ...d,
        health,
        healthHistory: [
          ...d.healthHistory.filter((x) => x.date !== date),
          health,
        ],
      }));
      notify("تحدّثت القياسات المتاحة");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="performance-hub">
      <div className="performance-heading">
        <div>
          <span className="overline">RAFIQ / HUMAN PERFORMANCE</span>
          <h2>
            افهم جسمك.
            <br />
            <em>اختار خطوتك.</em>
          </h2>
        </div>
        <button
          className={`sensor-status ${busy ? "syncing" : ""}`}
          onClick={sync}
          disabled={busy}
        >
          <span className={h ? "status-light" : "status-light muted-light"} />
          <RefreshCw size={14} />
          <span>{busy ? "نزامن…" : h ? "تحديث القياسات" : "مزامنة ساعتك"}</span>
        </button>
      </div>
      <div className="vital-grid">
        <button
          className={`vital-card recovery-card ${selected === "recovery" ? "selected" : ""}`}
          onClick={() => setSelected("recovery")}
        >
          <div className="vital-top">
            <span>
              <Heart size={15} />
              الجاهزية
            </span>
            <span>01</span>
          </div>
          <Arc value={r.score} color={color} label={r.label} />
          <div className="vital-bottom">
            <span>{r.baselineDays} / 3 أيام أساس</span>
            <ArrowUpLeft size={18} />
          </div>
        </button>
        <button
          className={`vital-card sleep-card ${selected === "sleep" ? "selected" : ""}`}
          onClick={() => setSelected("sleep")}
        >
          <div className="vital-top">
            <span>
              <Moon size={15} />
              النوم
            </span>
            <span>02</span>
          </div>
          <Arc
            value={
              r.sleep.minutes == null
                ? null
                : clamp((r.sleep.minutes / (s.wellness.sleepGoal * 60)) * 100)
            }
            color="#a998ff"
            label={
              r.sleep.minutes == null
                ? "نومك يكمل الصورة"
                : `${(r.sleep.minutes / 60).toFixed(1)} ساعة من ${s.wellness.sleepGoal}`
            }
          />
          <div className="vital-bottom">
            <span>{r.sleep.source}</span>
            <ArrowUpLeft size={18} />
          </div>
        </button>
        <button
          className={`vital-card effort-card ${selected === "effort" ? "selected" : ""}`}
          onClick={() => setSelected("effort")}
        >
          <div className="vital-top">
            <span>
              <Zap size={15} />
              الحمل القلبي
            </span>
            <span>03</span>
          </div>
          <div className="effort-gauge">
            <div className="effort-bars">
              {Array.from({ length: 18 }, (_, i) => (
                <i
                  key={i}
                  className={
                    zones.effort != null && i < Math.min(18, zones.effort / 20)
                      ? "lit"
                      : ""
                  }
                  style={{ height: 22 + Math.pow(i / 17, 1.5) * 74 }}
                />
              ))}
            </div>
            <strong>
              {zones.effort ?? "—"}
              <small>{zones.effort == null ? "" : " نقطة"}</small>
            </strong>
            <span>
              {zones.sampled >= 10
                ? `${Math.round(zones.sampled)} دقيقة مغطاة بالنبض`
                : "نحتاج 10 دقائق نبض متصل"}
            </span>
          </div>
          <div className="vital-bottom">
            <span>مناطق النبض × الدقائق</span>
            <ArrowUpLeft size={18} />
          </div>
        </button>
      </div>
      <div className="vital-detail" key={selected}>
        <div className="detail-icon">
          {selected === "recovery" ? (
            <Heart />
          ) : selected === "sleep" ? (
            <Moon />
          ) : (
            <Activity />
          )}
        </div>
        <div className="grow">
          <span className="overline">
            {selected === "recovery"
              ? "YOUR DAILY SIGNAL"
              : selected === "sleep"
                ? "SLEEP INTELLIGENCE"
                : "TRAIN WITH INTENT"}
          </span>
          <h3>
            {selected === "recovery"
              ? r.score == null
                ? "خلّينا نتعرّف على إيقاع جسمك"
                : r.score >= 75
                  ? "جاهز؟ خلّي تمرينك على قدر إحساسك"
                  : r.score >= 50
                    ? "وازن تمرينك ويا الراحة"
                    : "خفّف إذا تحس بالتعب اليوم"
              : selected === "sleep"
                ? `وقت التهدئة المقترح ${coach.bedtime}`
                : "جهدك القلبي يحتاج نبضاً، مو مجموع الحديد"}
          </h3>
          <p>
            {selected === "recovery"
              ? r.score == null
                ? "زامن النوم ونبض الراحة أو HRV لثلاثة أيام سابقة، وسجّل إحساسك. لن نملأ الفراغ بدرجة مصطنعة."
                : "تقدير رفيق للتخطيط العام من النوم وخطك الأساسي وإحساسك؛ مو قياس طبي أو خوارزمية WHOOP."
              : selected === "sleep"
                ? `هدف الليلة ${(coach.target / 60).toFixed(1)} ساعة، مع 20 دقيقة للهدوء. نقص النوم المسجل ${Math.round((coach.debt / 60) * 10) / 10} ساعة عبر ${coach.days} أيام مسجلة من 7.`
                : "نحسب الزمن المتصل داخل مناطق نبض تقديرية. الفواصل الأطول من دقيقتين مستثناة، والحمل الظاهر يخص الدقائق المسجلة فقط."}
          </p>
        </div>
        <button
          className="text-button"
          onClick={() =>
            selected === "sleep" ? open("sleep") : setTab("health")
          }
        >
          {selected === "sleep" ? "سجّل نومك" : "افتح التحليل"}
          <ArrowUpLeft size={16} />
        </button>
      </div>
      <div className="performance-strip">
        <span>
          <Bluetooth size={14} />
          {coverage}/5 قياسات يومية متاحة
        </span>
        <span>
          {h
            ? `آخر مزامنة ${new Date(h.syncedAt).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}`
            : "Galaxy Watch 6 • بانتظار البيانات"}
        </span>
        <button onClick={() => setTab("health")}>
          الحساسات والمصادر
          <ChevronLeft size={14} />
        </button>
      </div>
      <Checkin />
    </div>
  );
}
function BreathSession() {
  const [running, setRunning] = useState(false),
    [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(
      () =>
        setSeconds((n) => {
          if (n >= 119) {
            setRunning(false);
            return 120;
          }
          return n + 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [running]);
  return (
    <Card
      className="breath-card"
      title={
        <>
          <Wind size={18} />
          دقيقتين إلك
        </>
      }
    >
      <div className={`breath-orbit ${running ? "active" : ""}`}>
        <span>
          {running
            ? seconds % 10 < 4
              ? "شهيق"
              : "زفير"
            : seconds === 120
              ? "أحسنت"
              : "خذ نفس"}
        </span>
      </div>
      <p className="small muted">
        شهيق 4 ثواني، زفير 6. تمرين تهدئة اختياري، وليس قياساً للتوتر. تنفّس
        براحتك وتوقف إذا تحس بدوخة.
      </p>
      <button
        className="secondary"
        onClick={() => {
          setRunning(!running);
          if (!running) setSeconds(0);
        }}
      >
        {running ? "إيقاف" : seconds === 120 ? "مرة ثانية" : "ابدأ التهدئة"}
      </button>
      <span className="caption">
        {seconds
          ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
          : "02:00"}
      </span>
    </Card>
  );
}
export function HealthInsights() {
  const { s, date, change, notify } = useApp(),
    r = recovery(s, date),
    zones = zoneMinutes(s, date),
    series = heartSeries(s, date),
    habits = habitInsights(s, date),
    h = dailyHealth(s, date);
  const [range, setRange] = useState(7),
    [showFormula, setShowFormula] = useState(false);
  const days = Array.from({ length: range }, (_, i) =>
    shiftDay(date, i - range + 1),
  );
  const stages =
    (
      (h?.samples ?? []) as {
        dataType?: string;
        endDate?: string;
        stages?: { stage: string; durationMinutes: number }[];
      }[]
    )
      .filter((x) => x.dataType === "sleep")
      .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))[0]
      ?.stages ?? [];
  const stageInfo = [
    ["deep", "عميق", "#9c8bff"],
    ["rem", "REM", "#c0b6ff"],
    ["light", "خفيف", "#6bb6ff"],
    ["awake", "يقظة", "#f1c276"],
  ];
  return (
    <section className="health-intelligence">
      <div className="analysis-heading">
        <div>
          <span className="overline">THE BIGGER PICTURE</span>
          <h2>أرقامك، ضمن سياقها.</h2>
        </div>
        <div className="segmented">
          {[7, 14, 28].map((n) => (
            <button
              key={n}
              className={range === n ? "active" : ""}
              onClick={() => setRange(n)}
            >
              {n} يوم
            </button>
          ))}
        </div>
      </div>
      <div className="trend-grid">
        {[
          ["heartRateVariability", "تباين النبض", "ms", "#a5ed77"],
          ["restingHeartRate", "نبض الراحة", "bpm", "#ff9c8f"],
          ["sleep", "النوم", "ساعة", "#a998ff"],
        ].map(([key, label, unit, color]) => {
          const values = days.map((d) =>
            key === "sleep"
              ? sleepMinutes(s, d).minutes == null
                ? null
                : sleepMinutes(s, d).minutes! / 60
              : (dailyHealth(s, d)?.values[key] ?? null),
          );
          const latest = values.at(-1);
          return (
            <Card key={key} className="trend-card" title={label}>
              <div className="trend-number">
                <b>{latest == null ? "—" : format(latest)}</b>
                <span>{unit}</span>
                <small>
                  {values.filter((x) => x != null).length}/{range} يوم مسجل
                </small>
              </div>
              <Sparkline values={values} color={color} />
            </Card>
          );
        })}
      </div>
      <div className="analysis-grid">
        <Card
          title={
            <>
              <Heart size={17} />
              وراء درجة الجاهزية
            </>
          }
        >
          <div className="readiness-head">
            <strong
              style={{
                color: r.score != null && r.score >= 75 ? "#a5ed77" : "#a998ff",
              }}
            >
              {r.score ?? "—"}
              <small>/100</small>
            </strong>
            <div>
              <b>{r.label}</b>
              <p className="caption">
                {r.baselineDays} أيام سابقة متاحة للخط الأساسي
              </p>
            </div>
          </div>
          {r.parts.map((p) => (
            <div className="factor" key={p.label}>
              <span>
                {p.label}
                <small>{p.detail}</small>
              </span>
              <div>
                <i style={{ width: `${p.score}%` }} />
              </div>
            </div>
          ))}
          {!r.parts.length && (
            <p className="small muted">
              زامن الساعة أو سجّل نومك حتى نبدأ تحليل يومك.
            </p>
          )}
          <button
            className="text-button"
            onClick={() => setShowFormula(!showFormula)}
          >
            <CircleHelp size={15} />
            شلون تنحسب؟
          </button>
          {showFormula && (
            <p className="formula-note">
              نموذج رفيق التجريبي: النوم 40%، HRV مقارنة بمتوسط 14 يوماً سابقاً
              30%، نبض الراحة 20%، إحساسك 10%. نعيد توزيع الأوزان على المكونات
              المتاحة، بشرط مكوّن فسيولوجي بخط أساس 3 أيام ومكوّنين إجمالاً. نحد
              القيم بين 0 و100. هذا النموذج غير مثبت سريرياً، وما يقرر صلاحيتك
              للتمرين.
            </p>
          )}
        </Card>
        <Card
          title={
            <>
              <Moon size={17} />
              هندسة ليلتك
            </>
          }
        >
          <form
            className="sleep-settings"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await change("تعديل هدف النوم", (d) => ({
                  ...d,
                  wellness: {
                    sleepGoal: Number(f.get("hours")),
                    wakeTime: String(f.get("wake")),
                  },
                }))
              )
                notify("تحدّث هدف نومك");
            }}
          >
            <label>
              هدف النوم (ساعة)
              <input
                name="hours"
                type="number"
                min="6"
                max="10"
                step="0.5"
                defaultValue={s.wellness.sleepGoal}
                required
              />
            </label>
            <label>
              وقت الاستيقاظ
              <input
                name="wake"
                type="time"
                defaultValue={s.wellness.wakeTime}
                required
              />
            </label>
            <button className="secondary">حفظ هدف النوم</button>
          </form>
          <div className="sleep-stages">
            {stageInfo.map(([key, label, color]) => {
              const minutes = stages
                .filter((x) => x.stage === key)
                .reduce((sum, x) => sum + x.durationMinutes, 0);
              return (
                <div key={key}>
                  <span style={{ background: color }} />
                  <b>{label}</b>
                  <small>
                    {stages.length ? `${Math.round(minutes)} د` : "—"}
                  </small>
                </div>
              );
            })}
          </div>
          {!stages.length && (
            <p className="caption">
              مراحل النوم تظهر فقط إذا شاركها Samsung Health. لا نستنتجها من مدة
              النوم.
            </p>
          )}
        </Card>
      </div>
      <div className="analysis-grid">
        <Card
          title={
            <>
              <Activity size={17} />
              مناطق النبض
            </>
          }
        >
          <div className="zones">
            {zones.zones.map((m, i) => (
              <div key={i}>
                <span>Z{i + 1}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(m ? 2 : 0, (m / Math.max(...zones.zones, 1)) * 100)}%`,
                      background: [
                        "#6eb7ff",
                        "#69dbc3",
                        "#a5ed77",
                        "#f2c46d",
                        "#fb8e85",
                      ][i],
                    }}
                  />
                </div>
                <b>{Math.round(m)} د</b>
              </div>
            ))}
          </div>
          <p className="caption">
            {Math.round(zones.sampled)} دقيقة مغطاة • أقصى نبض تقديري{" "}
            {zones.max} وفق العمر. هذه المناطق ليست اختباراً لحدودك الفعلية.
          </p>
          {series.length > 1 && (
            <Sparkline
              values={series.slice(-60).map((x) => x.bpm)}
              color="#fb8e85"
            />
          )}
          <p className="caption">
            قراءات نبض محفوظة: {series.length} • الانقطاعات لا تُحسب تدريباً.
          </p>
        </Card>
        <BreathSession />
      </div>
      <Card
        title={
          <>
            <Sparkles size={18} />
            عاداتك، وأثرها المحتمل
          </>
        }
      >
        <div className="habits-grid">
          {habits.map((x) => (
            <div className="habit-insight" key={x.key}>
              <span>{x.label}</span>
              <strong>
                {x.diff == null
                  ? "نجمع بياناتك"
                  : `${x.diff > 0 ? "+" : ""}${x.diff} دقيقة نوم`}
              </strong>
              <p>
                {x.diff == null
                  ? `نحتاج 3 أيام مع العادة و3 بدونها، مرتبطة بنوم الليلة التالية. متوفر ${x.yes} مع / ${x.no} بدون.`
                  : "فرق متوسط النوم التالي بين أيام العادة وغيابها؛ ارتباط وصفي، مو دليل أن العادة سبّبت التغيير."}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
