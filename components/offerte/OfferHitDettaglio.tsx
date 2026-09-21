"use client";

import { formatPotenzaKw } from "@/lib/offerte/potenza";
import { romeToday } from "@/lib/offerte/dates";
import {
  PORTALE_OFFERTE_CERCA,
  type OfferteHitDettaglio,
} from "@/lib/offerte/public-types";

export type OfferCodeFields = {
  codOfferta: string;
  urlOfferta: string | null;
};

export type OfferPeriodFields = {
  validFrom: string | null;
  validTo: string | null;
  durataMesi: number | null;
};

export function OfferDettaglio({ dettaglio }: { dettaglio: OfferteHitDettaglio }) {
  const rows = dettaglioRows(dettaglio);
  const hasBody =
    dettaglio.descrizione ||
    dettaglio.garanzie ||
    dettaglio.onereRecesso ||
    rows.length > 0 ||
    dettaglio.sconti.length > 0;

  return (
    <div className="pb-1 pt-3">
      {hasBody ? (
        <div className="flex flex-col gap-3 text-sm">
          {dettaglio.descrizione ? (
            <p className="whitespace-pre-wrap">{dettaglio.descrizione}</p>
          ) : null}
          {dettaglio.garanzie ? (
            <div>
              <p className="offerte-hit-muted text-xs text-neutral-500 dark:text-neutral-400">
                Garanzie
              </p>
              <p className="mt-0.5">{dettaglio.garanzie}</p>
            </div>
          ) : null}
          {dettaglio.onereRecesso ? (
            <div>
              <p className="offerte-hit-muted text-xs text-neutral-500 dark:text-neutral-400">
                Onere di recesso
              </p>
              <p className="mt-0.5">{dettaglio.onereRecesso}</p>
            </div>
          ) : null}
          {rows.length > 0 ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt className="offerte-hit-muted text-xs text-neutral-500 dark:text-neutral-400">
                    {row.label}
                  </dt>
                  <dd className="mt-0.5">
                    {row.href ? (
                      <a href={row.href} className="offerte-hit-link underline underline-offset-2">
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {dettaglio.sconti.length > 0 ? (
            <div>
              <p className="offerte-hit-muted text-xs text-neutral-500 dark:text-neutral-400">
                Sconti
              </p>
              <ul className="mt-1 flex flex-col gap-2">
                {dettaglio.sconti.map((sconto, index) => (
                  <li key={`${sconto.nome}-${index}`}>
                    <p className="font-medium">
                      {sconto.nome}
                      {sconto.valore ? (
                        <span className="offerte-hit-muted font-normal text-neutral-500 dark:text-neutral-400">
                          {" · "}
                          {sconto.valore}
                        </span>
                      ) : null}
                    </p>
                    {sconto.descrizione ? (
                      <p className="offerte-hit-muted mt-0.5 text-neutral-600 dark:text-neutral-400">
                        {sconto.descrizione}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="offerte-hit-muted text-sm text-neutral-500 dark:text-neutral-400">
          Nessun dettaglio aggiuntivo per questa offerta.
        </p>
      )}
    </div>
  );
}

export function OfferCodeLink({ hit }: { hit: OfferCodeFields }) {
  const vendorHref = absoluteHttpUrl(hit.urlOfferta);
  const href = vendorHref ?? PORTALE_OFFERTE_CERCA;
  const title = vendorHref
    ? `Apri la scheda offerta sul sito del venditore (${hit.codOfferta})`
    : `Apri Portale Offerte e incolla il codice ${hit.codOfferta}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      onClick={(event) => event.stopPropagation()}
      className="offerte-hit-link inline-flex max-w-full items-center gap-1 font-mono text-xs tracking-normal text-neutral-600 underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-foreground dark:text-neutral-400 dark:decoration-neutral-600"
    >
      <span className="truncate">{hit.codOfferta}</span>
      <NewTabIcon />
      <span className="sr-only"> (si apre in una nuova scheda)</span>
    </a>
  );
}

export function formatOfferPeriod(hit: OfferPeriodFields) {
  const parts: string[] = [];
  const today = romeToday();
  const from = hit.validFrom ? formatItDate(hit.validFrom) : null;
  const to = hit.validTo ? formatItDate(hit.validTo) : null;
  const started = Boolean(hit.validFrom && hit.validFrom <= today);

  if (from && to) {
    parts.push(started ? `acquistabile (${from} – ${to})` : `${from} – ${to}`);
  } else if (from) {
    parts.push(started ? `acquistabile (dal ${from})` : `dal ${from}`);
  } else if (to) {
    parts.push(started ? `acquistabile (fino al ${to})` : `fino al ${to}`);
  }

  if (hit.durataMesi != null && hit.durataMesi > 0) {
    parts.push(`${formatIt(hit.durataMesi)} mesi di contratto`);
  }
  return parts.join(" · ");
}

export function NewTabIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 3.5H3.75A1.25 1.25 0 0 0 2.5 4.75v7.5A1.25 1.25 0 0 0 3.75 13.5h7.5A1.25 1.25 0 0 0 12.5 12.25V9.5M9 3.5h3.5V7M13.5 3.5 8 9"
      />
    </svg>
  );
}

export function absoluteHttpUrl(raw: string | null) {
  if (!raw) return null;
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

function dettaglioRows(d: OfferteHitDettaglio) {
  const rows: { label: string; value: string; href?: string }[] = [];
  if (d.telefono) {
    rows.push({
      label: "Telefono",
      value: d.telefono,
      href: `tel:${d.telefono.replace(/[^\d+]/g, "")}`,
    });
  }
  if (d.attivazione.length) {
    rows.push({ label: "Attivazione", value: d.attivazione.join(", ") });
  }
  if (d.pagamento.length) {
    rows.push({ label: "Pagamento", value: d.pagamento.join(", ") });
  }
  if (d.tipologiaContratto.length) {
    rows.push({ label: "Quando si attiva", value: d.tipologiaContratto.join(", ") });
  }
  if (d.residente) {
    rows.push({ label: "Residenza", value: d.residente });
  }
  if (d.offertaSingola === false) {
    rows.push({ label: "Sottoscrizione", value: "Solo in abbinamento con un’altra commodity" });
  }
  if (d.onnicomprensiva) {
    rows.push({ label: "Struttura", value: d.onnicomprensiva });
  }
  const consumo = formatBound(d.consumoMin, d.consumoMax, "kWh/anno");
  if (consumo) rows.push({ label: "Consumo ammesso", value: consumo });
  const potenza = formatBound(d.potenzaMin, d.potenzaMax, "kW", (value) => formatPotenzaKw(value));
  if (potenza) rows.push({ label: "Potenza ammessa", value: potenza });
  if (d.indicePrezzo) {
    const coeff =
      d.coefficiente != null
        ? ` · coefficiente ${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(d.coefficiente)}`
        : "";
    rows.push({ label: "Indice energia", value: `${d.indicePrezzo}${coeff}` });
  }
  if (d.coverage) {
    rows.push({ label: "Copertura", value: d.coverage });
  }
  return rows;
}

function formatBound(
  min: number | null,
  max: number | null,
  unit: string,
  format: (value: number) => string = (value) => formatIt(value),
) {
  if (min != null && min > 0 && max != null && max > 0) {
    return `${format(min)}–${format(max)} ${unit}`;
  }
  if (min != null && min > 0) return `da ${format(min)} ${unit}`;
  if (max != null && max > 0) return `fino a ${format(max)} ${unit}`;
  return null;
}

function formatIt(value: number) {
  return new Intl.NumberFormat("it-IT").format(value);
}

function formatItDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (value >= "2099-01-01") return null;
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
