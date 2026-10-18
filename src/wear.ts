import { eventSchema, mergeWearEvents } from "./wear-events";
import { recovery, dailyHealth } from "./insights";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { useApp } from "./app-state";
import { dayKey, nutrition, type State } from "./domain";
type WearBridge = {
  publish: (o: { json: string }) => Promise<void>;
  pending: () => Promise<{ json: string }>;
  acknowledge: (o: { ids: string }) => Promise<void>;
};
const bridge = registerPlugin<WearBridge>("WearBridge");
function watchFood(
  m: Pick<
    State["meals"][number],
    "name" | "grams" | "preparation" | "kcal" | "protein" | "carbs" | "fat"
  > & { id?: string },
) {
  return {
    id: m.id,
    name: m.name.slice(0, 120),
    grams: m.grams,
    preparation: m.preparation.slice(0, 160),
    kcal: m.kcal,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
  };
}
export function useWearSync() {
  const { s, change, notify } = useApp();
  const ref = useRef(s);
  ref.current = s;
  const busy = useRef(false);
  const changed = useRef(change);
  changed.current = change;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const t = setTimeout(() => {
      const d = ref.current,
        day = dayKey(d.profile.dayStart);
      bridge
        .publish({
          json: JSON.stringify({
            foodTemplates: d.mealTemplates
              .filter((x) => x.enabled)
              .slice(0, 20)
              .map((x) => watchFood({ ...x.meal, id: x.id })),
            recentFoods: [
              ...new Map(
                [...d.meals]
                  .reverse()
                  .map((m) => [
                    JSON.stringify([
                      m.name,
                      m.grams,
                      m.preparation,
                      m.kcal,
                      m.protein,
                      m.carbs,
                      m.fat,
                    ]),
                    m,
                  ]),
              ).values(),
            ]
              .slice(0, 10)
              .map(watchFood),
            foodPendingCount: d.pendingFoods.length,
            readiness: recovery(d, day).score ?? -1,
            sleepPercent:
              recovery(d, day).sleep.minutes == null
                ? 0
                : Math.min(
                    100,
                    (recovery(d, day).sleep.minutes! /
                      (d.wellness.sleepGoal * 60)) *
                      100,
                  ),
            sleepHours:
              recovery(d, day).sleep.minutes == null
                ? undefined
                : (recovery(d, day).sleep.minutes! / 60).toFixed(1),
            hrv: dailyHealth(d, day)?.values.heartRateVariability ?? undefined,
            name: d.plans[d.session].name,
            sessionId: d.sessionId,
            exercises: d.overrides[d.sessionId] ?? d.plans[d.session].exercises,
            kcal: nutrition(d.meals.filter((x) => x.date === day)).kcal,
            goal: d.restDates.includes(day) ? d.goals.restKcal : d.goals.kcal,
            water: d.water
              .filter((x) => x.date === day)
              .reduce((a, x) => a + x.ml, 0),
          }),
        })
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [
    s.sessionId,
    s.plans,
    s.overrides,
    s.meals,
    s.water,
    s.goals,
    s.health,
    s.healthHistory,
    s.sleep,
    s.checkins,
    s.wellness,
    s.mealTemplates,
    s.pendingFoods,
  ]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    async function poll() {
      if (busy.current) return;
      busy.current = true;
      try {
        const { json } = await bridge.pending();
        const raw = JSON.parse(json);
        const events = (Array.isArray(raw) ? raw : [])
          .map((x) => eventSchema.safeParse(x))
          .filter((x) => x.success)
          .map((x) => x.data!);
        if (events.length) {
          const success = await changed.current("مزامنة تسجيلات الساعة", (d) =>
            mergeWearEvents(d, events),
          );
          if (success)
            await bridge.acknowledge({
              ids: JSON.stringify(events.map((e) => e.id)),
            });
        }
      } catch {
      } finally {
        busy.current = false;
      }
    }
    poll();
    const t = setInterval(poll, 12000);
    return () => clearInterval(t);
  }, []);
}
