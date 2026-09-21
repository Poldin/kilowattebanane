import { romeToday } from "@/lib/day-ahead-core";
import { buildPriceMailModel } from "@/lib/mail/content";
import { sendDigestPreview } from "@/lib/mail/send";
import { DEFAULT_REGION, zoneForRegion } from "@/lib/market-zones";

async function main() {
  const to = process.argv[2] ?? "oloapiccoli@gmail.com";
  const date = process.argv[3] ?? romeToday();
  const zone = zoneForRegion(DEFAULT_REGION);

  if (!zone) throw new Error("Zona non valida");

  const model = await buildPriceMailModel(DEFAULT_REGION, zone, date);
  if (!model) throw new Error(`Nessun dato per ${date}`);

  const id = await sendDigestPreview(to, model);
  console.log(JSON.stringify({ ok: true, to, date, zone, id }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
