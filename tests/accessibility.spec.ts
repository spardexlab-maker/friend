import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("narrow phone remains usable with text enlarged by 100 percent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/");
  for (const tab of [
    "يومي",
    "تغذيتي",
    "تمريني",
    "تقدمي",
    "رفيقي",
    "صحتي والساعة",
    "الإعدادات",
  ]) {
    await page
      .locator(
        ["صحتي والساعة", "الإعدادات"].includes(tab) ? "header" : ".mobile-nav",
      )
      .getByRole("button", { name: new RegExp("^" + tab) })
      .click();
    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLElement>("[data-audit-size]")
        .forEach((n) => {
          n.style.fontSize = "";
          n.style.lineHeight = "";
          n.removeAttribute("data-audit-size");
        });
      const sizes = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter(
          (n) =>
            n.childNodes.length &&
            Array.from(n.childNodes).some(
              (c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim(),
            ),
        )
        .map((n) => ({
          n,
          size: parseFloat(getComputedStyle(n).fontSize),
          line: parseFloat(getComputedStyle(n).lineHeight),
        }));
      for (const { n, size, line } of sizes) {
        n.dataset.auditSize = "true";
        n.style.fontSize = `${size * 2}px`;
        if (Number.isFinite(line)) n.style.lineHeight = `${line * 2}px`;
      }
    });
    const overflowing = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("main *"))
        .filter(
          (n) =>
            n.getBoundingClientRect().width &&
            n.getBoundingClientRect().right > innerWidth + 1,
        )
        .map(
          (n) =>
            n.tagName + "." + n.className + " " + n.textContent?.slice(0, 80),
        )
        .slice(0, 10),
    );
    expect(overflowing, tab).toEqual([]);
  }
});
for (const tab of [
  "يومي",
  "تغذيتي",
  "تمريني",
  "تقدمي",
  "رفيقي",
  "صحتي والساعة",
  "الإعدادات",
])
  test(`WCAG AA automated checks: ${tab}`, async ({ page }) => {
    await page.goto("/");
    await page
      .locator(tab === "الإعدادات" ? "header" : ".sidebar")
      .getByRole("button", { name: new RegExp("^" + tab) })
      .click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      tab,
    ).toEqual([]);
  });
test("WCAG AA automated checks: food dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "سجّل وجبة", exact: true }).click();
  const dialog = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    dialog.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});
