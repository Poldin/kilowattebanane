import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-16 text-center font-sans text-foreground">
      <p className="text-6xl font-semibold tracking-tight tabular-nums">404</p>
      <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
        Pagina non trovata
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-neutral-900 px-5 text-sm font-medium text-yellow-50 transition-opacity hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900"
      >
        Torna a kilowatt e banane💡🍌🍌🍌
      </Link>
    </div>
  );
}
