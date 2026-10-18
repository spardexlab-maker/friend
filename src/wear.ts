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
const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("water"),
    id: z.string(),
    time: z.string().datetime(),
    ml: z.number().positive().max(10000),
  }),
  z.object({
    type: z.literal("set"),
    id: z.string(),
    time: z.string().datetime(),
    sessionId: z.string(),
    exerciseId: z.string(),
    name: z.string(),
    weight: z.number().min(0).max(2000),
    reps: z.number().int().positive().max(300),
    unit: z.enum(["kg", "lb"]),
    basis: z.enum(["total", "each", "machine", "bodyweight"]),
  }),
]);
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
  }, [s.sessionId, s.plans, s.overrides, s.meals, s.water, s.goals]);
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
          const success = await changed.current(
            "مزامنة تسجيلات الساعة",
            (d) => {
              const next: State = {
                ...d,
                sets: [...d.sets],
                water: [...d.water],
              };
              for (const e of events) {
                const date = dayKey(d.profile.dayStart, new Date(e.time));
                if (
                  e.type === "water" &&
                  !next.water.some((x) => x.id === e.id)
                )
                  next.water.push({
                    id: e.id,
                    date,
                    time: e.time,
                    source: "Galaxy Watch — Data Layer",
                    ml: e.ml,
                  });
                if (e.type === "set" && !next.sets.some((x) => x.id === e.id))
                  next.sets.push({
                    id: e.id,
                    date,
                    time: e.time,
                    source: "Galaxy Watch — Data Layer",
                    sessionId: e.sessionId,
                    exerciseId: e.exerciseId,
                    name: e.name,
                    weight: e.weight,
                    reps: e.reps,
                    unit: e.unit,
                    basis: e.basis,
                    rir: null,
                    notes: "من الساعة؛ RIR غير مسجّل",
                  });
              }
              return next;
            },
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
