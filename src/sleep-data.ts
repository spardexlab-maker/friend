import type { HealthSample } from "@capgo/capacitor-health";
export function summarizeSleep(samples: HealthSample[], date: string) {
  const day = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baghdad",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  const matching = samples.filter(
    (x) =>
      x.dataType === "sleep" &&
      Number.isFinite(Date.parse(x.startDate)) &&
      Number.isFinite(Date.parse(x.endDate)) &&
      Date.parse(x.endDate) > Date.parse(x.startDate) &&
      day(x.endDate) === date,
  );
  const grouped = new Map<string, HealthSample[]>();
  for (const sample of matching) {
    const key = sample.sourceId || sample.sourceName || "unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), sample]);
  }
  let best: HealthSample[] = [];
  let bestDuration = -1;
  for (const list of grouped.values()) {
    const duration = list.reduce((sum, x) => sum + x.value, 0),
      samsung = list.some((x) => (x.sourceId ?? "").includes("shealth"));
    if (samsung || duration > bestDuration) {
      best = list;
      bestDuration = duration;
      if (samsung) break;
    }
  }
  const intervals = best
    .flatMap((sample) =>
      sample.stages?.some((x) =>
        ["asleep", "deep", "light", "rem"].includes(x.stage),
      )
        ? sample.stages
            .filter((x) => ["asleep", "deep", "light", "rem"].includes(x.stage))
            .map((x) => ({
              start: Date.parse(x.startDate),
              end: Date.parse(x.endDate),
            }))
        : [
            {
              start: Date.parse(sample.startDate),
              end: Date.parse(sample.endDate),
            },
          ],
    )
    .sort((a, b) => a.start - b.start);
  let end = -Infinity,
    total = 0;
  for (const i of intervals) {
    if (
      !Number.isFinite(i.start) ||
      !Number.isFinite(i.end) ||
      i.end <= i.start
    )
      continue;
    total += Math.max(0, i.end - Math.max(end, i.start));
    end = Math.max(end, i.end);
  }
  return {
    minutes: best.length ? total / 60000 : null,
    samples: best,
    hasStages: best.some((x) => x.hasStageData),
  };
}
