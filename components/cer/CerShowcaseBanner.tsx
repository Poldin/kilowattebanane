function formatItInt(value: number) {
  return String(Math.trunc(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function CerShowcaseBanner({ count }: { count: number }) {
  return (
    <section className="mt-10 w-full overflow-hidden rounded-lg bg-[#111111] p-5 text-[#f5f5f5] sm:mt-12 sm:p-6">
      <p className="text-lg font-medium leading-tight text-emerald-100 sm:text-xl">
        in Italia sono attive
      </p>
      <p className="mt-1 text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
        {formatItInt(count)}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
        comunità energetiche
      </p>
    </section>
  );
}
