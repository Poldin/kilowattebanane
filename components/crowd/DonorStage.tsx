"use client";

import { useState } from "react";
import { CampaignProgress } from "@/components/crowd/CampaignProgress";
import { crowdShareQuietClass, DonateNowButton } from "@/components/crowd/DonateNowButton";
import { ShareButton } from "@/components/ShareButton";
import {
  DonorBlockCard,
  DonorBlockLeader,
  DonorBlockRow,
} from "@/components/crowd/DonorBlock";
import { exploreClass } from "@/components/crowd/ExploreButton";
import { formatEuro } from "@/lib/crowd/format";
import { mergePreview } from "@/lib/crowd/rank";
import type { CrowdDonor } from "@/lib/crowd/types";

export function DonorStage({
  title,
  place,
  kwp,
  story,
  raised,
  goal,
  donors,
  shareUrl,
  shareTitle,
  shareText,
}: {
  title: string;
  place: string;
  kwp: number;
  story: string;
  raised: number;
  goal: number;
  donors: CrowdDonor[];
  shareUrl: string;
  shareTitle: string;
  shareText: string;
}) {
  const [open, setOpen] = useState(false);
  const ranked = mergePreview(donors, null);
  const [first, ...rest] = ranked;
  const podium = rest.filter((donor) => donor.rank <= 3);
  const tail = rest.filter((donor) => donor.rank > 3);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h1>
        <button
          type="button"
          className={exploreClass}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          esplora progetto
        </button>
      </div>
      {open ? (
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {story} {place} · {kwp} kWp.
        </p>
      ) : null}

      <p className="mt-4 text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
        {formatEuro(raised)} / {formatEuro(goal)}
      </p>
      <div className="mt-3">
        <CampaignProgress raised={raised} goal={goal} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1">
        <DonateNowButton />
        <ShareButton
          url={shareUrl}
          title={shareTitle}
          text={shareText}
          ariaLabel={`Condividi ${shareTitle}`}
          className={crowdShareQuietClass}
        />
      </div>

      {first ? (
        <div className="mt-10">
          <DonorBlockLeader donor={first} />
        </div>
      ) : null}

      {podium.length > 0 ? (
        <ol className="mt-10 space-y-6">
          {podium.map((donor) => (
            <li key={donor.id}>
              <DonorBlockRow donor={donor} />
            </li>
          ))}
        </ol>
      ) : null}

      {tail.length > 0 ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {tail.map((donor) => (
            <li key={donor.id}>
              <DonorBlockCard donor={donor} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
