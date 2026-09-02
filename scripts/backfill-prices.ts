import { addCalendarDays } from "../lib/entsoe";
import { pullDayAheadRange } from "../lib/day-ahead";
import { MARKET_ZONES, type MarketZoneId } from "../lib/market-zones";

const CHUNK_DAYS = 7;
const DEFAULT_FROM = "2025-10-01";
const DEFAULT_TO = "2026-08-16";

function parseArg(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function parseZones(): MarketZoneId[] | undefined {
  const raw = parseArg("zone");
  if (!raw) return undefined;
  const zone = raw as MarketZoneId;
  if (!(zone in MARKET_ZONES)) throw new Error(`Unknown zone ${raw}`);
  return [zone];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const start = parseArg("from", DEFAULT_FROM);
  const end = parseArg("to", DEFAULT_TO);
  const zoneIds = parseZones();
  if (start > end) {
    throw new Error(`Invalid range ${start} > ${end}`);
  }

  let cursor = start;
  let windows = 0;
  let upserted = 0;
  const errors: string[] = [];

  console.log(`Backfill ${start} → ${end} in ${CHUNK_DAYS}-day windows`);

  while (cursor <= end) {
    const windowEnd = addCalendarDays(cursor, CHUNK_DAYS - 1);
    const to = windowEnd < end ? windowEnd : end;
    windows += 1;
    process.stdout.write(`  ${cursor} → ${to} ... `);

    try {
      const summary = await pullDayAheadRange(cursor, to, zoneIds);
      upserted += summary.upserted;
      const sources = [...new Set(summary.zones.map((zone) => zone.source))].join(",");
      const err = summary.errors.length
        ? ` errors=${summary.errors.map((item) => item.zone).join(",")}`
        : "";
      console.log(`${summary.upserted} rows (${sources || "none"})${err}`);
      for (const item of summary.errors) {
        errors.push(`${cursor} ${item.zone}: ${item.message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FAILED ${message}`);
      errors.push(`${cursor}: ${message}`);
    }

    cursor = addCalendarDays(to, 1);
    await sleep(1500);
  }

  console.log(`Done. windows=${windows} upserted=${upserted} errors=${errors.length}`);
  if (errors.length) {
    for (const line of errors.slice(0, 20)) console.log(`  - ${line}`);
    if (errors.length > 20) console.log(`  … ${errors.length - 20} more`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
