import { test, expect } from "@playwright/test";
import { initialState } from "../src/domain";
import { eventSchema, mergeWearEvents } from "../src/wear-events";
import { flatten, hydrate } from "../src/cloud-codec";
const meal = {
  type: "meal",
  id: "wear-food-1",
  time: "2026-10-18T15:00:00Z",
  name: "وجبة ساعة اختبار",
  grams: 150,
  kcal: 250,
  protein: 25,
  carbs: 20,
  fat: 7,
  preparation: "مطبوخ",
  original: "وصف اختبار",
};
test("watch meal validates, merges once, and deleted records do not resurrect from replay", () => {
  const event = eventSchema.parse(meal),
    s = initialState(),
    once = mergeWearEvents(s, [event, event]);
  expect(once.meals).toHaveLength(1);
  expect(once.meals[0].source).toContain("Galaxy Watch");
  expect(once.wearReceipts).toEqual([meal.id]);
  const deleted = { ...once, meals: [] };
  expect(mergeWearEvents(deleted, [event]).meals).toHaveLength(0);
  expect(eventSchema.safeParse({ ...meal, kcal: -1 }).success).toBe(false);
  expect(eventSchema.safeParse({ ...meal, grams: null }).success).toBe(false);
});
test("unknown nutrition remains a pending description and survives cloud roundtrip", () => {
  const event = eventSchema.parse({
      type: "foodDraft",
      id: "wear-draft-1",
      time: meal.time,
      name: "وجبة تحتاج تفاصيل",
      grams: null,
      preparation: "",
      original: "اكلت وجبة",
    }),
    s = mergeWearEvents(initialState(), [event]);
  expect(s.meals).toHaveLength(0);
  expect(s.pendingFoods).toHaveLength(1);
  const restored = hydrate(
    initialState(),
    Object.entries(flatten(s)).map(([key, payload]) => ({
      key,
      payload,
      version: 1,
      deleted: false,
    })),
  );
  expect(restored.pendingFoods).toEqual(s.pendingFoods);
});
test("watch inbox review turns a description into one meal without counting it early", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".performance-hub").waitFor();
  await page.evaluate(async () => {
    const { initialState, today } = await import("/src/domain.ts" as string);
    const s = initialState();
    s.pendingFoods = [
      {
        id: "pending-ui",
        date: today(),
        time: new Date().toISOString(),
        source: "Galaxy Watch — يحتاج مراجعة",
        name: "وصف من الساعة",
        grams: 100,
        preparation: "مطبوخ",
        original: "وصف من الساعة",
      },
    ];
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("rafiq-private", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("vault", "readwrite");
      tx.objectStore("vault").put(s, "state");
      tx.oncomplete = () => resolve();
      tx.onerror = reject;
    });
    db.close();
  });
  await page.reload();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: /^تغذيتي/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "وجبات من الساعة تحتاج مراجعة" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "أكمل وسجّل", exact: true }).click();
  await page.getByLabel("السعرات", { exact: true }).fill("200");
  await page.getByLabel("بروتين (غ)", { exact: true }).fill("20");
  await page.getByLabel("كارب (غ)", { exact: true }).fill("15");
  await page.getByLabel("دهون (غ)", { exact: true }).fill("6");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("تم الحفظ في سجلك");
  await expect(
    page.getByRole("heading", { name: "وجبات من الساعة تحتاج مراجعة" }),
  ).toHaveCount(0);
  await expect(page.locator(".summary-strip")).toContainText("200");
  await page.reload();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: /^تغذيتي/ })
    .click();
  await expect(page.locator(".summary-strip")).toContainText("200");
});

test("AI review of watch draft consumes the original pending item only after meal approval", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".performance-hub").waitFor();
  await page.evaluate(async () => {
    const { initialState, today } = await import("/src/domain.ts" as string);
    const s = initialState();
    s.settings.consent = true;
    s.settings.model = "gemini-test";
    s.pendingFoods = [
      {
        id: "pending-ai",
        date: today(),
        time: new Date().toISOString(),
        source: "Galaxy Watch",
        name: "دجاج من الساعة",
        grams: 100,
        preparation: "مشوي",
        original: "دجاج 100 غ مشوي",
      },
    ];
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("rafiq-private", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("vault", "readwrite");
      tx.objectStore("vault").put(s, "state");
      tx.oncomplete = () => resolve();
      tx.onerror = reject;
    });
    db.close();
  });
  await page.reload();
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      json: {
        reply: "راجع وجبتك من الساعة",
        proposal: {
          type: "meal",
          name: "دجاج من الساعة",
          grams: 100,
          preparation: "مشوي",
          kcal: 165,
          protein: 31,
          carbs: 0,
          fat: 4,
        },
      },
    }),
  );
  await page
    .locator(".sidebar")
    .getByRole("button", { name: /^تغذيتي/ })
    .click();
  await page.getByRole("button", { name: "قدّر مع رفيق" }).click();
  await expect(
    page.getByText("المحادثة مرتبطة بوصف وجبة الساعة"),
  ).toBeVisible();
  await page.getByRole("button", { name: "إرسال الرسالة" }).click();
  await page
    .getByRole("button", { name: "راجع تفاصيل الاقتراح وسجّله" })
    .click();
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("تم الحفظ في سجلك");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: /^تغذيتي/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "وجبات من الساعة تحتاج مراجعة" }),
  ).toHaveCount(0);
  await expect(page.locator(".summary-strip")).toContainText("165");
});
