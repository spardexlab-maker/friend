import type { HealthSample } from "@capgo/capacitor-health";
export function sourceSamples(samples: HealthSample[]) {
  const groups = new Map<string, HealthSample[]>();
  for (const s of samples) {
    if (!Number.isFinite(s.value) || !Number.isFinite(Date.parse(s.startDate)))
      continue;
    const key = s.sourceId || s.sourceName || "unknown";
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  const ranked = [...groups.entries()].sort(
    ([a, x], [b, y]) =>
      Number(/shealth/i.test(b)) - Number(/shealth/i.test(a)) ||
      y.length - x.length ||
      a.localeCompare(b),
  );
  const selected = ranked[0]?.[1] ?? [];
  return [
    ...new Map(
      selected.map((s) => [`${s.startDate}|${s.endDate}|${s.value}`, s]),
    ).values(),
  ].sort((a, b) => a.startDate.localeCompare(b.startDate));
}
export function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b),
    n = sorted.length;
  return n
    ? (sorted[Math.floor(n / 2)] + sorted[Math.floor((n - 1) / 2)]) / 2
    : null;
}
