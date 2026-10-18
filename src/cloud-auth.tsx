import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { Activity, Cloud, LockKeyhole, Mail } from "lucide-react";
import { cloudEnabled, supabase } from "./cloud-client";
type CloudAuth = {
  user: User | null;
  loading: boolean;
  enabled: boolean;
  signOut: () => Promise<void>;
};
const Context = createContext<CloudAuth>({
  user: null,
  loading: false,
  enabled: false,
  signOut: async () => {},
});
export const useCloudAuth = () => useContext(Context);
export function CloudProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(cloudEnabled);
  useEffect(() => {
    if (!cloudEnabled || !supabase) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setUser(data.session?.user ?? null);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        loading,
        enabled: cloudEnabled,
        signOut: async () => {
          if (!supabase) return;
          const { error } = await supabase.auth.signOut({ scope: "local" });
          if (error) throw Error("تعذر تسجيل الخروج؛ جرّب مرة ثانية");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, enabled } = useCloudAuth();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  if (!enabled) return children;
  if (loading)
    return (
      <div className="load-screen">
        <span className="loader" />
        <h2>نفتح حسابك…</h2>
      </div>
    );
  if (user) return children;
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <span className="brand-icon">
          <Activity />
        </span>
        <span className="eyebrow">رفيق • مساحتك الرياضية</span>
        <h1>
          كل تفاصيلك.
          <br />
          معاك وين ما تروح.
        </h1>
        <p>
          أكلك، تمرينك، صور تطورك، وكلامك مع رفيق.
          <br />
          حساب واحد يجمع رحلتك ويحفظها إلك.
        </p>
        <div className="auth-features">
          <span>
            <Cloud size={19} />
            مزامنة بين أجهزتك
          </span>
          <span>
            <LockKeyhole size={19} />
            صور وسجلات خاصة
          </span>
        </div>
      </section>
      <section className="auth-form card">
        <span className="eyebrow">خطوة جديدة باتجاهك</span>
        <h2>{signup ? "خلّينا نبدأ رحلتك." : "هلا بيك من جديد."}</h2>
        <p className="muted small">
          {signup
            ? "سوّ حسابك حتى تبقى تفاصيلك محفوظة."
            : "سجّل دخولك ونكمل من المكان اللي وقفنا بيه."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!supabase) return;
            setBusy(true);
            setMessage("");
            setError("");
            try {
              if (signup) {
                const { data, error } = await supabase.auth.signUp({
                  email: email.trim(),
                  password,
                  options: {
                    emailRedirectTo: "https://friend-delta-blue.vercel.app/",
                  },
                });
                if (error) throw error;
                if (!data.session)
                  setMessage(
                    "وصلتك رسالة تأكيد على بريدك. افتحها وبعدها سجّل دخولك.",
                  );
              } else {
                const { error } = await supabase.auth.signInWithPassword({
                  email: email.trim(),
                  password,
                });
                if (error) throw error;
              }
            } catch (e) {
              const code = (e as { code?: string }).code;
              setError(
                code === "invalid_credentials"
                  ? "البريد أو كلمة المرور غير صحيحة"
                  : code === "email_not_confirmed"
                    ? "أكّد بريدك من الرسالة أولاً"
                    : code === "over_email_send_rate_limit"
                      ? "انتظر قبل طلب رسالة جديدة"
                      : code === "weak_password"
                        ? "اختار كلمة مرور أقوى"
                        : "تعذر إكمال الدخول. راجع الاتصال وإعدادات البريد في Supabase.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            البريد الإلكتروني
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              dir="ltr"
            />
          </label>
          <label>
            كلمة المرور
            <input
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={signup ? 10 : 1}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              dir="ltr"
            />
          </label>
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <p className="info-note" role="status">
              {message}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "لحظة…" : signup ? "إنشاء حساب" : "دخول لمساحتك"}
          </button>
        </form>
        <button
          className="text-button auth-switch"
          onClick={() => {
            setSignup(!signup);
            setError("");
            setMessage("");
          }}
        >
          {signup ? "عندك حساب؟ سجّل دخولك" : "أول مرة؟ سوّ حسابك"}
        </button>
        <button
          className="text-button"
          disabled={!email || busy}
          onClick={async () => {
            if (!supabase) return;
            setBusy(true);
            const { error } = await supabase.auth.resetPasswordForEmail(
              email.trim(),
              {
                redirectTo: "https://friend-delta-blue.vercel.app/?recovery=1",
              },
            );
            setBusy(false);
            if (error) setError("تعذر إرسال رابط استعادة كلمة المرور");
            else setMessage("إذا البريد مسجّل، تصلك رسالة الاستعادة.");
          }}
        >
          نسيت كلمة المرور؟
        </button>
        <p className="caption">
          بيانات الجهاز السابقة تبقى منفصلة إلى أن تختار استيرادها لحسابك.
        </p>
      </section>
    </main>
  );
}
