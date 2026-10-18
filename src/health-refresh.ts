import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useApp } from "./app-state";
import { dayKey } from "./domain";
import { syncHealth } from "./native";
export function useHealthRefresh() {
  const { s, change } = useApp(),
    ref = useRef(s),
    save = useRef(change),
    busy = useRef(false);
  ref.current = s;
  save.current = change;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    async function refresh() {
      if (
        busy.current ||
        document.visibilityState === "hidden" ||
        !ref.current.health.syncedAt ||
        Date.now() - Date.parse(ref.current.health.syncedAt) < 15 * 60000
      )
        return;
      busy.current = true;
      try {
        const health = await syncHealth(dayKey(ref.current.profile.dayStart));
        await save.current("تحديث صحي عند فتح التطبيق", (d) => ({
          ...d,
          health,
          healthHistory: [
            ...d.healthHistory.filter((x) => x.date !== health.date),
            health,
          ],
        }));
      } catch {
      } finally {
        busy.current = false;
      }
    }
    void refresh();
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
}
