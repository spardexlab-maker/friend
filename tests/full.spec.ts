import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const goto = async (page: any, tab: string) =>
  page
    .locator(".sidebar")
    .getByRole("button", { name: new RegExp("^" + tab) })
    .click();
async function addMeal(page: any) {
  await page.getByRole("button", { name: "سجّل وجبة", exact: true }).click();
  await page.getByLabel("الوجبة والكمية").fill("دجاج مطبوخ 150 غ");
  await page.getByLabel("السعرات", { exact: true }).fill("250");
  await page.getByLabel("بروتين (غ)", { exact: true }).fill("45");
  await page.getByLabel("كارب (غ)", { exact: true }).fill("0");
  await page.getByLabel("دهون (غ)", { exact: true }).fill("7");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "دجاج مطبوخ 150 غ", exact: true }),
  ).toBeVisible();
}
test("meal edit recalculates, dates stay separate, delete audited and reload persists", async ({
  page,
}) => {
  await page.goto("/");
  await addMeal(page);
  await page
    .getByRole("button", { name: "تعديل دجاج مطبوخ 150 غ", exact: true })
    .click();
  await page.getByLabel("السعرات", { exact: true }).fill("300");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.locator(".ring strong")).toHaveText("1,550");
  await page.getByLabel("يوم السجل").fill("2026-10-01");
  await expect(
    page.getByRole("heading", { name: "دجاج مطبوخ 150 غ", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "يومي الحالي" }).click();
  await page.getByRole("button", { name: "+ 250 مل", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "دجاج مطبوخ 150 غ", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0.3", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "حذف دجاج مطبوخ 150 غ", exact: true })
    .click();
  await page.getByRole("button", { name: "حذف الوجبة", exact: true }).click();
  await expect(page.locator(".ring strong")).toHaveText("1,850");
  await page.getByRole("button", { name: "الإعدادات", exact: true }).click();
  await expect(
    page.locator(".audit-list summary").filter({ hasText: "تعديل وجبة" }),
  ).toBeVisible();
  await expect(
    page.locator(".audit-list summary").filter({ hasText: "حذف وجبة" }),
  ).toBeVisible();
});
test("session-only plan edit does not change permanent plan; actual set retains units", async ({
  page,
}) => {
  await page.goto("/");
  await goto(page, "تمريني");
  await page
    .getByRole("button", { name: "تعديل بنج سميث مستوي", exact: true })
    .click();
  await page.getByLabel("وزن الخطة").fill("42.5");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByText("42.5 كغ • الخطة")).toBeVisible();
  await page
    .getByRole("button", { name: "سجل بنج سميث مستوي", exact: true })
    .click();
  await page.getByLabel("التكرارات الفعلية").fill("10");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByText("42.5 kg × 10")).toBeVisible();
  await page
    .getByRole("button", { name: "إنهاء الجلسة والانتقال للتالية" })
    .click();
  await page.getByRole("button", { name: "تأكيد", exact: true }).click();
  await expect(page.getByText("خطة Pull", { exact: true })).toBeVisible();
  await page
    .locator(".stage-row")
    .getByRole("button", { name: "01 Push" })
    .click();
  await page.getByRole("button", { name: "تأكيد", exact: true }).click();
  await expect(page.getByText("0 كغ • الخطة").first()).toBeVisible();
  await page.reload();
  await goto(page, "تمريني");
  await expect(page.getByText("خطة Push", { exact: true })).toBeVisible();
});
test("recipe calculates actual portions and manual sleep rejects reversed times", async ({
  page,
}) => {
  await page.goto("/");
  await goto(page, "تغذيتي");
  await page.getByRole("button", { name: "حساب وصفة / وجبة" }).click();
  await page.getByLabel("غرامات المكون 1").fill("200");
  await page.getByLabel("عدد الحصص المتساوية").fill("2");
  await page.getByRole("button", { name: "سجّل حصة واحدة" }).click();
  await expect(
    page.getByRole("heading", { name: "وجبة محسوبة", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("165", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "صحتي والساعة", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "تسجيل نوم" }).click();
  await page.getByLabel("بداية النوم بتوقيت بغداد").fill("2026-10-18T23:00");
  await page.getByLabel("نهاية النوم بتوقيت بغداد").fill("2026-10-18T07:00");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("نهاية النوم");
  await page.getByLabel("نهاية النوم بتوقيت بغداد").fill("2026-10-19T07:00");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByText("8 ساعات", { exact: true })).toBeVisible();
});
test("Gemini proposal is reviewed, saved once, messages persist, no mutation on unconfirmed reply", async ({
  page,
}) => {
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { configured: true, model: "gemini-test" } }),
  );
  await page.route("**/api/models", (r) =>
    r.fulfill({ json: { models: [{ id: "gemini-test", name: "Test" }] } }),
  );
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      json: {
        reply: "راجع وجبتك",
        proposal: {
          type: "meal",
          name: "وجبة مقترحة",
          grams: 100,
          preparation: "مطبوخ",
          kcal: 200,
          protein: 20,
          carbs: 10,
          fat: 9,
        },
      },
    }),
  );
  await page.goto("/");
  await goto(page, "رفيقي");
  await page.getByRole("button", { name: "الاتصال", exact: true }).click();
  await page.getByRole("button", { name: "فحص الاتصال وجلب النماذج" }).click();
  await expect(page.getByRole("status")).toContainText("الاتصال نجح");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await page.getByLabel("رسالتك لرفيق").fill("أكلت 100 غ دجاج مشوي بدون زيت");
  await page.getByRole("button", { name: "إرسال الرسالة" }).click();
  await expect(page.getByText("راجع وجبتك", { exact: true })).toBeVisible();
  await goto(page, "تغذيتي");
  await expect(
    page.getByRole("heading", { name: "وجبة مقترحة", exact: true }),
  ).toHaveCount(0);
  await goto(page, "رفيقي");
  await page
    .getByRole("button", { name: "راجع تفاصيل الاقتراح وسجّله" })
    .click();
  await page.getByLabel("السعرات", { exact: true }).fill("180");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "تم تسجيل الاقتراح" }),
  ).toBeDisabled();
  await page.reload();
  await goto(page, "رفيقي");
  await expect(page.getByText("راجع وجبتك", { exact: true })).toBeVisible();
  await goto(page, "تغذيتي");
  await expect(
    page.getByRole("heading", { name: "وجبة مقترحة", exact: true }),
  ).toHaveCount(1);
});
test("encrypted backup restores, rejects wrong password, excludes server token", async ({
  page,
}) => {
  await page.goto("/");
  await addMeal(page);
  await page.getByRole("button", { name: "الإعدادات", exact: true }).click();
  await page
    .getByRole("button", { name: "إعداد Gemini API", exact: true })
    .click();
  await page
    .getByLabel("رمز الوصول لخادمك")
    .fill("test-secret-token-do-not-export");
  await page
    .getByRole("button", { name: "حفظ الإعدادات", exact: true })
    .click();
  await page.getByLabel("كلمة مرور النسخة").fill("test-password-123");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "تصدير نسخة" }).click();
  const file = await dl;
  const path = await file.path();
  expect(path).toBeTruthy();
  const contents = await readFile(path!, "utf8");
  expect(contents).not.toContain("test-secret-token-do-not-export");
  const recovered = await page.evaluate(async (text) => {
    const storage = await import("/src/storage.ts");
    const state = await storage.restore(text, "test-password-123");
    return {
      token: state.settings.token,
      auditContainsToken: JSON.stringify(state.audit).includes(
        "test-secret-token-do-not-export",
      ),
    };
  }, contents);
  expect(recovered).toEqual({ token: "", auditContainsToken: false });
  await page.getByLabel("كلمة مرور النسخة").fill("wrong-password");
  await page.locator('input[type=file][accept=".json"]').setInputFiles(path!);
  await expect(page.getByRole("status")).toContainText("كلمة المرور غير صحيحة");
  await page.getByLabel("كلمة مرور النسخة").fill("test-password-123");
  await page.locator('input[type=file][accept=".json"]').setInputFiles(path!);
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "تأكيد", exact: true }).click();
  await goto(page, "تغذيتي");
  await expect(
    page.getByRole("heading", { name: "دجاج مطبوخ 150 غ", exact: true }),
  ).toBeVisible();
});
test("all screens at mobile size stay within viewport and have no runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/");
  for (const tab of ["يومي", "تغذيتي", "تمريني", "تقدمي", "رفيقي"]) {
    await page
      .locator(".mobile-nav")
      .getByRole("button", { name: new RegExp("^" + tab) })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `tmp/pdfs/mobile-${tab}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test("photos stay local until explicit comparison send; deleting removes stored photo", async ({
  page,
}) => {
  let sent = 0;
  await page.route("**/api/chat", (r) => {
    sent++;
    return r.fulfill({ json: { reply: "مقارنة تجريبية", proposal: null } });
  });
  await page.goto("/");
  await goto(page, "تقدمي");
  const fixture = await page.screenshot();
  for (const file of ["one", "two"]) {
    await page.getByRole("button", { name: "إضافة صورة", exact: true }).click();
    await page.locator(".photo-upload input").setInputFiles({
      name: file + ".png",
      mimeType: "image/png",
      buffer: fixture,
    });
    await expect(page.getByAltText("معاينة صورتك قبل الحفظ")).toBeVisible();
    await page.getByRole("button", { name: "حفظ", exact: true }).click();
  }
  await expect(page.locator(".photo-grid .photo")).toHaveCount(2);
  expect(sent).toBe(0);
  await page.reload();
  await goto(page, "تقدمي");
  await expect(page.locator(".photo-grid .photo")).toHaveCount(2);
  await page.locator(".photo>button:first-child").nth(0).click();
  await page.locator(".photo>button:first-child").nth(1).click();
  await page.getByRole("button", { name: "عرض المقارنة", exact: true }).click();
  await expect(page.locator(".compare-grid img")).toHaveCount(2);
  expect(sent).toBe(0);
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await page
    .getByRole("button", { name: "حذف الصورة", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "تأكيد", exact: true }).click();
  await expect(page.locator(".photo-grid .photo")).toHaveCount(1);
});
test("manual note preserves text and non-meal Gemini action opens correct form", async ({
  page,
}) => {
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      json: { reply: "راجع كمية الماي", proposal: { type: "water", ml: 500 } },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "صحتي والساعة", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "تسجيل ملاحظة / مشكلة" }).click();
  await page.getByLabel("عنوان الملاحظة").fill("تفاصيل يومي");
  await page
    .getByLabel("التفاصيل بالحرف")
    .fill("نصّي محفوظ بالحرف\nشربت قهوة بعد الفطور.");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.locator(".journal-entry p")).toHaveText(
    "نصّي محفوظ بالحرف\nشربت قهوة بعد الفطور.",
  );
  await goto(page, "رفيقي");
  await page.getByRole("button", { name: "الاتصال", exact: true }).click();
  await page.getByLabel("نموذج Gemini").fill("gemini-test");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "حفظ الإعدادات" }).click();
  await page.getByLabel("رسالتك لرفيق").fill("شربت 500 مل ماي");
  await page.getByRole("button", { name: "إرسال الرسالة" }).click();
  await page
    .getByRole("button", { name: "راجع تفاصيل الاقتراح وسجّله" })
    .click();
  await page.getByRole("button", { name: "راجع بالنموذج وسجّل" }).click();
  await expect(page.getByLabel("الكمية (مل)")).toHaveValue("500");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await goto(page, "يومي");
  await expect(page.locator(".water .metric-value")).toContainText("0.5");
});
test("storage failure keeps form open and allows retry without duplicate records", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".ring strong")).toBeVisible();
  await page.evaluate(() => {
    const w = window as any;
    w.originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: any[]) {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "سجّل وجبة", exact: true }).click();
  await page.getByLabel("الوجبة والكمية").fill("اختبار الحفظ");
  for (const label of ["السعرات", "بروتين (غ)", "كارب (غ)", "دهون (غ)"])
    await page.getByLabel(label, { exact: true }).fill("10");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("تعذر حفظ");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as any).originalPut;
  });
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "اختبار الحفظ", exact: true }),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "اختبار الحفظ", exact: true }),
  ).toHaveCount(1);
});
