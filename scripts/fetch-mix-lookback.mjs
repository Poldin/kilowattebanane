const SOURCE = {
  "Hydro Run-of-River": "hydro",
  "Hydro water reservoir": "hydro",
  "Hydro pumped storage": "hydro",
  Biomass: "biomass",
  "Fossil hard coal": "coal",
  "Fossil oil": "oil",
  "Fossil coal-derived gas": "gas",
  "Fossil gas": "gas",
  Geothermal: "geothermal",
  Battery: "battery",
  Others: "other",
  "Wind offshore": "wind",
  "Wind onshore": "wind",
  Solar: "solar",
};

const RENEWABLE = new Set(["solar", "wind", "hydro", "geothermal", "biomass"]);
const FOSSIL = new Set(["coal", "oil", "gas"]);
const IDS = [
  "solar",
  "wind",
  "hydro",
  "gas",
  "coal",
  "oil",
  "geothermal",
  "biomass",
  "battery",
  "other",
];

function romeDate(ms) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function romeHour(ms) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(ms)),
  );
}

function totalMw(mw) {
  return IDS.reduce((sum, id) => sum + (mw[id] ?? 0), 0);
}

function stepHours(starts) {
  if (starts.length < 2) return 1;
  const dt = (starts[1] - starts[0]) / 3_600_000;
  if (dt <= 0.4) return 0.25;
  if (dt <= 1.5) return 1;
  return Math.min(dt, 2);
}

async function fetchRange(from, to) {
  const url = `https://api.energy-charts.info/public_power?country=it&start=${from}&end=${to}`;
  let res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "kilowattebanane/1.0" },
    signal: AbortSignal.timeout(40_000),
  });
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after") ?? "35");
    await new Promise((resolve) => setTimeout(resolve, Math.min(60, wait) * 1000));
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "kilowattebanane/1.0" },
      signal: AbortSignal.timeout(40_000),
    });
  }
  if (!res.ok) throw new Error(`energy-charts HTTP ${res.status}`);
  const text = await res.text();
  if (!text || /^no content available/i.test(text.trim())) return [];
  const data = JSON.parse(text);
  const times = data.unix_seconds ?? [];
  const merged = new Map();
  for (const series of data.production_types ?? []) {
    const source = series.name ? SOURCE[series.name] : null;
    if (!source) continue;
    const values = series.data ?? [];
    for (let i = 0; i < times.length; i++) {
      const mw = values[i];
      if (mw == null || !Number.isFinite(mw) || mw <= 0) continue;
      const start = times[i] * 1000;
      const key = `${start}|${source}`;
      const existing = merged.get(key);
      if (existing) {
        existing.mw += mw;
        continue;
      }
      merged.set(key, { start, date: romeDate(start), source, mw });
    }
  }
  return [...merged.values()];
}

function daysFromSlots(slots) {
  const byStart = new Map();
  for (const slot of slots) {
    const group = byStart.get(slot.start) ?? { start: slot.start, date: slot.date, mw: {} };
    group.mw[slot.source] = (group.mw[slot.source] ?? 0) + slot.mw;
    byStart.set(slot.start, group);
  }
  const groups = [...byStart.values()]
    .filter((group) => totalMw(group.mw) >= 5000 && (group.mw.gas ?? 0) > 0)
    .sort((a, b) => a.start - b.start);
  const byDate = new Map();
  for (const group of groups) {
    const list = byDate.get(group.date) ?? [];
    list.push(group);
    byDate.set(group.date, list);
  }
  const days = [];
  for (const date of [...byDate.keys()].sort()) {
    const usable = byDate.get(date);
    const step = stepHours(usable.map((row) => row.start));
    const mwh = {};
    let totalMwh = 0;
    const hours = new Map();
    for (const group of usable) {
      const hour = romeHour(group.start);
      const bucket = hours.get(hour) ?? { mw: {}, n: 0 };
      for (const id of IDS) {
        const value = group.mw[id] ?? 0;
        if (value > 0) {
          mwh[id] = (mwh[id] ?? 0) + value * step;
          totalMwh += value * step;
          bucket.mw[id] = (bucket.mw[id] ?? 0) + value;
        }
      }
      bucket.n += 1;
      hours.set(hour, bucket);
    }
    if (!(totalMwh > 0) || hours.size < 12) continue;
    let peakHour = 0;
    let peakMw = 0;
    let cleanestHour = 0;
    let cleanestShare = 0;
    for (const [hour, bucket] of hours) {
      let total = 0;
      let fer = 0;
      for (const id of IDS) {
        const value = (bucket.mw[id] ?? 0) / bucket.n;
        total += value;
        if (RENEWABLE.has(id)) fer += value;
      }
      if (!(total > 0)) continue;
      if (total > peakMw) {
        peakMw = total;
        peakHour = hour;
      }
      const share = fer / total;
      if (share > cleanestShare + 1e-6 || (Math.abs(share - cleanestShare) <= 1e-6 && hour < cleanestHour)) {
        cleanestShare = share;
        cleanestHour = hour;
      }
    }
    let renewable = 0;
    let fossil = 0;
    const compact = {};
    for (const id of IDS) {
      const value = mwh[id] ?? 0;
      if (value > 0) compact[id] = Math.round(value * 10) / 10;
      if (RENEWABLE.has(id)) renewable += value;
      if (FOSSIL.has(id)) fossil += value;
    }
    days.push({
      date,
      mwh: compact,
      totalMwh: Math.round(totalMwh * 10) / 10,
      renewableShare: Math.round((renewable / totalMwh) * 10_000) / 10_000,
      fossilShare: Math.round((fossil / totalMwh) * 10_000) / 10_000,
      peakMw: Math.round(peakMw * 10) / 10,
      peakHour,
      cleanestHour,
      cleanestShare: Math.round(cleanestShare * 10_000) / 10_000,
      hourCount: hours.size,
    });
  }
  return days;
}

function toSql(days) {
  const esc = (value) => String(value).replace(/'/g, "''");
  const values = days.map((day) =>
    `('${day.date}','${esc(JSON.stringify(day.mwh))}'::jsonb,${day.totalMwh},${day.renewableShare},${day.fossilShare},${day.peakMw},${day.peakHour},${day.cleanestHour},${day.cleanestShare},${day.hourCount},now())`,
  );
  return `insert into generation_mix_day_stats (delivery_date,mwh,total_mwh,renewable_share,fossil_share,peak_mw,peak_hour,cleanest_hour,cleanest_share,hour_count,updated_at) values\n${values.join(",\n")}\non conflict (delivery_date) do update set mwh=excluded.mwh,total_mwh=excluded.total_mwh,renewable_share=excluded.renewable_share,fossil_share=excluded.fossil_share,peak_mw=excluded.peak_mw,peak_hour=excluded.peak_hour,cleanest_hour=excluded.cleanest_hour,cleanest_share=excluded.cleanest_share,hour_count=excluded.hour_count,updated_at=excluded.updated_at;`;
}

const ranges = process.argv[2] === "--all"
  ? [
      ["2025-11-01", "2025-11-30"],
      ["2025-12-01", "2025-12-31"],
      ["2026-01-01", "2026-01-31"],
      ["2026-02-01", "2026-02-28"],
      ["2026-03-01", "2026-03-31"],
      ["2026-04-01", "2026-04-30"],
      ["2026-05-01", "2026-05-31"],
      ["2026-06-01", "2026-06-30"],
      ["2026-07-01", "2026-07-31"],
      ["2026-08-01", "2026-08-14"],
    ]
  : process.argv[2] && process.argv[3]
    ? [[process.argv[2], process.argv[3]]]
    : null;

if (!ranges) {
  console.error("usage: node scripts/fetch-mix-lookback.mjs FROM TO [outfile]");
  process.exit(1);
}

const allDays = [];
for (const [from, to] of ranges) {
  if (allDays.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 35_000));
  }
  const days = daysFromSlots(await fetchRange(from, to));
  console.error(`${from} ${to} -> ${days.length} days`);
  allDays.push(...days);
}

const out = process.argv[2] === "--all" ? "tmp-mix-lookback.json" : process.argv[4];
const payload = JSON.stringify(allDays);
if (out) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(out, payload);
  await fs.writeFile(out.replace(/\.json$/, ".sql"), toSql(allDays));
} else {
  process.stdout.write(payload);
}
