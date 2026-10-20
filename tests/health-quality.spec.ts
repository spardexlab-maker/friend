import { test, expect } from "@playwright/test";
import { sourceSamples, median } from "../src/health-quality";
import { heartSeries, zoneMinutes, recovery } from "../src/insights";
import { initialState, stateSchema } from "../src/domain";
import { eventSchema, mergeWearEvents } from "../src/wear-events";
import type { HealthSample } from "@capgo/capacitor-health";
const date = "2026-10-20";
const sample = (
  time: string,
  value: number,
  sourceId = "com.sec.android.app.shealth",
): HealthSample => ({
  dataType: "heartRate",
  startDate: time,
  endDate: time,
  value,
  unit: "bpm",
  sourceId,
});
test("keeps a full day beyond 500 samples and selects one reproducible source", () => {
  const samples = Array.from({ length: 1440 }, (_, i) =>
    sample(
      new Date(Date.parse(date + "T00:00:00Z") + i * 60000).toISOString(),
      80,
    ),
  );
  const selected = sourceSamples([
    ...samples,
    ...samples.map((x) => ({ ...x, sourceId: "other", value: 150 })),
    samples[0],
  ]);
  expect(selected).toHaveLength(1440);
  expect(median(selected.map((x) => x.value))).toBe(80);
});
test("overlapping watch stream never counts an imported minute twice", () => {
  const s = initialState();
  s.health = {
    date,
    syncedAt: date,
    values: {},
    errors: [],
    samples: [sample(date + "T09:00:00Z", 80), sample(date + "T09:01:00Z", 80)],
  };
  s.sensorReadings = [
    {
      id: "a",
      date,
      time: date + "T09:00:30Z",
      bpm: 200,
      accuracy: 3,
      source: "watch",
    },
    {
      id: "b",
      date,
      time: date + "T09:01:30Z",
      bpm: 200,
      accuracy: 3,
      source: "watch",
    },
  ];
  expect(heartSeries(s, date)).toHaveLength(2);
  expect(zoneMinutes(s, date).sampled).toBe(1);
});
test("health metadata and unknown signal quality survive validation; exercise summary saves once", () => {
  let s = initialState();
  s.health.metadata = {
    heartRate: {
      status: "available",
      source: "Samsung",
      time: date + "T09:00:00Z",
      count: 1440,
      method: "mean",
    },
  };
  expect(stateSchema.parse(s).health.metadata?.heartRate.count).toBe(1440);
  const event = eventSchema.parse({
    id: "session-a",
    type: "exerciseSummary",
    time: date + "T09:00:00Z",
    name: "WALKING",
    seconds: 600,
    kcal: 40,
  });
  s = mergeWearEvents(s, [event, event]);
  expect(s.journal).toHaveLength(1);
  expect(s.cardio).toHaveLength(0);
});
test("new HRV daily median cannot silently reuse a legacy latest-sample baseline", () => {
  const s = initialState();
  s.health = {
    date,
    syncedAt: date,
    values: { hrvDailyMedian: 1, heartRateVariability: 50, sleep: 480 },
    samples: [],
    errors: [],
  };
  s.healthHistory = ["17", "18", "19"].map((d) => ({
    date: "2026-10-" + d,
    syncedAt: date,
    values: { heartRateVariability: 50 },
    samples: [],
    errors: [],
  }));
  expect(recovery(s, date).score).toBeNull();
});
