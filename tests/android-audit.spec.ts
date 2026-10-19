import { test, expect } from "@playwright/test";
test("dialog keeps keyboard focus inside and restores it when closed", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "سجّل وجبة", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "إغلاق", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "حفظ", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "إغلاق", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("السعرات", { exact: true })).toHaveAttribute(
    "dir",
    "ltr",
  );
  await expect(page.getByLabel("الوجبة والكمية")).toHaveAttribute(
    "dir",
    "auto",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test("failed chat persistence keeps draft and never sends it to AI", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".performance-hub").waitFor();
  await page.evaluate(async () => {
    const { initialState } = await import("/src/domain.ts" as string);
    const s = initialState();
    s.settings.consent = true;
    s.settings.model = "gemini-test";
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
    .getByRole("button", { name: /^رفيقي/ })
    .click();
  let requests = 0;
  await page.route("**/api/chat", (r) => {
    requests++;
    return r.fulfill({ json: { reply: "synthetic", proposal: null } });
  });
  await page.evaluate(() => {
    (window as any).__originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.getByLabel("رسالتك لرفيق").fill("نص لازم يبقى إذا فشل الحفظ");
  await page.getByRole("button", { name: "إرسال الرسالة" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("رسالتك لرفيق")).toHaveValue(
    "نص لازم يبقى إذا فشل الحفظ",
  );
  expect(requests).toBe(0);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as any).__originalPut;
  });
  await page
    .getByRole("button", { name: "إعادة المحاولة", exact: true })
    .click();
  await expect(page.getByText("synthetic", { exact: true })).toBeVisible();
  expect(requests).toBe(1);
});
test("reentrant form submit does not create two meals", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "سجّل وجبة", exact: true }).click();
  await page.getByLabel("الوجبة والكمية").fill("وجبة اختبار ضغطتين");
  for (const label of ["السعرات", "بروتين (غ)", "كارب (غ)", "دهون (غ)"])
    await page.getByLabel(label, { exact: true }).fill("10");
  await page
    .getByRole("dialog")
    .locator("form")
    .evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
    });
  await expect(page.getByRole("status")).toHaveText("تم الحفظ في سجلك");
  await expect(
    page.getByRole("heading", { name: "وجبة اختبار ضغطتين", exact: true }),
  ).toHaveCount(1);
});
