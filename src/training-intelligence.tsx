import { Activity, ArrowUpLeft, Dumbbell } from "lucide-react";
import { Card, format } from "./components";
import { useApp } from "./app-state";
import { dailyHealth, shiftDay } from "./insights";
export function TrainingIntelligence() {
  const { s, date } = useApp(),
    sets = s.sets.filter((x) => x.date === date),
    cardio = s.cardio.filter((x) => x.date === date);
  const groups = new Map<
    string,
    {
      name: string;
      sets: number;
      reps: number;
      top: number;
      unit: string;
      basis: string;
    }
  >();
  for (const set of sets) {
    const key = [set.exerciseId, set.unit, set.basis].join(":");
    const prev = groups.get(key) ?? {
      name: set.name,
      sets: 0,
      reps: 0,
      top: 0,
      unit: set.unit,
      basis: set.basis,
    };
    groups.set(key, {
      ...prev,
      sets: prev.sets + 1,
      reps: prev.reps + set.reps,
      top: Math.max(prev.top, set.weight),
    });
  }
  const workouts = (dailyHealth(s, date)?.samples ?? []) as {
    dataType?: string;
    workoutType?: string;
    duration?: number;
    startDate?: string;
    endDate?: string;
    totalEnergyBurned?: number;
    sourceName?: string;
    platformId?: string;
  }[];
  const seen = new Set<string>(),
    activities = workouts.filter((x) => {
      if (x.dataType !== "workouts") return false;
      const key =
        x.platformId ?? `${x.sourceName}:${x.startDate}:${x.workoutType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const weekly = Array.from({ length: 7 }, (_, i) => {
      const day = shiftDay(date, i - 6);
      return { day, count: s.sets.filter((x) => x.date === day).length };
    }),
    max = Math.max(1, ...weekly.map((x) => x.count));
  return (
    <section className="training-intelligence">
      <Card
        title={
          <>
            <Dumbbell size={18} />
            حجم التدريب الفعلي
          </>
        }
      >
        <div className="training-summary">
          <div>
            <b>{sets.length}</b>
            <span>جولة مسجلة</span>
          </div>
          <div>
            <b>{sets.reduce((sum, x) => sum + x.reps, 0)}</b>
            <span>تكرار فعلي</span>
          </div>
          <div>
            <b>{cardio.reduce((sum, x) => sum + x.minutes, 0)}</b>
            <span>دقيقة كارديو يدوية</span>
          </div>
        </div>
        <div className="training-week">
          {weekly.map((x) => (
            <div key={x.day}>
              <div>
                <i style={{ height: `${(x.count / max) * 100}%` }} />
              </div>
              <b>{x.count || "—"}</b>
              <span>
                {new Date(x.day + "T12:00:00Z").toLocaleDateString("ar-IQ", {
                  weekday: "short",
                })}
              </span>
            </div>
          ))}
        </div>
        <p className="caption">
          الأيام الخالية تعني عدم وجود جولات مسجلة. الحديد ما يتحول إلى سعرات أو
          «جهد عضلي» مصطنع.
        </p>
      </Card>
      <Card title="أداء تمارينك">
        <div className="exercise-breakdown">
          {[...groups.values()].map((x, i) => (
            <div key={i}>
              <span>
                <b>{x.name}</b>
                <small>
                  {x.sets} جولات · {x.reps} تكرارات ·{" "}
                  {x.basis === "each"
                    ? "لكل يد"
                    : x.basis === "machine"
                      ? "رقم الجهاز"
                      : x.basis === "bodyweight"
                        ? "وزن الجسم"
                        : "وزن كلي"}
                </small>
              </span>
              <strong>
                {x.top}
                <small>{x.unit}</small>
              </strong>
            </div>
          ))}
          {!groups.size && (
            <p className="small muted">
              أول جولة تسجّلها تظهر هنا، بدون خلط وزن كل يد بالوزن الكلي أو
              أوزان الأجهزة.
            </p>
          )}
        </div>
      </Card>
      {activities.length > 0 && (
        <Card
          className="wide-activity"
          title={
            <>
              <Activity size={18} />
              أنشطة شاركها Health Connect
            </>
          }
        >
          {activities.map((x, i) => (
            <div className="activity-timeline" key={i}>
              <span className="timeline-dot" />
              <div>
                <b>{x.workoutType ?? "نشاط"}</b>
                <p>
                  {x.sourceName ?? "Health Connect"} ·{" "}
                  {x.startDate
                    ? new Date(x.startDate).toLocaleTimeString("ar-IQ", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "وقت غير متاح"}
                </p>
              </div>
              <span>
                {x.duration != null ? `${Math.round(x.duration / 60)} د` : "—"}
                <small>
                  {x.totalEnergyBurned == null
                    ? "سعرات غير متاحة"
                    : `${format(x.totalEnergyBurned)} سعرة مسجلة`}
                </small>
              </span>
            </div>
          ))}
          <p className="caption">
            نعرض النشاط كما شاركه مصدره، بدون إضافته مرة ثانية فوق الحرق
            الإجمالي أو التسجيلات اليدوية.
          </p>
        </Card>
      )}
    </section>
  );
}
