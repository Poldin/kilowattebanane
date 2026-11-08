import Link from "next/link";

export const exploreClass =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-neutral-300 bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900";

export function ExploreLink({ href }: { href: string }) {
  return (
    <Link href={href} className={exploreClass}>
      esplora progetto
    </Link>
  );
}
