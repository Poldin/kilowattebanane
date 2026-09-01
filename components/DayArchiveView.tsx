import Link from "next/link";
import { ShareButton } from "@/components/ShareButton";
import { SignupSlot } from "@/components/SignupForm";
import {
  archiveDayUrl,
  type ArchiveDay,
  type ArchiveZone,
} from "@/lib/day-archive";
import { formatEurocent } from "@/lib/insights";
import { archiveDayJsonPath, archiveDayPath } from "@/lib/market-zones";

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function whenBadge(day: ArchiveDay) {
  if (day.isToday) return "oggi";
  if (day.isTomorrow) return "domani";
  return null;
}

function Stat({
  label,
  value,
  hint,
  mark,
}: {
  label: string;
  value: string;
  hint?: string;
  mark?: "banana" | "monkey";
}) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
        {mark === "banana" ? (
          <span className="mr-0.5 text-lg sm:mr-1 sm:text-3xl" aria-hidden>
            🍌
          </span>
        ) : null}
        {mark === "monkey" ? (
          <span className="mr-0.5 text-lg sm:mr-1 sm:text-3xl" aria-hidden>
            🐵
          </span>
        ) : null}
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-snug text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ZoneCard({ zone }: { zone: ArchiveZone }) {
  return (
    <article className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium tracking-tight text-foreground">
          {zone.zoneName}
        </h3>
        <span className="inline-flex items-center rounded-full bg-[#F5D547] px-2 py-0.5 text-[11px] font-medium text-[#111111]">
          {zone.regions.length === 1 ? zone.regions[0] : `${zone.regions.length} regioni`}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {zone.regions.join(", ")}
      </p>
      {zone.cheapHours ? (
        <p className="mt-3 text-sm font-medium text-foreground">
          🍌 Top risparmio {zone.cheapHours}
        </p>
      ) : null}
      {zone.peakHours ? (
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          🐵 Evita consumi {zone.peakHours}
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "min", value: formatEurocent(zone.min) },
          { label: "medio", value: formatEurocent(zone.avg) },
          { label: "max", value: formatEurocent(zone.max) },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
              {stat.label}
            </p>
            <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
        c€/kWh all&apos;ingrosso
      </p>
    </article>
  );
}

function HourlyTable({ day }: { day: ArchiveDay }) {
  const hours = Math.max(...day.zones.map((zone) => zone.hourlyCent.length), 0);
  if (hours === 0) return null;

  return (
    <section className="mt-12" aria-labelledby="hourly-heading">
      <h2
        id="hourly-heading"
        className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
      >
        Prezzi ora per ora
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Medie orarie in c€/kWh, tutte le zone. La cella più bassa di ogni riga è
        evidenziata.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-160 w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
              <th
                scope="col"
                className="sticky left-0 bg-neutral-50 px-2 py-2 text-left font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400"
              >
                Ora
              </th>
              {day.zones.map((zone) => (
                <th
                  key={zone.zone}
                  scope="col"
                  className="px-2 py-2 text-right font-medium text-neutral-500 dark:text-neutral-400"
                >
                  {zone.zoneName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: hours }, (_, hour) => {
              const values = day.zones.map((zone) => zone.hourlyCent[hour] ?? 0);
              const rowMin = Math.min(...values);
              return (
                <tr
                  key={hour}
                  className="border-b border-neutral-100 last:border-0 odd:bg-neutral-50/80 dark:border-neutral-900 dark:odd:bg-neutral-950"
                >
                  <th
                    scope="row"
                    className="sticky left-0 bg-inherit px-2 py-1.5 text-left font-normal tabular-nums text-neutral-600 dark:text-neutral-400"
                  >
                    {hourLabel(hour)}
                  </th>
                  {day.zones.map((zone) => {
                    const value = zone.hourlyCent[hour];
                    const cheapest = value === rowMin;
                    return (
                      <td
                        key={zone.zone}
                        className={`px-2 py-1.5 text-right tabular-nums ${
                          cheapest
                            ? "bg-[#F5D547]/20 font-medium text-foreground dark:bg-[#F5D547]/15"
                            : "text-foreground"
                        }`}
                      >
                        {value == null ? "—" : formatEurocent(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DayArchiveView({ day }: { day: ArchiveDay }) {
  const badge = whenBadge(day);
  const jsonHref = archiveDayJsonPath(day.date);
  const shareUrl = archiveDayUrl(day.date);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-14">
      <nav
        aria-label="Percorso"
        className="text-xs text-neutral-500 dark:text-neutral-400"
      >
        <Link href="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <span aria-hidden className="mx-1.5">
          /
        </span>
        <Link href="/prezzi" className="transition-colors hover:text-foreground">
          Prezzi
        </Link>
        <span aria-hidden className="mx-1.5">
          /
        </span>
        <span className="text-foreground">{day.dateTitle}</span>
      </nav>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Quando conviene consumare il {day.dateLabel}
        </h1>
        <ShareButton
          url={shareUrl}
          title={`kilowatt e banane🍌🍌🍌 — ${day.dateTitle}`}
          text={day.briefing}
          ariaLabel={`Condividi i prezzi del ${day.dateLabel}`}
        />
      </div>

      {badge ? (
        <p className="mt-3">
          <span className="inline-flex items-center rounded-full bg-[#F5D547] px-2.5 py-0.5 text-xs font-medium text-[#111111]">
            {badge}
          </span>
        </p>
      ) : null}

      <section
        className="mt-8"
        aria-label="Minimo, medio e massimo in Italia"
      >
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Stat
            label="minimo Italia"
            value={formatEurocent(day.italy.min)}
            hint={`${day.italy.cheapestZoneName}${day.italy.cheapestHours ? ` · ${day.italy.cheapestHours}` : ""}`}
            mark="banana"
          />
          <Stat
            label="medio"
            value={formatEurocent(day.italy.avg)}
            hint="media delle 7 zone"
          />
          <Stat
            label="picco Italia"
            value={formatEurocent(day.italy.max)}
            hint={`${day.italy.priciestZoneName}${day.italy.priciestHours ? ` · ${day.italy.priciestHours}` : ""}`}
            mark="monkey"
          />
        </div>
        <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
          c€/kWh all&apos;ingrosso · fuso Europe/Rome · fonte ENTSO-E
        </p>
      </section>

      <div className="mt-8 rounded-lg border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
        <p className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
          In sintesi
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground sm:text-base">
          {day.briefing}
        </p>
      </div>

      <section className="mt-12" aria-labelledby="zones-heading">
        <h2
          id="zones-heading"
          className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
        >
          Le 7 zone
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Stesso giorno, prezzi diversi. Scegli la zona della tua regione.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {day.zones.map((zone) => (
            <ZoneCard key={zone.zone} zone={zone} />
          ))}
        </div>
      </section>

      <HourlyTable day={day} />

      <section
        id="faq"
        aria-labelledby="day-faq-heading"
        className="mt-12 border-t border-neutral-200 pt-12 dark:border-neutral-800"
      >
        <h2
          id="day-faq-heading"
          className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
        >
          FAQ
        </h2>
        <dl className="mt-6 space-y-6">
          {day.faqs.map((faq) => (
            <div key={faq.question}>
              <dt className="text-sm font-medium text-foreground">
                {faq.question}
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <nav
        aria-label="Altri giorni"
        className="mt-12 flex flex-wrap items-center justify-between gap-3"
      >
        {day.prevDate ? (
          <Link
            href={archiveDayPath(day.prevDate)}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            ‹ Giorno prima
          </Link>
        ) : (
          <span />
        )}
        <Link
          href="/prezzi"
          className="text-sm text-neutral-500 transition-colors hover:text-foreground dark:text-neutral-400"
        >
          Archivio
        </Link>
        {day.nextDate ? (
          <Link
            href={archiveDayPath(day.nextDate)}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Giorno dopo ›
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">
        Grafico interattivo e tabella ogni quarto d&apos;ora:{" "}
        <Link
          href={`/?giorno=${day.date}#prezzi`}
          className="text-foreground underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
        >
          apri la home su questo giorno
        </Link>
        . Dati macchina:{" "}
        <Link
          href={jsonHref}
          className="text-foreground underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
        >
          JSON
        </Link>
        .
      </p>

      <SignupSlot />
    </main>
  );
}
