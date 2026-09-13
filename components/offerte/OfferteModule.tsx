import { loadOfferteHeadlineStats } from "@/lib/offerte/stats";
import { OfferteExplorer } from "@/components/offerte/OfferteExplorer";

export async function OfferteModule({ className }: { className?: string }) {
  const stats = await loadOfferteHeadlineStats();
  return <OfferteExplorer stats={stats} className={className} />;
}
