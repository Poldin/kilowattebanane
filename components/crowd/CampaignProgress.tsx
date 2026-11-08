import { formatEuro, fundedPercent } from "@/lib/crowd/format";

export function CampaignProgress({ raised, goal }: { raised: number; goal: number }) {
  const percent = fundedPercent(raised, goal);

  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${formatEuro(raised)} su ${formatEuro(goal)}`}
    >
      <div className="h-full rounded-full bg-[#165B44]" style={{ width: `${percent}%` }} />
    </div>
  );
}
