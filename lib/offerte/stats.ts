import { unstable_cache } from "next/cache";
import { offerteReadClient, paginateSelect } from "@/lib/offerte/db";
import { romeToday } from "@/lib/offerte/dates";
import type { OfferteHeadlineStats } from "@/lib/offerte/public-types";

export type { OfferteHeadlineStats } from "@/lib/offerte/public-types";

type LiveRow = {
  p_iva: string | null;
  tipo_offerta: string | null;
  last_seen_on: string | null;
};

export const loadOfferteHeadlineStats = unstable_cache(
  async (): Promise<OfferteHeadlineStats> => {
    const client = offerteReadClient();
    const today = romeToday();
    const [placetRows, mlRows] = await Promise.all([
      paginateSelect<LiveRow>((from, to) =>
        client
          .from("po_placet_e_live")
          .select("p_iva, tipo_offerta, last_seen_on")
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
      paginateSelect<LiveRow>((from, to) =>
        client
          .from("po_ml_e_live")
          .select("p_iva, tipo_offerta, last_seen_on")
          .lte("valid_from", today)
          .gte("valid_to", today)
          .range(from, to),
      ),
    ]);

    const vendors = new Set(
      [...placetRows, ...mlRows]
        .map((row) => row.p_iva)
        .filter((value): value is string => Boolean(value)),
    );
    const snapshotDate =
      placetRows[0]?.last_seen_on ?? mlRows[0]?.last_seen_on ?? today;

    return {
      snapshotDate,
      placet: placetRows.length,
      ml: mlRows.length,
      total: placetRows.length + mlRows.length,
      venditori: vendors.size,
      fisso: [...placetRows, ...mlRows].filter((row) =>
        (row.tipo_offerta ?? "").includes("fisso"),
      ).length,
      variabile: [...placetRows, ...mlRows].filter((row) =>
        (row.tipo_offerta ?? "").includes("variabile"),
      ).length,
    };
  },
  ["offerte-headline-stats"],
  { revalidate: 3600 },
);
