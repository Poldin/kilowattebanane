import { loadOfferteHeadlineStats } from "@/lib/offerte/stats";
import { OfferteLanding } from "@/components/offerte/OfferteLanding";

export async function OfferteModule({ className }: { className?: string }) {
  const stats = await loadOfferteHeadlineStats();
  return <OfferteLanding stats={stats} className={className} />;
}
