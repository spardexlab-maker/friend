import { initialState, stateSchema, type State } from "./domain";
export type Document = {
  key: string;
  payload: unknown;
  version: number;
  deleted: boolean;
};
export type Change = {
  key: string;
  payload: unknown;
  deleted: boolean;
  expected_version: number;
};
const lists = [
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
] as const;
export function flatten(s: State) {
  const out: Record<string, unknown> = {
    profile: s.profile,
    goals: s.goals,
    memory: s.memory,
    wellness: s.wellness,
    currentSession: { session: s.session, sessionId: s.sessionId },
  };
  for (const list of lists)
    for (const value of s[list])
      out[`${list}:${value.id}`] =
        list === "photos"
          ? (({ data: _, ...meta }) => meta)(value as State["photos"][number])
          : value;
  s.plans.forEach((p, i) => (out[`plans:${i}`] = p));
  Object.entries(s.overrides).forEach(
    ([key, value]) => (out[`overrides:${key}`] = value),
  );
  s.restDates.forEach((date) => (out[`restDates:${date}`] = date));
  for (const h of s.healthHistory) if (h.date) out[`health:${h.date}`] = h;
  if (s.health.date) out[`health:${s.health.date}`] = s.health;
  return out;
}
export function freshCloudState() {
  const s = initialState();
  s.profile = {
    name: "حسابي",
    height: 170,
    age: 30,
    sex: "male",
    activity: 1.2,
    dayStart: 0,
    notes: "",
  };
  s.weights = [];
  s.plans = s.plans.map((p) => ({
    ...p,
    exercises: p.exercises.map((e) => ({ ...e, weight: 0 })),
  }));
  return s;
}
export function hydrate(
  base: State,
  documents: Document[],
  photoData: Record<string, string> = {},
) {
  const s: State = {
    ...base,
    meals: [],
    sets: [],
    cardio: [],
    water: [],
    sleep: [],
    weights: [],
    photos: [],
    completed: [],
    messages: [],
    audit: [],
    journal: [],
    checkins: [],
    sensorReadings: [],
    healthHistory: [],
    overrides: {},
    restDates: [],
  };
  const knownPhotos = new Map(base.photos.map((p) => [p.id, p.data]));
  for (const d of documents) {
    if (d.deleted) continue;
    const [category, ...tail] = d.key.split(":");
    const key = tail.join(":");
    if (category === "profile") s.profile = d.payload as State["profile"];
    else if (category === "goals") s.goals = d.payload as State["goals"];
    else if (category === "wellness")
      s.wellness = d.payload as State["wellness"];
    else if (category === "memory") s.memory = String(d.payload);
    else if (category === "currentSession") {
      const c = d.payload as { session: number; sessionId: string };
      s.session = c.session;
      s.sessionId = c.sessionId;
    } else if (category === "plans") {
      const n = Number(key);
      if (n >= 0 && n < 5)
        s.plans = [
          ...s.plans.slice(0, n),
          d.payload as State["plans"][number],
          ...s.plans.slice(n + 1),
        ];
    } else if (category === "overrides")
      s.overrides[key] = d.payload as State["plans"][number]["exercises"];
    else if (category === "restDates") s.restDates.push(String(d.payload));
    else if (category === "health") {
      const h = d.payload as State["health"];
      s.healthHistory.push(h);
      if (h.syncedAt >= s.health.syncedAt) s.health = h;
    } else if (lists.includes(category as (typeof lists)[number])) {
      const value = d.payload as Record<string, unknown>;
      if (category === "photos") {
        const data =
          photoData[String(value.id)] ?? knownPhotos.get(String(value.id));
        if (data) s.photos.push({ ...value, data } as State["photos"][number]);
      } else (s[category as (typeof lists)[number]] as unknown[]).push(value);
    }
  }
  for (const list of lists)
    (s[list] as { time?: string; id: string }[]).sort(
      (a, b) =>
        (a.time ?? "").localeCompare(b.time ?? "") || a.id.localeCompare(b.id),
    );
  return stateSchema.parse(s);
}
export function changesBetween(
  previous: State,
  next: State,
  versions: Record<string, number>,
) {
  const a = flatten(previous),
    b = flatten(next);
  const changes: Change[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    changes.push({
      key,
      payload: b[key] ?? {},
      deleted: !(key in b),
      expected_version: versions[key] ?? 0,
    });
  }
  return changes;
}
