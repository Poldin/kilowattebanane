import { DonorHearts } from "@/components/crowd/DonorHearts";
import { DonorPortrait } from "@/components/crowd/DonorPortrait";
import { formatEuro } from "@/lib/crowd/format";
import type { RankedDonor } from "@/lib/crowd/types";

function DonorAmountHeart({
  donor,
  amountClass,
  heartSize,
  className = "",
}: {
  donor: RankedDonor;
  amountClass: string;
  heartSize: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={`flex w-fit items-center gap-1.5${className ? ` ${className}` : ""}`}
    >
      <DonorHearts donorName={donor.name} size={heartSize} className="-m-0.5 shrink-0 p-0.5" />
      <p className={amountClass}>{formatEuro(donor.amountEuro)}</p>
    </div>
  );
}

export function DonorBlockLeader({ donor }: { donor: RankedDonor }) {
  const highlight = donor.preview ? " text-[#165B44]" : "";

  return (
    <article className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
      <DonorPortrait donorId={donor.id} size="hero" />
      <div className="min-w-0 flex-1">
        <p
          className={`text-4xl font-semibold leading-[0.95] tracking-tight text-balance sm:text-6xl${highlight}`}
        >
          {donor.name}
        </p>
        <p className="mt-3 text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
          {donor.subtitle}
        </p>
        <DonorAmountHeart
          donor={donor}
          amountClass="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl"
          heartSize="lg"
          className="mt-4"
        />
      </div>
    </article>
  );
}

export function DonorBlockRow({ donor }: { donor: RankedDonor }) {
  const nameSize =
    donor.rank === 2 ? "text-xl font-semibold" : "text-lg font-medium";
  const nameColor = donor.preview ? "text-[#165B44]" : "";

  return (
    <article className="flex w-full items-center gap-4">
      <DonorPortrait donorId={donor.id} size="md" />
      <div className="min-w-0 flex-1">
        <p className={`text-balance ${nameSize} ${nameColor}`}>{donor.name}</p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {donor.subtitle}
        </p>
        <DonorAmountHeart
          donor={donor}
          amountClass="text-base font-medium tabular-nums"
          heartSize="md"
          className="mt-1"
        />
      </div>
    </article>
  );
}

export function DonorBlockCard({ donor }: { donor: RankedDonor }) {
  return (
    <article className="w-fit max-w-[11rem] rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <DonorPortrait donorId={donor.id} size="sm" />
      <p className="mt-2 text-sm font-medium leading-snug text-balance">{donor.name}</p>
      <p className="mt-1 text-xs leading-snug text-neutral-500 dark:text-neutral-400">
        {donor.subtitle}
      </p>
      <DonorAmountHeart
        donor={donor}
        amountClass="text-sm tabular-nums text-neutral-600 dark:text-neutral-300"
        heartSize="sm"
        className="mt-2"
      />
    </article>
  );
}

export function DonorBlockCompact({ donor }: { donor: RankedDonor }) {
  return (
    <div className="mt-8 flex items-center gap-4">
      <DonorPortrait donorId={donor.id} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {donor.name}
        </p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {donor.subtitle}
        </p>
        <DonorAmountHeart
          donor={donor}
          amountClass="text-xl tabular-nums text-neutral-600 dark:text-neutral-300"
          heartSize="md"
          className="mt-2"
        />
      </div>
    </div>
  );
}
