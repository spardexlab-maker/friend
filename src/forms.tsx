import { cloudEnabled } from "./cloud-client";
import React, { useState, useEffect } from "react";
import { Check, Plus, Trash2, Camera, ArrowUpLeft } from "lucide-react";
import { useApp } from "./app-state";
import { Dialog, Field, Select, format } from "./components";
import {
  exerciseSchema,
  id,
  mealFromProposal,
  stamp,
  type Exercise,
  type Meal,
  type State,
  type Message,
  type SetEntry,
} from "./domain";
import { imageData } from "./native";
import { basisLabels } from "./pages";
import { api, GoogleBridge } from "./ai";
import { Capacitor } from "@capacitor/core";
import { foods, portion } from "./catalog";
type Rec = Record<string, unknown>;
export function Forms() {
  const { s, date, modal, close, change, notify, confirm, setTab } = useApp();
  const [error, setError] = useState(""),
    [photo, setPhoto] = useState(""),
    [scope, setScope] = useState("session");
  useEffect(() => {
    setError("");
    setPhoto("");
    setScope("session");
  }, [modal]);
  if (!modal) return null;
  const kind = modal.kind,
    item = (modal.item ?? {}) as Rec;
  const title: Record<string, string> = {
    meal: item.id ? "تعديل وجبتك" : "شنو أكلت؟",
    goals: "أهدافك اليومية",
    profile: "ملفك الشخصي",
    weight: "وزنك وقياساتك",
    exercise: item.id ? "تعديل التمرين" : "أضف تمرين",
    set: "سجّل جولتك",
    setEdit: "تعديل الجولة",
    water: "كمية الماي",
    cardio: "الكارديو والنشاط",
    sleep: "نومك",
    photo: "وثّق تطورك",
    proposal: "راجع اقتراح الوجبة",
    connection: "اتصال Google Gemini",
    compare: "صورك جنب بعض",
    recipe: "حساب وجبة أو وصفة",
    deleteMeal: "حذف الوجبة؟",
    note: "سجّل أي تفصيل",
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget),
      str = (k: string) => String(f.get(k) ?? ""),
      num = (k: string) => Number(f.get(k));
    let saved = false;
    try {
      const recordDate = str("date") || date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate))
        throw Error("حدد تاريخاً صحيحاً");
      if (kind === "meal" || kind === "proposal") {
        const proposal =
          kind === "proposal"
            ? mealFromProposal(
                (item as unknown as Message).proposal,
                recordDate,
              )
            : null;
        const original =
          kind === "proposal"
            ? [
                ...s.messages.slice(
                  0,
                  s.messages.findIndex((m) => m.id === item.id),
                ),
              ]
                .reverse()
                .find((m) => m.role === "user")?.text
            : String(item.original ?? str("name"));
        const m: Meal = {
          ...stamp(
            recordDate,
            proposal
              ? "تقدير Gemini — مؤكد منك"
              : String(item.source ?? "يدوي"),
          ),
          id:
            kind === "meal" && item.id
              ? String(item.id)
              : item.pendingFoodId || item.relatedFoodId
                ? String(item.pendingFoodId || item.relatedFoodId)
                : id(),
          time: String(item.time ?? new Date().toISOString()),
          name: str("name").trim(),
          kcal: num("kcal"),
          protein: num("protein"),
          carbs: num("carbs"),
          fat: num("fat"),
          grams: num("grams"),
          preparation: str("preparation"),
          original: original ?? "",
        };
        if (!m.name) throw Error("اكتب وصف الوجبة");
        saved = await change(
          item.id && kind === "meal" ? "تعديل وجبة" : "إضافة وجبة",
          (d) => ({
            ...d,
            pendingFoods:
              item.pendingFoodId || item.relatedFoodId
                ? d.pendingFoods.filter(
                    (x) => x.id !== (item.pendingFoodId || item.relatedFoodId),
                  )
                : d.pendingFoods,
            meals:
              item.id && kind === "meal"
                ? d.meals.map((x) => (x.id === m.id ? m : x))
                : [...d.meals, m],
            messages:
              kind === "proposal"
                ? d.messages.map((x) =>
                    x.id === item.id ? { ...x, applied: true } : x,
                  )
                : d.messages,
          }),
        );
      }
      if (kind === "goals")
        saved = await change("تعديل الأهداف", (d) => ({
          ...d,
          goals: {
            kcal: num("kcal"),
            restKcal: num("restKcal"),
            protein: num("protein"),
            carbs: num("carbs"),
            fat: num("fat"),
            water: num("water"),
          },
        }));
      if (kind === "profile")
        saved = await change("تعديل الملف الشخصي", (d) => ({
          ...d,
          profile: {
            name: str("name"),
            height: num("height"),
            age: num("age"),
            sex: str("sex") as "male" | "female",
            activity: num("activity"),
            dayStart: num("dayStart"),
            notes: str("notes"),
          },
        }));
      if (kind === "weight") {
        const w = {
          ...stamp(recordDate, String(item.source ?? "يدوي")),
          id: String(item.id ?? id()),
          time: String(item.time ?? new Date().toISOString()),
          value: num("value"),
          waist: num("waist"),
          neck: num("neck"),
          notes: str("notes"),
        };
        saved = await change(item.id ? "تصحيح وزن" : "تسجيل وزن", (d) => ({
          ...d,
          weights: item.id
            ? d.weights.map((x) => (x.id === w.id ? w : x))
            : [...d.weights, w],
        }));
      }
      if (kind === "exercise") {
        const e = exerciseSchema.parse({
          id: String(item.id ?? id()),
          name: str("name"),
          english: str("english"),
          weight: num("weight"),
          sets: num("sets"),
          reps: str("reps"),
          rest: num("rest"),
          unit: str("unit"),
          basis: str("basis"),
        });
        saved = await change(
          scope === "plan" ? "تعديل خطة التمرين الدائمة" : "تعديل تمرين الجلسة",
          (d) => {
            const current =
              d.overrides[d.sessionId] ?? d.plans[d.session].exercises;
            const update = (list: Exercise[]) =>
              item.id ? list.map((x) => (x.id === e.id ? e : x)) : [...list, e];
            return {
              ...d,
              plans:
                scope === "plan"
                  ? d.plans.map((p, i) =>
                      i === d.session
                        ? { ...p, exercises: update(p.exercises) }
                        : p,
                    )
                  : d.plans,
              overrides: { ...d.overrides, [d.sessionId]: update(current) },
            };
          },
        );
      }
      if (kind === "set" || kind === "setEdit") {
        const r: SetEntry = {
          ...stamp(recordDate, String(item.source ?? "يدوي")),
          id: String(kind === "setEdit" ? item.id : id()),
          sessionId: String(kind === "setEdit" ? item.sessionId : s.sessionId),
          exerciseId: String(kind === "setEdit" ? item.exerciseId : item.id),
          name: String(item.name),
          weight: num("weight"),
          reps: num("reps"),
          unit: str("unit") as "kg" | "lb",
          basis: str("basis") as Exercise["basis"],
          rir: num("rir"),
          notes: str("notes"),
        };
        saved = await change(
          kind === "setEdit" ? "تصحيح جولة" : "تسجيل جولة",
          (d) => ({
            ...d,
            sets:
              kind === "setEdit"
                ? d.sets.map((x) => (x.id === r.id ? r : x))
                : [...d.sets, r],
          }),
        );
      }
      if (kind === "water")
        saved = await change("تسجيل ماء", (d) => ({
          ...d,
          water: [
            ...d.water,
            {
              ...stamp(recordDate, String(item.source ?? "يدوي")),
              ml: num("ml"),
            },
          ],
        }));
      if (kind === "note") {
        const note = {
          ...stamp(recordDate, String(item.source ?? "يدوي")),
          id: String(item.id ?? id()),
          time: String(item.time ?? new Date().toISOString()),
          title: str("title"),
          text: str("text"),
          category: str("category"),
        };
        saved = await change("تسجيل ملاحظة", (d) => ({
          ...d,
          journal: item.id
            ? d.journal.map((x) => (x.id === note.id ? note : x))
            : [...d.journal, note],
        }));
      }
      if (kind === "cardio") {
        const c = {
          ...stamp(recordDate, str("source")),
          id: String(item.id ?? id()),
          time: String(item.time ?? new Date().toISOString()),
          name: str("name"),
          minutes: num("minutes"),
          distance: num("distance"),
          kcal: num("kcal"),
          notes: str("notes"),
        };
        saved = await change(
          item.id ? "تصحيح كارديو" : "تسجيل كارديو",
          (d) => ({
            ...d,
            cardio: item.id
              ? d.cardio.map((x) => (x.id === c.id ? c : x))
              : [...d.cardio, c],
          }),
        );
      }
      if (kind === "sleep") {
        const start = str("start") + "+03:00",
          end = str("end") + "+03:00";
        const duration = Date.parse(end) - Date.parse(start);
        if (
          !Number.isFinite(duration) ||
          duration <= 0 ||
          duration > 36 * 3600000
        )
          throw Error(
            "نهاية النوم لازم تكون بعد البداية وبفترة لا تتجاوز 36 ساعة",
          );
        const r = {
          ...stamp(recordDate),
          id: String(item.id ?? id()),
          time: String(item.time ?? new Date().toISOString()),
          start,
          end,
          quality: num("quality"),
          notes: str("notes"),
        };
        saved = await change(item.id ? "تصحيح نوم" : "تسجيل نوم", (d) => ({
          ...d,
          sleep: item.id
            ? d.sleep.map((x) => (x.id === r.id ? r : x))
            : [...d.sleep, r],
        }));
      }
      if (kind === "photo") {
        if (!photo) throw Error("اختار الصورة أولاً");
        const p = {
          ...stamp(recordDate),
          pose: str("pose"),
          weight: num("weight"),
          notes: str("notes"),
          data: photo,
        };
        saved = await change("إضافة صورة", (d) => ({
          ...d,
          photos: [...d.photos, p],
        }));
      }
      if (!saved) {
        setError("تعذر حفظ التغيير. راجع القيم ومساحة الجهاز.");
        return;
      }
      if (item._proposalId)
        await change("اعتماد اقتراح تسجيل", (d) => ({
          ...d,
          messages: d.messages.map((m) =>
            m.id === item._proposalId ? { ...m, applied: true } : m,
          ),
        }));
      close();
      notify("تم الحفظ في سجلك");
    } catch (e) {
      setError((e as Error).message || "راجع القيم المدخلة");
    }
  }
  const meal =
    kind === "proposal"
      ? (((item as unknown as Message).proposal as Rec) ?? {})
      : item;
  const dateInput = (
    <Field
      label="التاريخ"
      type="date"
      name="date"
      value={String(
        item.date ??
          (kind === "proposal" ? (item.proposal as Rec)?.date : undefined) ??
          date,
      )}
    />
  );
  return (
    <Dialog title={title[kind] ?? "تفاصيلك"} onClose={close}>
      {kind === "proposal" &&
      (item as unknown as Message).proposal &&
      (item as unknown as Message).proposal != null &&
      ((item as unknown as Message).proposal as Rec).type !== "meal" ? (
        <OtherProposal message={item as unknown as Message} />
      ) : kind === "connection" ? (
        <Connection />
      ) : kind === "compare" ? (
        <Compare ids={modal.item as string[]} />
      ) : kind === "recipe" ? (
        <Recipe />
      ) : kind === "deleteMeal" ? (
        <>
          <p>
            تنحذف «{String(item.name)}» من حسابات يومها، ويبقى أثر الحذف في سجل
            التغييرات.
          </p>
          <div className="button-row">
            <button
              className="danger"
              onClick={() => {
                change("حذف وجبة", (d) => ({
                  ...d,
                  meals: d.meals.filter((x) => x.id !== item.id),
                }));
                close();
              }}
            >
              حذف الوجبة
            </button>
            <button className="secondary" onClick={close}>
              إلغاء
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          {["meal", "proposal"].includes(kind) && (
            <>
              <p className="small muted">
                {kind === "proposal"
                  ? "أرقام Gemini تقديرية. راجع المكونات والكميات قبل اعتمادها."
                  : "سجّل المقادير الفعلية، والأرقام من الملصق أو حسابك المعروف."}
              </p>
              {dateInput}
              <Field
                label="الوجبة والكمية"
                type="text"
                name="name"
                value={String(meal.name ?? "")}
                placeholder="150 غ دجاج + 100 غ تمن"
              />
              <div className="form-grid">
                <Field
                  label="الكمية الكلية (غ)"
                  name="grams"
                  value={Number(meal.grams ?? 0)}
                />
                <Field
                  label="التحضير / نيء أو مطبوخ"
                  name="preparation"
                  type="text"
                  value={String(meal.preparation ?? "غير محدد")}
                />
                <Field
                  label="السعرات"
                  name="kcal"
                  value={meal.kcal as number}
                />
                <Field
                  label="بروتين (غ)"
                  name="protein"
                  value={meal.protein as number}
                />
                <Field
                  label="كارب (غ)"
                  name="carbs"
                  value={meal.carbs as number}
                />
                <Field label="دهون (غ)" name="fat" value={meal.fat as number} />
              </div>
            </>
          )}
          {kind === "goals" && (
            <>
              <p className="small muted">
                هذي أهدافك المدخلة؛ تغييرها ما يغيّر الأكل المسجل.
              </p>
              <div className="form-grid">
                <Field
                  label="سعرات يوم التمرين"
                  name="kcal"
                  value={s.goals.kcal}
                  min={1}
                />
                <Field
                  label="سعرات يوم الراحة"
                  name="restKcal"
                  value={s.goals.restKcal}
                  min={1}
                />
                <Field
                  label="البروتين (غ)"
                  name="protein"
                  value={s.goals.protein}
                  min={1}
                />
                <Field label="الكارب (غ)" name="carbs" value={s.goals.carbs} />
                <Field label="الدهون (غ)" name="fat" value={s.goals.fat} />
                <Field label="الماي (مل)" name="water" value={s.goals.water} />
              </div>
            </>
          )}
          {kind === "profile" && (
            <>
              <Field
                label="اسمك"
                type="text"
                name="name"
                value={s.profile.name}
              />
              <div className="form-grid">
                <Field
                  label="الطول (سم)"
                  name="height"
                  value={s.profile.height}
                  min={80}
                  max={250}
                />
                <Field
                  label="العمر"
                  name="age"
                  value={s.profile.age}
                  min={18}
                  max={110}
                  step="1"
                />
                <Select
                  label="الجنس لحساب المعادلة"
                  name="sex"
                  value={s.profile.sex}
                  options={[
                    ["male", "ذكر"],
                    ["female", "أنثى"],
                  ]}
                />
                <Select
                  label="معامل النشاط لـTDEE"
                  name="activity"
                  value={String(s.profile.activity)}
                  options={[
                    ["1.2", "1.2 — نشاط قليل"],
                    ["1.375", "1.375 — خفيف"],
                    ["1.55", "1.55 — متوسط"],
                    ["1.725", "1.725 — عالٍ"],
                    ["1.9", "1.9 — عالٍ جداً"],
                  ]}
                />
                <Field
                  label="ساعة بداية اليوم (0–23)"
                  name="dayStart"
                  value={s.profile.dayStart}
                  max={23}
                  step="1"
                />
              </div>
              <p className="caption">
                بداية اليوم تجمع تسجيلاتك تلقائياً حسب الساعة المختارة؛ التاريخ
                والوقت الحقيقي محفوظان مع كل حدث.
              </p>
              <label>
                ملاحظاتك
                <textarea name="notes" defaultValue={s.profile.notes} />
              </label>
            </>
          )}
          {kind === "weight" && (
            <>
              {dateInput}
              <div className="form-grid">
                <Field
                  label="الوزن (كغ)"
                  name="value"
                  value={item.value as number}
                  min={20}
                  max={400}
                />
                <Field
                  label="الخصر عند السرة (سم)"
                  name="waist"
                  value={Number(item.waist ?? 0)}
                  max={300}
                />
                <Field
                  label="الرقبة (سم)"
                  name="neck"
                  value={Number(item.neck ?? 0)}
                  max={100}
                />
              </div>
              <p className="caption">
                إذا شريطك يبدأ من 11 سم، أدخل القياس بعد طرح 11. الصفر يعني غير
                مسجّل.
              </p>
              <label>
                ظروف القياس
                <textarea
                  name="notes"
                  defaultValue={String(item.notes ?? "")}
                  placeholder="صباحاً، بعد الحمام، قبل الأكل…"
                />
              </label>
            </>
          )}
          {kind === "exercise" && (
            <>
              <Field
                label="اسم التمرين"
                type="text"
                name="name"
                value={String(item.name ?? "")}
              />
              <Field
                label="الاسم الإنكليزي"
                type="text"
                name="english"
                required={false}
                value={String(item.english ?? "")}
              />
              <div className="form-grid">
                <Field
                  label="وزن الخطة"
                  name="weight"
                  value={Number(item.weight ?? 0)}
                  max={2000}
                />
                <Field
                  label="المجاميع"
                  name="sets"
                  value={Number(item.sets ?? 3)}
                  min={1}
                  max={50}
                  step="1"
                />
                <Field
                  label="مدى التكرارات"
                  type="text"
                  name="reps"
                  value={String(item.reps ?? "8–12")}
                />
                <Field
                  label="الراحة (ثانية)"
                  name="rest"
                  value={Number(item.rest ?? 90)}
                  max={3600}
                  step="1"
                />
                <Select
                  label="وحدة الوزن"
                  name="unit"
                  value={String(item.unit ?? "kg")}
                  options={[
                    ["kg", "كيلوغرام"],
                    ["lb", "باوند"],
                  ]}
                />
                <Select
                  label="أساس الوزن"
                  name="basis"
                  value={String(item.basis ?? "total")}
                  options={Object.entries(basisLabels) as [string, string][]}
                />
              </div>
              <label>
                تطبيق التعديل
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="session">لهذه الجلسة فقط</option>
                  <option value="plan">للخطة دائماً والجلسة الحالية</option>
                </select>
              </label>
              {item.id != null && (
                <button
                  className="danger"
                  type="button"
                  onClick={() =>
                    confirm("حذف هذا التمرين من النطاق المحدد؟", () => {
                      change("حذف تمرين", (d) => ({
                        ...d,
                        plans:
                          scope === "plan"
                            ? d.plans.map((p, i) =>
                                i === d.session
                                  ? {
                                      ...p,
                                      exercises: p.exercises.filter(
                                        (x) => x.id !== item.id,
                                      ),
                                    }
                                  : p,
                              )
                            : d.plans,
                        overrides: {
                          ...d.overrides,
                          [d.sessionId]: (
                            d.overrides[d.sessionId] ??
                            d.plans[d.session].exercises
                          ).filter((x) => x.id !== item.id),
                        },
                      }));
                      close();
                    })
                  }
                >
                  حذف التمرين
                </button>
              )}
            </>
          )}
          {["set", "setEdit"].includes(kind) && (
            <>
              <h3>{String(item.name)}</h3>
              {dateInput}
              <div className="form-grid">
                <Field
                  label="الوزن الفعلي"
                  name="weight"
                  value={Number(item.weight ?? 0)}
                  max={2000}
                />
                <Field
                  label="التكرارات الفعلية"
                  name="reps"
                  min={1}
                  max={300}
                  step="1"
                  value={
                    kind === "setEdit" || item._proposalId
                      ? Number(item.reps)
                      : undefined
                  }
                />
                <Select
                  label="وحدة الوزن"
                  name="unit"
                  value={String(item.unit ?? "kg")}
                  options={[
                    ["kg", "كيلوغرام"],
                    ["lb", "باوند"],
                  ]}
                />
                <Select
                  label="أساس الوزن"
                  name="basis"
                  value={String(item.basis ?? "total")}
                  options={Object.entries(basisLabels) as [string, string][]}
                />
                <Field
                  label="RIR — تكرارات بقيت بقدرتك"
                  name="rir"
                  value={Number(item.rir ?? 2)}
                  max={20}
                  step="1"
                />
              </div>
              <label>
                ملاحظة الجولة
                <textarea
                  name="notes"
                  defaultValue={String(item.notes ?? "")}
                />
              </label>
            </>
          )}
          {kind === "note" && (
            <>
              {dateInput}
              <Field
                label="عنوان الملاحظة"
                type="text"
                name="title"
                value={String(item.title ?? "")}
              />
              <Select
                label="التصنيف"
                name="category"
                value={String(item.category ?? "يومي")}
                options={[
                  ["يومي", "يومي"],
                  ["مشكلة", "مشكلة / انزعاج"],
                  ["مكمل", "مكمل"],
                  ["عادة", "عادة"],
                ]}
              />
              <label>
                التفاصيل بالحرف
                <textarea
                  name="text"
                  required
                  defaultValue={String(item.text ?? "")}
                />
              </label>
            </>
          )}
          {kind === "water" && (
            <>
              {dateInput}
              <Field
                label="الكمية (مل)"
                name="ml"
                min={1}
                max={10000}
                value={Number(item.ml ?? 250)}
              />
            </>
          )}
          {kind === "cardio" && (
            <>
              {dateInput}
              <Field
                label="النشاط"
                type="text"
                name="name"
                value={String(item.name ?? "مشي على التريدميل")}
              />
              <div className="form-grid">
                <Field
                  label="المدة (دقيقة)"
                  name="minutes"
                  min={1}
                  max={1440}
                  value={item.minutes as number}
                />
                <Field
                  label="المسافة (كم)"
                  name="distance"
                  value={Number(item.distance ?? 0)}
                  max={1000}
                />
                <Field
                  label="السعرات المسجلة"
                  name="kcal"
                  value={Number(item.kcal ?? 0)}
                />
                <Select
                  label="مصدر السعرات"
                  name="source"
                  value={String(item.source ?? "رقم جهاز — تقديري")}
                  options={[
                    ["رقم جهاز — تقديري", "جهاز الكارديو"],
                    ["رقم الساعة — تقديري", "الساعة"],
                    ["تقدير يدوي", "تقدير يدوي"],
                    ["غير متوفر", "غير متوفر — أدخل صفر"],
                  ]}
                />
              </div>
              <label>
                السرعة والميل والملاحظات
                <textarea
                  name="notes"
                  defaultValue={String(item.notes ?? "")}
                />
              </label>
            </>
          )}
          {kind === "sleep" && (
            <>
              {dateInput}
              <Field
                label="بداية النوم بتوقيت بغداد"
                type="datetime-local"
                name="start"
                value={String(item.start ?? `${date}T23:00`).slice(0, 16)}
              />
              <Field
                label="نهاية النوم بتوقيت بغداد"
                type="datetime-local"
                name="end"
                value={String(item.end ?? "").slice(0, 16)}
              />
              <Field
                label="الجودة من 1 إلى 5"
                name="quality"
                value={Number(item.quality ?? 3)}
                min={1}
                max={5}
                step="1"
              />
              <label>
                ملاحظات
                <textarea
                  name="notes"
                  defaultValue={String(item.notes ?? "")}
                />
              </label>
            </>
          )}
          {kind === "photo" && (
            <>
              {dateInput}
              <Select
                label="الوقفة"
                name="pose"
                options={[
                  ["أمام مرتخٍ", "أمام مرتخٍ"],
                  ["جانب", "جانب"],
                  ["ظهر مرتخٍ", "ظهر مرتخٍ"],
                  ["أمام استعراض", "أمام استعراض"],
                  ["ظهر استعراض", "ظهر استعراض"],
                ]}
              />
              <Field
                label="الوزن وقت الصورة (كغ، أو صفر إذا غير معروف)"
                name="weight"
                value={0}
                max={400}
              />
              <label className="photo-upload">
                <Camera />
                اختار صورة من جهازك
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    try {
                      const f = e.target.files?.[0];
                      if (f) setPhoto(await imageData(f));
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />
              </label>
              {photo && (
                <img
                  className="photo-preview"
                  src={photo}
                  alt="معاينة صورتك قبل الحفظ"
                />
              )}
              <label>
                ملاحظات
                <textarea name="notes" />
              </label>
              <p className="caption">
                تُحفظ على الجهاز؛ ما تنرسل للذكاء الاصطناعي بمجرد الإضافة.
              </p>
            </>
          )}
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          <button className="primary full" type="submit">
            حفظ <Check size={18} />
          </button>
        </form>
      )}
    </Dialog>
  );
}
function Connection() {
  const { s, change, notify, close } = useApp();
  const [url, setUrl] = useState(s.settings.apiUrl),
    [token, setToken] = useState(s.settings.token),
    [model, setModel] = useState(s.settings.model),
    [consent, setConsent] = useState(s.settings.consent),
    [status, setStatus] = useState(""),
    [models, setModels] = useState<{ id: string; name: string }[]>([]),
    [busy, setBusy] = useState(false),
    [apiKey, setApiKey] = useState("");
  const candidate = { ...s, settings: { apiUrl: url, token, model, consent } };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        change("تعديل اتصال Gemini", (d) => ({
          ...d,
          settings: {
            apiUrl: url.trim(),
            token: token.trim(),
            model: model.trim(),
            consent,
          },
        }));
        notify("إعدادات الاتصال محفوظة");
        close();
      }}
    >
      <p className="small muted">
        {cloudEnabled
          ? "Gemini يعمل عبر خادم حسابك؛ المفتاح محفوظ ضمن أسرار الخادم."
          : Capacitor.isNativePlatform()
            ? "تقدر تربط Gemini مباشرة من موبايلك؛ المفتاح ينحفظ مشفراً بخزنة أندرويد، وتكدر تستخدم خادمك اختيارياً."
            : "للمعاينة على الكمبيوتر: يوضع المفتاح بملف .env.local باسم GEMINI_API_KEY. نسخة الموبايل تدعم حفظه مشفراً داخل خزنة أندرويد."}
      </p>
      {!cloudEnabled && Capacitor.isNativePlatform() && (
        <>
          <label>
            مفتاح Google API — خزنة الجهاز
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="يبقى على جهازك؛ ما يدخل النسخ الاحتياطية"
            />
          </label>
          <div className="button-row">
            <button
              type="button"
              className="secondary"
              disabled={apiKey.length < 20}
              onClick={async () => {
                try {
                  await GoogleBridge.saveKey({ key: apiKey });
                  setApiKey("");
                  notify("المفتاح انحفظ مشفراً بخزنة أندرويد؛ افحص الاتصال");
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              حفظ المفتاح بالجهاز
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                GoogleBridge.clearKey().then(() =>
                  notify("تم حذف المفتاح من خزنة الجهاز"),
                )
              }
            >
              حذف المفتاح
            </button>
          </div>
        </>
      )}
      {!cloudEnabled && (
        <>
          <label>
            عنوان خادمك HTTPS
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="اتركه فارغاً للمعاينة المحلية"
              type="url"
            />
          </label>
          <label>
            رمز الوصول لخادمك
            <input
              value={token}
              type="password"
              autoComplete="off"
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        </>
      )}
      <label>
        نموذج Gemini
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="اختر من النماذج المتاحة بعد الفحص"
          list="gemini-models"
        />
        <datalist id="gemini-models">
          {models.map((m) => (
            <option value={m.id} key={m.id}>
              {m.name}
            </option>
          ))}
        </datalist>
      </label>
      <button
        className="secondary"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await api(candidate, "status");
            setStatus(
              result.configured
                ? "مفتاح Google موجود؛ نجيب النماذج…"
                : "الخادم شغّال، يحتاج إضافة GEMINI_API_KEY",
            );
            if (result.configured) {
              const x = await api(candidate, "models");
              setModels(x.models);
              if (!model && x.models[0])
                setModel(result.model || x.models[0].id);
              setStatus("الاتصال نجح؛ اختار النموذج المناسب من القائمة");
            }
          } catch (e) {
            setStatus((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "نفحص…" : "فحص الاتصال وجلب النماذج"}
      </button>
      {status && (
        <p role="status" className="info-note">
          {status}
        </p>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          أوافق على إرسال رسائلي وملف الذاكرة وملفي وأهدافي وآخر سجلات المتابعة
          إلى Google Gemini مباشرة أو عبر خادمي حسب إعداد الاتصال عند المحادثة.
          الصور تُرسل فقط إذا أرفقتها أو طلبت تحليل المقارنة.
        </span>
      </label>
      <a
        className="text-button"
        href="https://aistudio.google.com/api-keys"
        target="_blank"
        rel="noreferrer"
      >
        إدارة مفاتيح Google AI Studio <ArrowUpLeft size={15} />
      </a>
      <button className="primary full">
        حفظ الإعدادات <Check size={17} />
      </button>
    </form>
  );
}
function Compare({ ids }: { ids: string[] }) {
  const { s, change, setTab, close, notify } = useApp();
  const photos = ids
    .map((i) => s.photos.find((p) => p.id === i))
    .filter((p) => p != null);
  return (
    <>
      <div className="compare-grid">
        {photos.map((p) => (
          <div key={p.id}>
            <img src={p.data} alt={`${p.pose} ${p.date}`} />
            <b>
              {p.date} • {p.weight || "—"} كغ
            </b>
            <span className="caption block">
              {p.pose} • {p.notes}
            </span>
          </div>
        ))}
      </div>
      <p className="info-note">
        إذا الوضعية أو الإضاءة مختلفة، المقارنة محدودة. الصور ما تقيس نسبة
        الدهون أو العمر البيولوجي.
      </p>
      <button
        className="primary full"
        onClick={() => {
          if (!s.settings.consent) {
            notify("فعّل مشاركة البيانات مع Gemini من إعدادات الاتصال");
            return;
          }
          sessionStorage.setItem(
            "rafiq-comparison",
            JSON.stringify({
              images: photos.map((p) => p.data),
              text: `قارن ظاهرياً بين صورتي ${photos.map((p) => `${p.date} وزن ${p.weight} وقفة ${p.pose}`).join(" و ")}. وضح حدود اختلاف التصوير؛ لا تستنتج نسبة دهون دقيقة أو تشخيصاً. اربط ملاحظاتك بسجلي الفعلي.`,
            }),
          );
          setTab("chat");
          close();
          notify("جهّزنا المقارنة بالمحادثة. راجع النص واضغط إرسال لمشاركتها.");
        }}
      >
        جهّز تحليل المقارنة مع Gemini
      </button>
    </>
  );
}
function Recipe() {
  const { change, date, close, notify } = useApp();
  const [name, setName] = useState("وجبة محسوبة"),
    [rows, setRows] = useState<{ food: number; grams: number }[]>([
      { food: 0, grams: 100 },
    ]),
    [servings, setServings] = useState(1),
    [error, setError] = useState("");
  const total = rows.reduce(
    (a, r) => {
      const p = portion(foods[r.food], r.grams);
      return {
        kcal: a.kcal + p.kcal,
        protein: a.protein + p.protein,
        carbs: a.carbs + p.carbs,
        fat: a.fat + p.fat,
        grams: a.grams + r.grams,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!rows.length || servings <= 0 || !name.trim()) {
          setError("أضف المكونات وعدد الحصص");
          return;
        }
        const m: Meal = {
          ...stamp(date, "حساب وصفة — قيم تقديرية من خطة الأكل"),
          name,
          kcal: total.kcal / servings,
          protein: total.protein / servings,
          carbs: total.carbs / servings,
          fat: total.fat / servings,
          grams: total.grams / servings,
          preparation: rows
            .map((r) => `${r.grams} غ ${foods[r.food].name}`)
            .join(" + "),
          original: JSON.stringify({ rows, servings }),
        };
        change("تسجيل حصة وصفة", (d) => ({ ...d, meals: [...d.meals, m] }));
        close();
        notify("تم تسجيل حصة واحدة من الوصفة");
      }}
    >
      <label>
        اسم الوصفة
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <p className="caption">
        قيم مرجعية تقديرية، لا تشمل زيتاً إلا إذا أضفته. للمنتجات ذات الملصق
        استخدم الإدخال اليدوي.
      </p>
      {rows.map((r, i) => (
        <div className="recipe-row" key={i}>
          <select
            aria-label={`مكون ${i + 1}`}
            value={r.food}
            onChange={(e) =>
              setRows((a) =>
                a.map((v, j) =>
                  j === i ? { ...v, food: Number(e.target.value) } : v,
                ),
              )
            }
          >
            {foods.map((f, k) => (
              <option value={k} key={k}>
                {f.name}
              </option>
            ))}
          </select>
          <input
            aria-label={`غرامات المكون ${i + 1}`}
            type="number"
            min={1}
            max={20000}
            step="any"
            required
            value={r.grams}
            onChange={(e) =>
              setRows((a) =>
                a.map((v, j) =>
                  j === i ? { ...v, grams: Number(e.target.value) } : v,
                ),
              )
            }
          />
          <span>غ</span>
          <button
            className="icon-button"
            type="button"
            aria-label="حذف المكون"
            onClick={() => setRows((a) => a.filter((_, j) => j !== i))}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        className="text-button"
        type="button"
        onClick={() => setRows((a) => [...a, { food: 0, grams: 100 }])}
      >
        <Plus size={16} />
        مكوّن إضافي
      </button>
      <label>
        عدد الحصص المتساوية
        <input
          type="number"
          min={1}
          max={100}
          value={servings}
          required
          onChange={(e) => setServings(Number(e.target.value))}
        />
      </label>
      <div className="summary-strip">
        <span>
          الحصة <b>{format(total.kcal / Math.max(1, servings))}</b> سعرة
        </span>
        <span>{format(total.protein / Math.max(1, servings))} غ بروتين</span>
      </div>
      {error && <p role="alert">{error}</p>}
      <button className="primary full">
        سجّل حصة واحدة <Check size={17} />
      </button>
    </form>
  );
}

function OtherProposal({ message }: { message: Message }) {
  const { s, open, notify } = useApp();
  const p = message.proposal as Rec;
  const type = String(p.type);
  const supported = ["water", "set", "cardio", "weight", "sleep", "note"];
  if (!supported.includes(type))
    return <p>نوع الاقتراح غير مدعوم. تقدر تسجله من النموذج اليدوي.</p>;
  return (
    <>
      <p>الاقتراح يحتاج مراجعتك قبل التسجيل، وتكدر تعدل كل التفاصيل.</p>
      <pre className="proposal-preview">{JSON.stringify(p, null, 2)}</pre>
      <button
        className="primary full"
        onClick={() => {
          if (type === "set") {
            const ex = (
              s.overrides[s.sessionId] ?? s.plans[s.session].exercises
            ).find((e) => e.id === p.exerciseId);
            if (!ex) {
              notify(
                "التمرين المقترح مو موجود بالجلسة الحالية؛ اطلب من رفيق يحدد تمريناً من الخطة.",
              );
              return;
            }
            open("set", {
              ...ex,
              ...p,
              id: ex.id,
              _proposalId: message.id,
              source: "Gemini — مؤكد منك",
            });
          } else
            open(type, {
              ...p,
              id: undefined,
              _proposalId: message.id,
              source: "Gemini — مؤكد منك",
            });
        }}
      >
        راجع بالنموذج وسجّل
      </button>
    </>
  );
}
