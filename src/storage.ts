import { openDB } from "idb";
import { Preferences } from "@capacitor/preferences";
import { initialState, stateSchema, stamp, type State } from "./domain";
const db = () =>
  openDB("rafiq-private", 1, {
    upgrade(db) {
      db.createObjectStore("vault");
    },
  });
export async function cacheGet<T>(key:string):Promise<T|undefined>{return (await db()).get('vault',key)}
export async function cacheSet(key:string,value:unknown){await(await db()).put('vault',value,key)}
export async function loadState(owner?:string) {
  const saved = await (await db()).get("vault", owner?`state:${owner}`:"state");
  if (saved) return stateSchema.parse(saved);
  if(owner){const {freshCloudState}=await import('./cloud-codec');return freshCloudState()}
  const state = initialState();
  const { value } = await Preferences.get({ key: "rafiq-v1" });
  if (value) {
    const old = JSON.parse(value);
    for (const d of [...(old.history ?? []), old]) {
      for (const m of d.meals ?? [])
        state.meals.push({
          ...stamp(d.date, "نقل من النسخة الأولى"),
          ...m,
          id: String(m.id),
          grams: 0,
          preparation: "غير محدد",
          original: m.name,
        });
      if (d.water) state.water.push({ ...stamp(d.date), ml: d.water });
      for (const r of d.sets ?? [])
        state.sets.push({
          ...stamp(d.date),
          sessionId: "legacy",
          exerciseId: "legacy",
          name: r.exercise,
          weight: r.weight,
          reps: r.reps,
          unit: "kg",
          basis: "total",
          rir: 0,
          notes: "من النسخة الأولى؛ أساس الوزن غير مؤكد",
        });
    }
    state.session = old.session ?? 0;
    state.goals.kcal = old.goal ?? 1850;
    state.goals.protein = old.proteinGoal ?? 180;
    for (const w of old.weights ?? [])
      state.weights.push({
        ...stamp(w.date),
        value: w.value,
        waist: 0,
        neck: 0,
        notes: "",
      });
  }
  await persist(state);
  await Preferences.remove({ key: "rafiq-v1" });
  return state;
}
export async function persist(state: State,owner?:string) {
  await (await db()).put("vault", stateSchema.parse(state), owner?`state:${owner}`:"state");
}
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (b: Uint8Array) =>
  btoa(Array.from(b, (x) => String.fromCharCode(x)).join(""));
const un64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 250000,
      hash: "SHA-256",
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function backup(state: State, password: string) {
  if (password.length < 10) throw Error("اختار كلمة مرور من 10 أحرف على الأقل");
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const safe = { ...state, settings: { ...state.settings, token: "" } };
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(safe)),
  );
  return JSON.stringify({
    format: "rafiq-encrypted-v1",
    salt: b64(salt),
    iv: b64(iv),
    data: b64(new Uint8Array(data)),
  });
}
export async function restore(text: string, password: string) {
  const p = JSON.parse(text);
  if (p.format !== "rafiq-encrypted-v1")
    throw Error("صيغة النسخة الاحتياطية غير صحيحة");
  try {
    const key = await derive(password, un64(p.salt));
    const raw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: un64(p.iv) },
      key,
      un64(p.data),
    );
    return stateSchema.parse(JSON.parse(dec.decode(raw)));
  } catch {
    throw Error("كلمة المرور غير صحيحة أو الملف تالف");
  }
}
