"use client";

export const crowdDonateClass =
  "inline-flex h-9 w-fit items-center justify-center rounded-md bg-[#165B44] px-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90";

export const crowdShareQuietClass =
  "h-9 border-transparent bg-transparent px-3 py-0 text-sm font-medium text-neutral-500 shadow-none hover:bg-transparent hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-transparent dark:hover:text-neutral-300";

export function DonateNowButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={`${crowdDonateClass}${className ? ` ${className}` : ""}`}
    >
      dona adesso!
    </button>
  );
}
