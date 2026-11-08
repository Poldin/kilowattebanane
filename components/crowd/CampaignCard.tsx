import { CampaignProgress } from "@/components/crowd/CampaignProgress";
import { DonorBlockCompact } from "@/components/crowd/DonorBlock";
import { ExploreLink } from "@/components/crowd/ExploreButton";
import { campaignPath, campaignRaised } from "@/lib/crowd/campaigns";
import { formatEuro } from "@/lib/crowd/format";
import { mergePreview } from "@/lib/crowd/rank";
import type { CrowdCampaign } from "@/lib/crowd/types";

export function CampaignCard({ campaign }: { campaign: CrowdCampaign }) {
  const raised = campaignRaised(campaign);
  const leader = mergePreview(campaign.donors, null)[0];

  return (
    <article className="rounded-lg bg-neutral-100 px-5 py-6 dark:bg-neutral-900 sm:px-6 sm:py-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          {campaign.title}
        </h2>
        <ExploreLink href={campaignPath(campaign.slug)} />
      </div>
      <p className="mt-4 text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
        {formatEuro(raised)} / {formatEuro(campaign.goalEuro)}
      </p>
      <div className="mt-3">
        <CampaignProgress raised={raised} goal={campaign.goalEuro} />
      </div>
      {leader ? <DonorBlockCompact donor={leader} /> : null}
    </article>
  );
}
