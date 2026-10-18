import { useState } from "react";
import {
  Cloud,
  RefreshCw,
  LogOut,
  Upload,
  Check,
  LockKeyhole,
} from "lucide-react";
import { useCloudAuth } from "./cloud-auth";
import { useApp } from "./app-state";
import { Card } from "./components";
import { loadState } from "./storage";
import { supabase } from "./cloud-client";
export function AccountPanel() {
  const auth = useCloudAuth();
  const { s, replace, notify, confirm, syncStatus, syncNow, resolveConflict } =
    useApp();
  const [password, setPassword] = useState("");
  if (!auth.enabled || !auth.user) return null;
  const labels = {
    loading: "نقرأ سجلك السحابي",
    syncing: "نزامن التعديلات",
    synced: "السجل متزامن",
    offline: "بدون اتصال — التعديلات محفوظة بالجهاز",
    error: "المزامنة تحتاج مراجعة",
  };
  return (
    <>
      <Card
        title={
          <>
            <Cloud size={19} />
            حسابك السحابي
          </>
        }
        action={<span className="pill">{labels[syncStatus.phase]}</span>}
      >
        <p className="account-email" dir="ltr">
          {auth.user.email}
        </p>
        <p className="caption">
          {syncStatus.pending} تغييرات بانتظار الرفع • آخر مزامنة:{" "}
          {syncStatus.lastSync
            ? new Date(syncStatus.lastSync).toLocaleString("ar-IQ", {
                timeZone: "Asia/Baghdad",
              })
            : "لم تتم بعد"}
        </p>
        {syncStatus.error && (
          <div className="inline-error">{syncStatus.error}</div>
        )}
        <div className="button-row">
          <button className="secondary" onClick={syncNow}>
            <RefreshCw size={16} />
            زامن هسه
          </button>
          <button
            className="text-button"
            onClick={() =>
              confirm(
                syncStatus.pending
                  ? "عندك تغييرات بعد ما انرفعت. تسجّل خروج وتحفظها لهذا الحساب على الجهاز؟"
                  : "تسجيل خروج من هذا الجهاز؟",
                () => auth.signOut().catch((e) => notify(e.message)),
              )
            }
          >
            <LogOut size={16} />
            تسجيل خروج
          </button>
        </div>
      </Card>
      {syncStatus.conflicts.length > 0 && (
        <Card title="راجع التعارضات">
          {syncStatus.conflicts.map((c) => (
            <div className="conflict" key={c.key}>
              <b dir="ltr">{c.key}</b>
              <div className="compare-grid">
                <div>
                  <h3>تعديل هذا الجهاز</h3>
                  <pre>{JSON.stringify(c.local.payload, null, 2)}</pre>
                </div>
                <div>
                  <h3>النسخة السحابية</h3>
                  <pre>
                    {JSON.stringify(c.remote?.payload ?? null, null, 2)}
                  </pre>
                </div>
              </div>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => resolveConflict(c.key, "local")}
                >
                  اعتمد تعديل هذا الجهاز
                </button>
                <button
                  className="secondary"
                  onClick={() => resolveConflict(c.key, "remote")}
                >
                  اعتمد السحابة
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
      <Card title="استيراد بياناتك الموجودة على هذا الجهاز">
        <p className="small muted">
          ينقل السجلات القديمة إلى هذا الحساب. يدمج السجلات بمعرّفاتها، ويستبدل
          الملف والأهداف والكورس والذاكرة بالنسخة التي تستوردها. السجلات
          السحابية الموجودة تبقى محفوظة.
        </p>
        <button
          className="secondary"
          onClick={() =>
            confirm(
              "تنقل بيانات هذا الجهاز الشخصية إلى الحساب الحالي؟",
              async () => {
                try {
                  const local = await loadState();
                  const merged = {
                    ...s,
                    profile: local.profile,
                    goals: local.goals,
                    plans: local.plans,
                    memory: local.memory || s.memory,
                    wellness: local.wellness,
                    healthHistory: [
                      ...new Map(
                        [...local.healthHistory, ...s.healthHistory].map(
                          (h) => [h.date, h],
                        ),
                      ).values(),
                    ],
                    restDates: [
                      ...new Set([...s.restDates, ...local.restDates]),
                    ],
                  };
                  for (const key of [
                    "meals",
                    "sets",
                    "cardio",
                    "water",
                    "sleep",
                    "weights",
                    "photos",
                    "completed",
                    "messages",
                    "audit",
                    "journal",
                    "checkins",
                    "sensorReadings",
                    "mealTemplates",
                    "trainingDecisions",
                  ] as const) {
                    (merged[key] as unknown[]) = [
                      ...new Map(
                        [...local[key], ...s[key]].map((x) => [x.id, x]),
                      ).values(),
                    ];
                  }
                  await replace(merged);
                  notify("تم تجهيز استيراد السجل؛ راقب حالة المزامنة");
                } catch {
                  notify("تعذر استيراد بيانات هذا الجهاز");
                }
              },
            )
          }
        >
          <Upload size={16} />
          نقل السجل المحلي إلى حسابي
        </button>
      </Card>
      {new URLSearchParams(location.search).has("recovery") && (
        <Card title="كلمة مرور جديدة">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await supabase!.auth.updateUser({ password });
              if (error) notify("تعذر تحديث كلمة المرور");
              else {
                notify("تم تحديث كلمة المرور");
                history.replaceState(null, "", location.pathname);
                setPassword("");
              }
            }}
          >
            <label>
              كلمة المرور الجديدة
              <input
                type="password"
                minLength={10}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary full">حفظ كلمة المرور</button>
          </form>
        </Card>
      )}
    </>
  );
}
