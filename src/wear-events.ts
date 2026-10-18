import { z } from "zod";
import { dayKey, type State } from "./domain";
export const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meal"),
    id: z.string(),
    time: z.string().datetime(),
    name: z.string().min(1).max(300),
    grams: z.number().min(0).max(20000),
    kcal: z.number().min(0).max(20000),
    protein: z.number().min(0).max(2000),
    carbs: z.number().min(0).max(2000),
    fat: z.number().min(0).max(2000),
    preparation: z.string().max(1000),
    original: z.string().max(2000),
  }),
  z.object({
    type: z.literal("foodDraft"),
    id: z.string(),
    time: z.string().datetime(),
    name: z.string().min(1).max(300),
    grams: z.number().min(0).max(20000).nullable(),
    preparation: z.string().max(1000),
    original: z.string().max(2000),
  }),
  z.object({
    type: z.literal("heart"),
    id: z.string(),
    time: z.string().datetime(),
    bpm: z.number().min(25).max(240),
    accuracy: z.number().min(1).max(3),
  }),
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
export function mergeWearEvents(
  d: State,
  events: z.infer<typeof eventSchema>[],
) {
  const next: State = {
    ...d,
    sets: [...d.sets],
    water: [...d.water],
    sensorReadings: [...d.sensorReadings],
    meals: [...d.meals],
    pendingFoods: [...d.pendingFoods],
    wearReceipts: [...d.wearReceipts],
  };
  for (const e of events) {
    if (next.wearReceipts.includes(e.id)) continue;
    next.wearReceipts.push(e.id);
    const date = dayKey(d.profile.dayStart, new Date(e.time));
    if (e.type === "heart" && !next.sensorReadings.some((x) => x.id === e.id))
      next.sensorReadings.push({
        id: e.id,
        date,
        time: e.time,
        bpm: e.bpm,
        accuracy: e.accuracy,
        source: "Galaxy Watch — حساس النبض",
      });
    if (e.type === "water" && !next.water.some((x) => x.id === e.id))
      next.water.push({
        id: e.id,
        date,
        time: e.time,
        source: "Galaxy Watch — Data Layer",
        ml: e.ml,
      });
    if (e.type === "set" && !next.sets.some((x) => x.id === e.id)) {
      const { type: _, ...values } = e;
      next.sets.push({
        ...values,
        date,
        source: "Galaxy Watch — Data Layer",
        rir: null,
        notes: "من الساعة؛ RIR غير مسجّل",
      });
    }
    if (e.type === "meal" && !next.meals.some((x) => x.id === e.id)) {
      const { type: _, ...values } = e;
      next.meals.push({
        ...values,
        date,
        source: "Galaxy Watch — مراجعة على الساعة",
      });
    }
    if (
      e.type === "foodDraft" &&
      !next.pendingFoods.some((x) => x.id === e.id) &&
      !next.meals.some((x) => x.id === e.id)
    ) {
      const { type: _, ...values } = e;
      next.pendingFoods.push({
        ...values,
        date,
        source: "Galaxy Watch — يحتاج مراجعة",
      });
    }
  }
  return next;
}
