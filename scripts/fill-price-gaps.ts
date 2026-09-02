import { pullDayAheadRange } from "../lib/day-ahead";
import type { MarketZoneId } from "../lib/market-zones";

const GAPS: { zone: MarketZoneId; from: string; to: string }[] = [
  { zone: "IT-South", from: "2025-10-08", to: "2025-10-14" },
  { zone: "IT-South", from: "2025-10-29", to: "2025-11-04" },
  { zone: "IT-South", from: "2025-11-26", to: "2025-12-09" },
  { zone: "IT-South", from: "2025-12-17", to: "2026-01-06" },
  { zone: "IT-South", from: "2026-01-14", to: "2026-01-20" },
  { zone: "IT-South", from: "2026-02-11", to: "2026-02-17" },
  { zone: "IT-South", from: "2026-03-04", to: "2026-03-10" },
  { zone: "IT-South", from: "2026-03-18", to: "2026-03-24" },
  { zone: "IT-South", from: "2026-04-08", to: "2026-04-14" },
  { zone: "IT-South", from: "2026-05-13", to: "2026-05-26" },
  { zone: "IT-South", from: "2026-06-03", to: "2026-06-09" },
  { zone: "IT-South", from: "2026-06-17", to: "2026-06-23" },
  { zone: "IT-South", from: "2026-07-22", to: "2026-07-28" },
  { zone: "IT-South", from: "2026-08-13", to: "2026-08-13" },
  { zone: "IT-Sicily", from: "2025-10-22", to: "2025-10-28" },
  { zone: "IT-Sicily", from: "2025-11-12", to: "2025-11-25" },
  { zone: "IT-Sicily", from: "2025-12-03", to: "2025-12-09" },
  { zone: "IT-Sicily", from: "2026-02-25", to: "2026-03-03" },
  { zone: "IT-Sicily", from: "2026-03-25", to: "2026-03-31" },
  { zone: "IT-Sicily", from: "2026-04-15", to: "2026-04-21" },
  { zone: "IT-Sicily", from: "2026-05-20", to: "2026-05-26" },
  { zone: "IT-Sicily", from: "2026-06-17", to: "2026-06-23" },
  { zone: "IT-Sicily", from: "2026-07-01", to: "2026-07-14" },
  { zone: "IT-Sicily", from: "2026-07-29", to: "2026-08-16" },
  { zone: "IT-Sardinia", from: "2025-10-01", to: "2025-10-07" },
  { zone: "IT-Sardinia", from: "2025-11-12", to: "2025-11-18" },
  { zone: "IT-Sardinia", from: "2025-12-10", to: "2025-12-16" },
  { zone: "IT-Sardinia", from: "2025-12-31", to: "2026-01-06" },
  { zone: "IT-Sardinia", from: "2026-02-04", to: "2026-02-10" },
  { zone: "IT-Sardinia", from: "2026-02-25", to: "2026-03-03" },
  { zone: "IT-Sardinia", from: "2026-04-01", to: "2026-04-07" },
  { zone: "IT-Sardinia", from: "2026-05-06", to: "2026-05-12" },
  { zone: "IT-Sardinia", from: "2026-05-27", to: "2026-06-02" },
  { zone: "IT-Sardinia", from: "2026-07-15", to: "2026-07-28" },
  { zone: "IT-Sardinia", from: "2026-08-13", to: "2026-08-13" },
  { zone: "IT-North", from: "2025-10-15", to: "2025-11-11" },
  { zone: "IT-North", from: "2025-12-03", to: "2025-12-09" },
  { zone: "IT-North", from: "2026-02-04", to: "2026-02-10" },
  { zone: "IT-North", from: "2026-02-18", to: "2026-02-24" },
  { zone: "IT-North", from: "2026-03-18", to: "2026-03-24" },
  { zone: "IT-North", from: "2026-04-15", to: "2026-04-21" },
  { zone: "IT-North", from: "2026-06-10", to: "2026-06-16" },
  { zone: "IT-North", from: "2026-08-13", to: "2026-08-13" },
  { zone: "IT-Centre-South", from: "2025-11-05", to: "2025-11-11" },
  { zone: "IT-Centre-South", from: "2025-12-10", to: "2025-12-16" },
  { zone: "IT-Centre-South", from: "2026-02-04", to: "2026-02-10" },
  { zone: "IT-Centre-South", from: "2026-03-11", to: "2026-03-17" },
  { zone: "IT-Centre-South", from: "2026-04-01", to: "2026-04-07" },
  { zone: "IT-Centre-South", from: "2026-05-06", to: "2026-05-12" },
  { zone: "IT-Centre-South", from: "2026-05-27", to: "2026-06-02" },
  { zone: "IT-Centre-South", from: "2026-06-10", to: "2026-06-16" },
  { zone: "IT-Centre-South", from: "2026-06-24", to: "2026-06-30" },
  { zone: "IT-Centre-South", from: "2026-08-13", to: "2026-08-13" },
  { zone: "IT-Calabria", from: "2025-10-15", to: "2025-10-21" },
  { zone: "IT-Calabria", from: "2026-01-07", to: "2026-01-13" },
  { zone: "IT-Calabria", from: "2026-01-21", to: "2026-01-27" },
  { zone: "IT-Calabria", from: "2026-02-18", to: "2026-02-24" },
  { zone: "IT-Calabria", from: "2026-04-15", to: "2026-05-05" },
  { zone: "IT-Calabria", from: "2026-05-20", to: "2026-05-26" },
  { zone: "IT-Calabria", from: "2026-08-07", to: "2026-08-07" },
  { zone: "IT-Calabria", from: "2026-08-13", to: "2026-08-13" },
  { zone: "IT-Centre-North", from: "2025-10-22", to: "2025-10-28" },
  { zone: "IT-Centre-North", from: "2025-11-12", to: "2025-11-18" },
  { zone: "IT-Centre-North", from: "2026-01-28", to: "2026-02-03" },
  { zone: "IT-Centre-North", from: "2026-02-25", to: "2026-03-03" },
  { zone: "IT-Centre-North", from: "2026-03-25", to: "2026-03-31" },
  { zone: "IT-Centre-North", from: "2026-07-15", to: "2026-07-21" },
  { zone: "IT-Centre-North", from: "2026-07-29", to: "2026-08-04" },
  { zone: "IT-Centre-North", from: "2026-08-13", to: "2026-08-13" },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let upserted = 0;
  let failed = 0;

  for (const gap of GAPS) {
    process.stdout.write(`  ${gap.zone} ${gap.from} → ${gap.to} ... `);
    try {
      const summary = await pullDayAheadRange(gap.from, gap.to, [gap.zone]);
      upserted += summary.upserted;
      const err = summary.errors[0]?.message ?? "";
      console.log(`${summary.upserted} rows${err ? ` (${err})` : ""}`);
      if (summary.errors.length || summary.upserted === 0) failed += 1;
    } catch (error) {
      failed += 1;
      console.log(error instanceof Error ? error.message : error);
    }
    await sleep(2000);
  }

  console.log(`Done. upserted=${upserted} failed=${failed}/${GAPS.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
