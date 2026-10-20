import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadState, persist } from "./storage";
import { useCloudAuth } from "./cloud-auth";
import { CloudSync, type SyncStatus } from "./cloud-sync";
import {
  initialState,
  logChange,
  stateSchema,
  dayKey,
  type State,
} from "./domain";
type Modal = { kind: string; item?: unknown };
type Store = {
  s: State;
  change: (label: string, fn: (s: State) => State) => Promise<boolean>;
  replace: (s: State) => Promise<boolean>;
  syncStatus: SyncStatus;
  syncNow: () => void;
  resolveConflict: (key: string, choice: "local" | "remote") => void;
  tab: string;
  setTab: (s: string) => void;
  date: string;
  setDate: (s: string) => void;
  modal: Modal | null;
  open: (kind: string, item?: unknown) => void;
  close: () => void;
  notify: (s: string) => void;
  confirm: (label: string, action: () => void) => void;
};
const Context = createContext<Store>(null!);
export const useApp = () => useContext(Context);
export function Provider({ children }: { children: ReactNode }) {
  const { user, enabled } = useCloudAuth();
  const owner = enabled ? user?.id : undefined;
  const engine = useRef<CloudSync | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    phase: owner ? "loading" : "synced",
    pending: 0,
    conflicts: [],
    lastSync: "",
    error: "",
  });
  const [s, setS] = useState<State>(initialState);
  const ref = useRef(s);
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState("");
  const [tab, setTab] = useState("home");
  const [date, setDate] = useState(
    s.meals.at(-1)?.date ??
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Baghdad",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
  );
  const [modal, setModal] = useState<Modal | null>(null);
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState<{
    label: string;
    action: () => void;
  } | null>(null);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    const watchdog = setTimeout(() => {
      if (alive) setFatal("فتح السجل المحلي أخذ وقت أطول من المعتاد. بياناتك ما انمسحت؛ أغلق التطبيق وافتحه مرة ثانية. لا تمسح بيانات التطبيق.");
    }, 15000);
    loadState(owner)
      .then(async (x) => {
        if (alive) {
          ref.current = x;
          setS(x);
          setDate(dayKey(x.profile.dayStart));
          if (owner) {
            const sync = new CloudSync(
              owner,
              x,
              (next) => {
                if (alive) {
                  ref.current = next;
                  setS(next);
                }
              },
              (status) => alive && setSyncStatus(status),
            );
            engine.current = sync;
            await sync.initialize(() => {
              if (alive) {
                clearTimeout(watchdog);
                setFatal("");
                setReady(true);
              }
            });
          }
          if (!alive) return;
          clearTimeout(watchdog);
          setFatal("");
          setReady(true);
        }
      })
      .catch(() =>
        setFatal(
          "تعذر فتح السجل المحلي. بياناتك الحالية ما انمسحت. جرّب إعادة فتح التطبيق أو استعادة نسخة احتياطية بعد معالجة مساحة الجهاز.",
        ),
      );
    return () => {
      alive = false;
      clearTimeout(watchdog);
      engine.current?.stop();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let current = dayKey(s.profile.dayStart);
    const timer = setInterval(() => {
      const next = dayKey(ref.current.profile.dayStart);
      if (next !== current) {
        setDate((d) => (d === current ? next : d));
        current = next;
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [ready, s.profile.dayStart]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const install = (next: State) => {
    const valid = stateSchema.parse(next);
    const previous = ref.current;
    ref.current = valid;
    setS(valid);
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        await persist(valid, owner);
        await engine.current?.capture(previous, valid);
      })
      .catch(() => {
        if (ref.current === valid) {
          ref.current = previous;
          setS(previous);
        }
        setToast(
          "تعذر الحفظ. أبقِ التطبيق مفتوحاً وتأكد من مساحة الجهاز قبل إغلاقه.",
        );
        throw Error("save failed");
      });
    return queue.current.then(
      () => true,
      () => false,
    );
  };
  const change = (label: string, fn: (s: State) => State) => {
    try {
      const next = fn(ref.current);
      return install(logChange(ref.current, next, label));
    } catch {
      setToast("القيم غير صحيحة؛ التغيير ما انحفظ. راجع الحقول.");
      return Promise.resolve(false);
    }
  };
  return (
    <Context.Provider
      value={{
        s,
        change,
        replace: install,
        syncStatus,
        syncNow: () => void engine.current?.run(),
        resolveConflict: (key, choice) =>
          void engine.current?.resolve(key, choice),
        tab,
        setTab,
        date,
        setDate,
        modal,
        open: (kind, item) => setModal({ kind, item }),
        close: () => setModal(null),
        notify: setToast,
        confirm: (label, action) => setPending({ label, action }),
      }}
    >
      {fatal ? (
        <div className="load-screen">
          <h2>نحتاج نراجع الحفظ</h2>
          <p>{fatal}</p>
          <button className="primary" onClick={() => location.reload()}>
            إعادة المحاولة
          </button>
        </div>
      ) : ready ? (
        children
      ) : (
        <div className="load-screen">
          <span className="loader" />
          <h2>نرتّب مساحتك…</h2>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {pending && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="alertdialog"
            aria-label="تأكيد التغيير"
          >
            <h2>{pending.label}</h2>
            <p>
              سيبقى أثر التغيير في سجل التعديلات، إلا عند مسح البيانات بالكامل.
            </p>
            <div className="button-row">
              <button
                className="danger"
                onClick={() => {
                  pending.action();
                  setPending(null);
                }}
              >
                تأكيد
              </button>
              <button className="secondary" onClick={() => setPending(null)}>
                إلغاء
              </button>
            </div>
          </section>
        </div>
      )}
    </Context.Provider>
  );
}
