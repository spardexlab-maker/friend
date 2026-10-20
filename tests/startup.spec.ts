import { test, expect } from "@playwright/test";

test("cached account opens and saves locally while cloud startup is stalled", async ({ page }) => {
  await page.route("**/src/cloud-auth.tsx", route => route.fulfill({
    contentType: "application/javascript",
    body: `export const useCloudAuth=()=>({user:{id:'startup-test'},enabled:true});
      export const CloudProvider=({children})=>children;
      export const AuthGate=({children})=>children;`,
  }));
  await page.route("**/rest/v1/**", () => {});
  await page.goto("/");
  await expect(page.getByRole("button", { name: "سجّل وجبة", exact: true })).toBeVisible();
  await expect(page.getByText("نرتّب مساحتك…")).toHaveCount(0);
  await page.getByRole("button", { name: "سجّل وجبة", exact: true }).click();
  await page.getByLabel("الوجبة والكمية").fill("وجبة أثناء انقطاع المزامنة");
  await page.getByLabel("السعرات", { exact: true }).fill("200");
  await page.getByLabel("بروتين (غ)", { exact: true }).fill("20");
  await page.getByLabel("كارب (غ)", { exact: true }).fill("30");
  await page.getByLabel("دهون (غ)", { exact: true }).fill("0");
  await page.getByRole("button", { name: "حفظ", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "وجبة أثناء انقطاع المزامنة", exact: true })).toBeVisible();
});

test("cloud requests time out and respect caller cancellation", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    // @ts-expect-error browser module served by Vite
    const { cloudFetch } = await import("/src/cloud-fetch.ts");
    const originalFetch = window.fetch;
    const originalTimer = window.setTimeout;
    window.fetch = ((_input: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
      const fail = () => reject(new DOMException("Aborted", "AbortError"));
      if (init.signal?.aborted) fail();
      else init.signal?.addEventListener("abort", fail, { once: true });
    })) as typeof fetch;
    window.setTimeout = ((fn: TimerHandler) => originalTimer(fn, 10)) as typeof setTimeout;
    try {
      const timeout = await cloudFetch("https://example.test/rest/v1/data").then(() => false, () => true);
      const controller = new AbortController();
      controller.abort();
      const cancelled = await cloudFetch("https://example.test/rest/v1/data", { signal: controller.signal }).then(() => false, () => true);
      return { timeout, cancelled };
    } finally {
      window.fetch = originalFetch;
      window.setTimeout = originalTimer;
    }
  });
  expect(result).toEqual({ timeout: true, cancelled: true });
});
