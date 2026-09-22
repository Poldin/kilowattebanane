import { formatMonthShortIt, romeToday } from "@/lib/offerte/dates";
import { FORWARD_MONTH_HORIZON, loadPunForwardBlend } from "@/lib/offerte/forward";
import { loadParametriMap, regulatedStack } from "@/lib/offerte/regulated";

export const revalidate = 3600;

function caricoOf(cliente: "domestico" | "non domestico", params: Map<string, number>) {
  const stack = regulatedStack(params, {
    cliente,
    residente: cliente === "domestico",
    potenzaKw: 3,
  });
  return {
    lambda: stack.lambda || 0.1,
    accisaPerKwh: stack.accisaPerKwh,
    ivaRate: stack.ivaRate,
  };
}

export async function GET() {
  try {
    const [blend, params] = await Promise.all([
      loadPunForwardBlend(romeToday()),
      loadParametriMap(),
    ]);
    const months = blend.months.slice(0, FORWARD_MONTH_HORIZON).map((month) => ({
      start: month.start,
      label: formatMonthShortIt(month.start),
      eurKwh: month.punEurKwh,
    }));
    return Response.json(
      {
        months,
        carico: {
          domestico: caricoOf("domestico", params),
          nonDomestico: caricoOf("non domestico", params),
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prezzi medi non disponibili";
    return Response.json({ error: message }, { status: 500 });
  }
}
