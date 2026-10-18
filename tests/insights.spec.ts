import { test, expect } from "@playwright/test";
import { initialState, stateSchema } from "../src/domain";
import {
  recovery,
  sleepMinutes,
  zoneMinutes,
  habitInsights,
  shiftDay,
} from "../src/insights";
import { summarizeSleep } from "../src/sleep-data";
import { flatten, hydrate, changesBetween } from "../src/cloud-codec";
const date = "2026-10-18";
const health = (
  day: string,
  rhr: number | null,
  hrv: number | null,
  sleep: number | null,
) => ({
  date: day,
  syncedAt: day + "T12:00:00Z",
  values: { restingHeartRate: rhr, heartRateVariability: hrv, sleep },
  samples: [],
  errors: [],
});
test("readiness requires historical physiological baseline and excludes future days", () => {
  const s = initialState();
  expect(recovery(s, date).score).toBeNull();
  s.health = health(date, 60, 55, 480);
  expect(recovery(s, date).score).toBeNull();
  s.healthHistory = [
    health("2026-10-19", 10, 400, 900),
    ...[-1, -2, -3].map((i) => health(shiftDay(date, i), 60, 50, 480)),
  ];
  const r = recovery(s, date);
  expect(r.hrvBase).toBe(50);
  expect(r.rhrBase).toBe(60);
  expect(r.score).not.toBeNull();
  expect(r.score!).toBeGreaterThanOrEqual(0);
  expect(r.score!).toBeLessThanOrEqual(100);
});
test("manual sleep overlap is counted once; source stages exclude waking and duplicate writers", () => {
  const s = initialState();
  s.sleep = [
    ["2026-10-17T22:00:00Z", "2026-10-18T04:00:00Z"],
    ["2026-10-18T03:00:00Z", "2026-10-18T05:00:00Z"],
  ].map(([start, end], i) => ({
    id: String(i),
    date,
    time: start,
    source: "manual",
    start,
    end,
    quality: 3,
    notes: "",
  }));
  expect(sleepMinutes(s, date).minutes).toBe(420);
  const records = [
    {
      dataType: "sleep" as const,
      value: 480,
      unit: "minute" as const,
      startDate: "2026-10-17T22:00:00Z",
      endDate: "2026-10-18T06:00:00Z",
      sourceId: "com.sec.android.app.shealth",
      hasStageData: true,
      stages: [
        {
          stage: "deep" as const,
          startDate: "2026-10-17T22:00:00Z",
          endDate: "2026-10-18T02:00:00Z",
          durationMinutes: 240,
        },
        {
          stage: "awake" as const,
          startDate: "2026-10-18T02:00:00Z",
          endDate: "2026-10-18T03:00:00Z",
          durationMinutes: 60,
        },
        {
          stage: "light" as const,
          startDate: "2026-10-18T03:00:00Z",
          endDate: "2026-10-18T06:00:00Z",
          durationMinutes: 180,
        },
      ],
    },
  ];
  const result = summarizeSleep(
    [
      ...records,
      { ...records[0], sourceId: "other.writer", stages: undefined },
    ],
    date,
  );
  expect(result.minutes).toBe(420);
  expect(result.samples).toHaveLength(1);
  expect(summarizeSleep(records, "2026-10-19").minutes).toBeNull();
});
test("heart zones never bridge unobserved periods or invent strain from sparse readings", () => {
  const s = initialState();
  s.sensorReadings = [0, 1, 2, 20, 21, 22].map((m, i) => ({
    id: String(i),
    date,
    time: new Date(Date.parse(date + "T09:00:00Z") + m * 60000).toISOString(),
    bpm: 120,
    accuracy: 3,
    source: "watch",
  }));
  const zones = zoneMinutes(s, date);
  expect(zones.sampled).toBe(4);
  expect(zones.effort).toBeNull();
});
test("cloud roundtrip preserves health history, wellness, checkins and sensor ids", () => {
  const s = initialState();
  s.health = health(date, 60, 50, 450);
  s.healthHistory = [health("2026-10-17", 61, 49, 470)];
  s.wellness = { sleepGoal: 7.5, wakeTime: "08:00" };
  s.checkins = [
    {
      id: "c1",
      date,
      time: date + "T09:00:00Z",
      source: "manual",
      energy: 4,
      soreness: 2,
      stress: 2,
      caffeineLate: false,
      lateMeal: true,
      notes: "synthetic",
    },
  ];
  s.sensorReadings = [
    {
      id: "h1",
      date,
      time: date + "T09:00:00Z",
      bpm: 80,
      accuracy: 3,
      source: "watch",
    },
  ];
  const docs = Object.entries(flatten(s)).map(([key, payload]) => ({
    key,
    payload,
    version: 1,
    deleted: false,
  }));
  const restored = hydrate(initialState(), docs);
  expect(restored.wellness).toEqual(s.wellness);
  expect(restored.checkins).toEqual(s.checkins);
  expect(restored.sensorReadings).toEqual(s.sensorReadings);
  expect(restored.healthHistory.map((h) => h.date).sort()).toEqual([
    "2026-10-17",
    date,
  ]);
  const next = { ...restored, checkins: [] };
  expect(changesBetween(restored, next, { "checkins:c1": 1 })).toContainEqual({
    key: "checkins:c1",
    payload: {},
    deleted: true,
    expected_version: 1,
  });
  const { healthHistory, checkins, sensorReadings, wellness, ...old } = s;
  expect(stateSchema.parse(old).wellness.sleepGoal).toBe(8);
});
test("daily checkin and sleep target persist and health layout fits narrow phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /شلون تحس اليوم/ }).click();
  await page.locator('select[name="energy"]').selectOption("4");
  await page
    .getByRole("button", { name: "حفظ إحساس اليوم", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /إحساسك اليوم مسجّل/ }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("انحفظ إحساسك وعاداتك");
  await page.reload();
  await expect(
    page.getByRole("button", { name: /إحساسك اليوم مسجّل/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "الحساسات والمصادر" }).click();
  await page.locator('input[name="hours"]').fill("7.5");
  await page.getByRole("button", { name: "حفظ هدف النوم" }).click();
  await expect(page.getByRole("status")).toHaveText("تحدّث هدف نومك");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "tmp/performance-health-mobile.png",
    fullPage: true,
  });
});
