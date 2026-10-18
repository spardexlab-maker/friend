import { test, expect, chromium } from "@playwright/test";
import { initialState } from "../src/domain";
import { flatten, hydrate } from "../src/cloud-codec";
test("usual meals are suggested and scheduled without silently increasing calories", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "سجّل وجبة", exact: true }).click();
  await page.getByLabel("الوجبة والكمية").fill("فطور يومي اختبار");
  await page.getByLabel("السعرات", { exact: true }).fill("300");
  await page.getByLabel("بروتين (غ)", { exact: true }).fill("20");
  await page.getByLabel("كارب (غ)", { exact: true }).fill("30");
  await page.getByLabel("دهون (غ)", { exact: true }).fill("10");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("تم الحفظ في سجلك");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: /^تغذيتي/ })
    .click();
  await page.getByRole("button", { name: "إدارة المعتادة" }).click();
  await page
    .locator(".pin-list")
    .getByRole("button", { name: /فطور يومي اختبار/ })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "انحفظت بالوجبات المعتادة؛ ما انضافت لأكل اليوم",
  );
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await expect(
    page
      .locator(".familiar-grid")
      .getByRole("button", { name: /فطور يومي اختبار/ }),
  ).toBeVisible();
  await expect(page.locator(".summary-strip")).toContainText("300");
  await page.reload();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: /^تغذيتي/ })
    .click();
  await expect(
    page
      .locator(".familiar-grid")
      .getByRole("button", { name: /فطور يومي اختبار/ }),
  ).toBeVisible();
});
test("rest and postpone keep Push as next, skip advances without completing a workout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ما تمرنت اليوم؟" }).click();
  await page.getByRole("button", { name: /راحة اليوم/ }).click();
  await expect(page.getByRole("status")).toHaveText(
    "انحفظ القرار؛ جلسة التمرين تبقى محفوظة",
  );
  await expect(page.locator(".training-day")).toContainText("Push");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: /^تمريني/ })
    .click();
  await expect(page.getByText("خطة Push", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ما تمرنت اليوم؟" }).click();
  await page.getByRole("button", { name: "تأجيل الجلسة", exact: true }).click();
  await expect(page.locator(".training-day")).toContainText("مؤجلة");
  await expect(page.getByText("خطة Push", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ما تمرنت اليوم؟" }).click();
  await page.getByRole("button", { name: /تخطّي الجلسة/ }).click();
  await page.getByRole("button", { name: "تأكيد", exact: true }).click();
  await expect(page.getByText("خطة Pull", { exact: true })).toBeVisible();
  await expect(page.locator(".session-history")).toHaveCount(0);
});
test("voice recording keeps control through pause and only inserts reviewed transcript", async () => {
  const browser = await chromium.launch({
    channel: process.env.CI ? undefined : "msedge",
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const context = await browser.newContext({ permissions: ["microphone"] }),
      page = await context.newPage();
    await page.goto("http://localhost:5173");
    await page
      .locator(".sidebar")
      .getByRole("button", { name: /^رفيقي/ })
      .click();
    await page.route("**/api/transcribe", (r) =>
      r.fulfill({ json: { text: "شربت 500 مل ماي" } }),
    );
    await page.getByRole("button", { name: "تسجيل صوتي", exact: true }).click();
    await page
      .getByRole("button", { name: "ابدأ التسجيل", exact: true })
      .click();
    await expect(
      page.getByText("نسجّل الصوت؛ السكوت ما ينهي التسجيل"),
    ).toBeVisible();
    await page.getByRole("button", { name: "توقف مؤقت", exact: true }).click();
    await expect(page.getByText("التسجيل متوقف مؤقتاً")).toBeVisible();
    await page
      .getByRole("button", { name: "كمل التسجيل", exact: true })
      .click();
    await page
      .getByRole("button", { name: "إنهاء التسجيل", exact: true })
      .click();
    await expect(page.locator("audio")).toBeVisible();
    await page
      .getByLabel(
        "أوافق على إرسال هذا الصوت إلى Google Gemini عبر خادم رفيق لتفريغه",
      )
      .check();
    await page.getByRole("button", { name: "تفريغ التسجيل إلى نص" }).click();
    const transcript = page.getByRole("textbox", {
      name: "راجع وعدّل الكلام قبل إضافته",
    });
    await expect(transcript).toHaveValue("شربت 500 مل ماي");
    await transcript.fill("شربت 400 مل ماي");
    await page.getByRole("button", { name: "إضافة النص للمحادثة" }).click();
    await expect(
      page.getByRole("textbox", { name: "رسالتك لرفيق" }),
    ).toHaveValue("شربت 400 مل ماي");
    await expect(page.locator(".user-bubble")).toHaveCount(0);
  } finally {
    await browser.close();
  }
});
test("new meal templates and training decisions survive cloud roundtrip", () => {
  const s = initialState();
  s.mealTemplates = [
    {
      id: "template",
      enabled: true,
      days: [1, 2],
      meal: {
        name: "synthetic",
        grams: 100,
        kcal: 200,
        protein: 10,
        carbs: 20,
        fat: 8,
        preparation: "cooked",
        original: "synthetic",
      },
    },
  ];
  s.trainingDecisions = [
    {
      id: "decision",
      date: "2026-10-18",
      time: "2026-10-18T09:00:00Z",
      source: "manual",
      status: "postponed",
      name: "Push",
      sessionId: s.sessionId,
      reason: "busy",
      nextDate: "2026-10-19",
    },
  ];
  const documents = Object.entries(flatten(s)).map(([key, payload]) => ({
    key,
    payload,
    version: 1,
    deleted: false,
  }));
  const result = hydrate(initialState(), documents);
  expect(result.mealTemplates).toEqual(s.mealTemplates);
  expect(result.trainingDecisions).toEqual(s.trainingDecisions);
});
