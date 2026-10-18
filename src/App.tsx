import { useHealthRefresh } from "./health-refresh";
import { cloudEnabled } from "./cloud-client";
import {
  Activity,
  House,
  Utensils,
  Dumbbell,
  TrendingUp,
  MessageCircle,
  Heart,
  Settings2,
  ChevronLeft,
  Plus,
  Watch,
  CalendarDays,
} from "lucide-react";
import { useApp } from "./app-state";
import {
  Dashboard,
  FoodPage,
  WorkoutPage,
  ProgressPage,
  HealthPage,
  ChatPage,
  SettingsPage,
} from "./pages";
import { useWearSync } from "./wear";
import { PrintDocument } from "./print";
import { Forms } from "./forms";
import { dayKey, today } from "./domain";
const nav = [
  { id: "home", label: "يومي", icon: House },
  { id: "food", label: "تغذيتي", icon: Utensils },
  { id: "workout", label: "تمريني", icon: Dumbbell },
  { id: "progress", label: "تقدمي", icon: TrendingUp },
  { id: "chat", label: "رفيقي", icon: MessageCircle },
];
export function App() {
  useWearSync();
  useHealthRefresh();
  const { s, tab, setTab, date, setDate, open } = useApp();
  const current = [
    ...nav,
    { id: "health", label: "صحتي", icon: Heart },
    { id: "settings", label: "الإعدادات", icon: Settings2 },
  ].find((n) => n.id === tab);
  const title =
    tab === "home"
      ? "يوم جديد، خطوة أقرب."
      : tab === "food"
        ? "أكلك، بكل تفاصيله."
        : tab === "workout"
          ? "قوّتك تتراكم."
          : tab === "progress"
            ? "شوف المسافة اللي قطعتها."
            : tab === "chat"
              ? "احچي، رفيقك يسمعك."
              : tab === "health"
                ? "جسمك يحچي، خلّينا نسمعه."
                : "مساحتك، على طريقتك.";
  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setTab("home")}>
          <span className="brand-icon">
            <Activity />
          </span>
          <span>
            رفيق<span className="brand-sub">خطوة إلك. كل يوم.</span>
          </span>
        </button>
        <div className="space-label">مساحتك الشخصية</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "nav active" : "nav"}
              onClick={() => setTab(n.id)}
            >
              <n.icon size={21} />
              {n.label}
              {n.id === "chat" && <span className="ai-tag">AI</span>}
            </button>
          ))}
          <button
            className={tab === "health" ? "nav active" : "nav"}
            onClick={() => setTab("health")}
          >
            <Heart size={21} />
            صحتي والساعة
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button
            className="device full-width"
            onClick={() => setTab("health")}
          >
            <Watch size={22} />
            <div>
              Galaxy Watch 6
              <small>
                {s.health.syncedAt ? "راجع آخر مزامنة" : "ربط Health Connect"}
              </small>
            </div>
            <span className="dot" />
          </button>
          <button className="profile" onClick={() => setTab("settings")}>
            <span className="avatar">{s.profile.name[0]}</span>
            <span>
              {s.profile.name}
              <span className="muted small block">رحلة أقوى، كل يوم</span>
            </span>
            <Settings2 size={18} />
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            مساحتك <ChevronLeft size={14} />
            {current?.label}
          </div>
          <div className="header-actions">
            <span className="local-badge">
              <span />
              {cloudEnabled ? "حساب سحابي • الحالة بالإعدادات" : "محفوظ محلياً"}
            </span>
            <button
              className="icon-button"
              aria-label="صحتي والساعة"
              onClick={() => setTab("health")}
            >
              <Watch size={20} />
            </button>
            <button
              className="avatar small-avatar"
              aria-label="الإعدادات"
              onClick={() => setTab("settings")}
            >
              {s.profile.name[0]}
            </button>
          </div>
        </header>
        <div className="content" key={tab}>
          <div className="intro">
            <div>
              <div className="eyebrow">
                {new Intl.DateTimeFormat("ar-IQ", {
                  timeZone: "Asia/Baghdad",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(`${date}T12:00:00+03:00`))}
              </div>
              <h1>{title}</h1>
              <p>
                {tab === "home"
                  ? `هلا ${s.profile.name}، خلّينا نرتّب يومك على راحتك.`
                  : tab === "workout"
                    ? "حسب ظروفك. نكمل من المكان اللي وقفنا بيه."
                    : tab === "chat"
                      ? "التفاصيل اللي تحچيها تنحفظ، والتسجيل يبقى بإيدك."
                      : "كل تفصيل إله مكان، وكل خطوة تنحسب."}
              </p>
            </div>
            {["home", "food", "workout", "progress"].includes(tab) && (
              <button
                className="primary"
                onClick={() =>
                  open(
                    tab === "workout"
                      ? "exercise"
                      : tab === "progress"
                        ? "weight"
                        : "meal",
                  )
                }
              >
                <Plus size={18} />
                {tab === "workout"
                  ? "أضف تمرين"
                  : tab === "progress"
                    ? "سجّل وزنك"
                    : "سجّل وجبة"}
              </button>
            )}
          </div>
          {["home", "food", "workout", "health"].includes(tab) && (
            <div className="date-toolbar">
              <CalendarDays size={16} />
              <label htmlFor="record-date">يوم السجل</label>
              <input
                id="record-date"
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              <button onClick={() => setDate(dayKey(s.profile.dayStart))}>
                يومي الحالي
              </button>
              {date !== today() && (
                <span className="caption">
                  تستعرض يوماً مختلفاً عن تاريخ اليوم
                </span>
              )}
            </div>
          )}
          {tab === "home" ? (
            <Dashboard />
          ) : tab === "food" ? (
            <FoodPage />
          ) : tab === "workout" ? (
            <WorkoutPage />
          ) : tab === "progress" ? (
            <ProgressPage />
          ) : tab === "chat" ? (
            <ChatPage />
          ) : tab === "health" ? (
            <HealthPage />
          ) : (
            <SettingsPage />
          )}
          <footer>
            <span>
              رفيق <span className="footer-dot">·</span>على راحتك، باتجاه هدفك.
            </span>
            <span>
              {cloudEnabled
                ? "سجلك السحابي • Gemini"
                : "بياناتك محلياً • Gemini حسب إعداد الاتصال"}
            </span>
          </footer>
        </div>
      </main>
      <nav className="mobile-nav">
        {nav.map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? "active" : ""}
            onClick={() => setTab(n.id)}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <Forms />
      <PrintDocument />
    </div>
  );
}
