import { z } from "zod";
import { initialPlans } from "./seed";
export const id = () => crypto.randomUUID();
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const num = (max = 100000) => z.number().finite().min(0).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const n = Date.parse(value + "T12:00:00Z");
    return (
      Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value
    );
  }, "تاريخ غير صالح");
const base = { id: z.string(), date, time: z.string(), source: z.string() };
export const mealSchema = z.object({
  ...base,
  name: z.string().min(1).max(300),
  kcal: num(20000),
  protein: num(2000),
  carbs: num(2000),
  fat: num(2000),
  grams: num(20000),
  preparation: z.string(),
  original: z.string(),
});
export const exerciseSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  english: z.string(),
  weight: num(2000),
  sets: num(50),
  reps: z.string(),
  rest: num(3600),
  unit: z.enum(["kg", "lb"]),
  basis: z.enum(["total", "each", "machine", "bodyweight"]),
});
export const setSchema = z.object({
  ...base,
  sessionId: z.string(),
  exerciseId: z.string(),
  name: z.string(),
  weight: num(2000),
  reps: num(300),
  unit: z.enum(["kg", "lb"]),
  basis: z.enum(["total", "each", "machine", "bodyweight"]),
  rir: num(20).nullable(),
  notes: z.string(),
});
const cardioSchema = z.object({
  ...base,
  name: z.string(),
  minutes: num(1440),
  kcal: num(20000),
  distance: num(1000),
  notes: z.string(),
});
const photoSchema = z.object({
  ...base,
  pose: z.string(),
  weight: num(400),
  notes: z.string(),
  data: z.string().max(6000000),
});
export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  time: z.string(),
  proposal: z.unknown().optional(),
  applied: z.boolean().optional(),
  relatedFoodId: z.string().optional(),
});
export const healthSchema = z.object({
  metadata: z
    .record(
      z.string(),
      z.object({
        status: z.enum(["available", "missing", "denied", "error"]),
        source: z.string().optional(),
        time: z.string().optional(),
        method: z.string().optional(),
        count: z.number().optional(),
      }),
    )
    .optional(),
  syncedAt: z.string(),
  date: z.string(),
  values: z.record(z.string(), z.number().nullable()),
  samples: z.array(z.unknown()),
  errors: z.array(z.string()),
});
export const stateSchema = z.object({
  version: z.literal(2),
  profile: z.object({
    name: z.string(),
    height: z.number().min(80).max(250),
    age: z.number().min(18).max(110),
    sex: z.enum(["male", "female"]),
    activity: z.number().min(1).max(2.5),
    dayStart: num(23),
    notes: z.string(),
  }),
  goals: z.object({
    kcal: z.number().positive().max(20000),
    restKcal: z.number().positive().max(20000),
    protein: z.number().positive().max(1000),
    carbs: num(2000),
    fat: num(1000),
    water: num(20000),
  }),
  journal: z
    .array(
      z.object({
        ...base,
        title: z.string(),
        text: z.string(),
        category: z.string(),
      }),
    )
    .default([]),
  wearReceipts: z.array(z.string()).default([]),
  pendingFoods: z
    .array(
      z.object({
        ...base,
        name: z.string().min(1).max(300),
        grams: num(20000).nullable(),
        preparation: z.string().max(1000),
        original: z.string().max(2000),
      }),
    )
    .default([]),
  mealTemplates: z
    .array(
      z.object({
        id: z.string(),
        meal: mealSchema.omit({
          id: true,
          date: true,
          time: true,
          source: true,
        }),
        days: z.array(z.number().int().min(0).max(6)),
        enabled: z.boolean(),
      }),
    )
    .default([]),
  trainingDecisions: z
    .array(
      z.object({
        ...base,
        status: z.enum(["rest", "postponed", "skipped"]),
        sessionId: z.string(),
        name: z.string(),
        reason: z.string(),
        nextDate: date.optional(),
      }),
    )
    .default([]),
  restDates: z.array(date),
  meals: z.array(mealSchema),
  sets: z.array(setSchema),
  cardio: z.array(cardioSchema),
  water: z.array(z.object({ ...base, ml: num(10000) })),
  sleep: z.array(
    z.object({
      ...base,
      start: z.string(),
      end: z.string(),
      quality: num(5),
      notes: z.string(),
    }),
  ),
  weights: z.array(
    z.object({
      ...base,
      value: z.number().min(20).max(400),
      waist: num(300),
      neck: num(100),
      notes: z.string(),
    }),
  ),
  photos: z.array(photoSchema),
  plans: z
    .array(z.object({ name: z.string(), exercises: z.array(exerciseSchema) }))
    .length(5),
  session: z.number().int().min(0).max(4),
  sessionId: z.string(),
  overrides: z.record(z.string(), z.array(exerciseSchema)),
  completed: z.array(
    z.object({ id: z.string(), name: z.string(), time: z.string() }),
  ),
  messages: z.array(messageSchema),
  memory: z.string().max(500000),
  audit: z.array(
    z.object({
      id: z.string(),
      time: z.string(),
      label: z.string(),
      before: z.string(),
      after: z.string(),
    }),
  ),
  health: healthSchema,
  healthHistory: z.array(healthSchema).default([]),
  wellness: z
    .object({
      sleepGoal: z.number().min(6).max(10),
      wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .default({ sleepGoal: 8, wakeTime: "07:00" }),
  checkins: z
    .array(
      z.object({
        ...base,
        energy: z.number().int().min(1).max(5),
        soreness: z.number().int().min(1).max(5),
        stress: z.number().int().min(1).max(5),
        caffeineLate: z.boolean(),
        lateMeal: z.boolean(),
        notes: z.string().max(2000),
      }),
    )
    .default([]),
  sensorReadings: z
    .array(
      z.object({
        id: z.string(),
        date,
        time: z.string(),
        bpm: z.number().min(25).max(240),
        accuracy: z.number(),
        source: z.string(),
      }),
    )
    .default([]),
  settings: z.object({
    apiUrl: z.string(),
    token: z.string(),
    consent: z.boolean(),
    model: z.string(),
  }),
});
export type State = z.infer<typeof stateSchema>;
export type Meal = z.infer<typeof mealSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type SetEntry = z.infer<typeof setSchema>;
export type Message = z.infer<typeof messageSchema>;
export const stamp = (date = today(), source = "يدوي") => ({
  id: id(),
  date,
  time: new Date().toISOString(),
  source,
});
export function initialState(): State {
  return {
    version: 2,
    profile: {
      name: "رفيقي",
      height: 170,
      age: 30,
      sex: "male",
      activity: 1.375,
      dayStart: 0,
      notes:
        "أدخل بياناتك وأهدافك من الإعدادات. اسأل عن التفاصيل الناقصة ولا تكرر سؤالاً مجاباً.",
    },
    goals: {
      kcal: 1850,
      restKcal: 1730,
      protein: 180,
      carbs: 160,
      fat: 55,
      water: 3500,
    },
    healthHistory: [],
    checkins: [],
    sensorReadings: [],
    wellness: { sleepGoal: 8, wakeTime: "07:00" },
    wearReceipts: [],
    pendingFoods: [],
    mealTemplates: [],
    trainingDecisions: [],
    journal: [],
    restDates: [],
    meals: [],
    sets: [],
    cardio: [],
    water: [],
    sleep: [],
    weights: [],
    photos: [],
    plans: initialPlans.map((list, i) => ({
      name: ["Push", "Pull", "Legs", "Upper", "Lower"][i],
      exercises: list.map(([name, english, weight, sets, reps], j) => ({
        id: id(),
        name: String(name).replace(" · باوند", ""),
        english: String(english),
        weight: 0,
        sets: Number(sets),
        reps: String(reps),
        rest: [
          [150, 120, 120, 60, 75, 60],
          [120, 150, 90, 60, 90, 60],
          [180, 150, 120, 90, 60, 60],
          [120, 90, 90, 75, 90, 60, 60, 60, 60],
          [150, 90, 90, 60, 60, 60],
        ][i][j],
        unit: String(name).includes("باوند") ? "lb" : "kg",
        basis: String(name).includes("دمبل")
          ? "each"
          : String(english).includes("Bulgarian")
            ? "bodyweight"
            : "total",
      })),
    })),
    session: 0,
    sessionId: id(),
    overrides: {},
    completed: [],
    messages: [],
    memory: "",
    audit: [],
    health: { syncedAt: "", date: "", values: {}, samples: [], errors: [] },
    settings: { apiUrl: "", token: "", consent: false, model: "" },
  };
}
export function logChange(s: State, next: State, label: string): State {
  const before: Record<string, unknown> = {},
    after: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof State)[]) {
    if (key === "audit") continue;
    let a: unknown = s[key],
      b: unknown = next[key];
    if (key === "settings") {
      a = { ...s.settings, token: "[مستثنى]" };
      b = { ...next.settings, token: "[مستثنى]" };
    }
    if (key === "photos") {
      a = s.photos.map(({ data: _, ...p }) => p);
      b = next.photos.map(({ data: _, ...p }) => p);
    }
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (
      Array.isArray(a) &&
      Array.isArray(b) &&
      [...a, ...b].every((x) => x && typeof x === "object" && "id" in x)
    ) {
      const oldMap = new Map(a.map((x) => [x.id, x])),
        newMap = new Map(b.map((x) => [x.id, x]));
      const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
      const changed = [...ids].filter(
        (id) =>
          JSON.stringify(oldMap.get(id)) !== JSON.stringify(newMap.get(id)),
      );
      before[key] = changed.map((id) => oldMap.get(id) ?? { id, absent: true });
      after[key] = changed.map((id) => newMap.get(id) ?? { id, absent: true });
    } else {
      before[key] = a;
      after[key] = b;
    }
  }
  return {
    ...next,
    audit: [
      ...s.audit,
      {
        id: id(),
        time: new Date().toISOString(),
        label,
        before: JSON.stringify(before),
        after: JSON.stringify(after),
      },
    ],
  };
}
export function nutrition(meals: Meal[]) {
  return meals.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
export function bodyMetrics(s: State) {
  const weight = [...s.weights]
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    )
    .at(-1)?.value;
  if (!weight) return null;
  const bmr =
    10 * weight +
    6.25 * s.profile.height -
    5 * s.profile.age +
    (s.profile.sex === "male" ? 5 : -161);
  return {
    weight,
    bmi: weight / (s.profile.height / 100) ** 2,
    bmr,
    tdee: bmr * s.profile.activity,
  };
}
export function dayKey(hour = 0, now = new Date()) {
  return new Date(now.getTime() + (3 - hour) * 3600000)
    .toISOString()
    .slice(0, 10);
}
export function mealFromProposal(input: unknown, day: string): Meal {
  const candidate = z
    .object({
      name: z.string().min(1),
      kcal: num(20000),
      protein: num(2000),
      carbs: num(2000),
      fat: num(2000),
      grams: num(20000),
      preparation: z.string(),
    })
    .parse(input);
  return {
    ...stamp(day, "تقدير AI — مؤكد منك"),
    ...candidate,
    original: JSON.stringify(input),
  };
}
