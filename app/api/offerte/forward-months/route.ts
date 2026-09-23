import type { ComparePunShape } from "@/lib/offerte/compare-spend";
import { formatMonthShortIt, romeToday } from "@/lib/offerte/dates";
import { FORWARD_MONTH_HORIZON, loadPunForwardBlend } from "@/lib/offerte/forward";
import { loadParametriMap, regulatedStack } from "@/lib/offerte/regulated";
import { fasciaFactors, loadLatestPunShape } from "@/lib/offerte/shape";

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

function shapeOf(
  shape: Awaited<ReturnType<typeof loadLatestPunShape>>,
): ComparePunShape | null {
  if (!shape || shape.hourlyRel.length !== 24) return null;
  const factors = fasciaFactors(shape);
  return {
    hourlyRel: shape.hourlyRel,
    factorF1: factors.factorF1,
    factorF2: factors.factorF2,
    factorF3: factors.factorF3,
    factorF23: factors.factorF23,
  };
}

export async function GET() {
  try {
    const [blend, params, shape] = await Promise.all([
      loadPunForwardBlend(romeToday()),
      loadParametriMap(),
      loadLatestPunShape().catch(() => null),
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
        shape: shapeOf(shape),
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prezzi medi non disponibili";
    return Response.json({ error: message }, { status: 500 });
  }
}
