import { loadOfferteHeadlineStats } from "@/lib/offerte/stats";

export const revalidate = 3600;

export async function GET() {
  try {
    const stats = await loadOfferteHeadlineStats();
    return Response.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stats failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
