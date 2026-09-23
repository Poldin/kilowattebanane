"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FasciaPlanIcon } from "@/components/offerte/FasciaPlanIcon";
import { CanoneIcon, PrezzoIcon } from "@/components/offerte/OfferteTraitIcons";
import type { OfferteCompareProfile } from "@/lib/offerte/compare-profile";
import { romeToday } from "@/lib/offerte/dates";
import type { OfferteFasciaPlan } from "@/lib/offerte/metrics";
import type { OfferteHitDettaglio, OfferteSuggestItem } from "@/lib/offerte/public-types";

export type OwnOfferDraft = {
  variabile: boolean;
  plan: OfferteFasciaPlan;
  durataMesi: 12 | 24 | 36;
  quotaFissaEurAnno: number;
  energyEurKwh: number;
};

export function isCustomOfferId(id: string) {
  return id.startsWith("custom:");
}

export function OwnOfferDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: OwnOfferDraft) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [variabile, setVariabile] = useState(true);
  const [plan, setPlan] = useState<OfferteFasciaPlan>("monoraria");
  const [durataMesi, setDurataMesi] = useState<12 | 24 | 36>(12);
  const [quotaFissa, setQuotaFissa] = useState("");
  const [energia, setEnergia] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setVariabile(true);
      setPlan("monoraria");
      setDurataMesi(12);
      setQuotaFissa("");
      setEnergia("");
      setError(null);
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  function requestClose() {
    dialogRef.current?.close();
  }

  function submit() {
    const quota = parseItNumber(quotaFissa);
    const energy = parseItNumber(energia);
    if (quota == null || quota < 0) {
      setError("Inserisci la quota fissa in €/anno dalla scheda.");
      return;
    }
    if (energy == null || energy < 0) {
      setError(
        variabile
          ? "Inserisci lo spread sull'energia in €/kWh dalla scheda."
          : "Inserisci la quota energia in €/kWh dalla scheda.",
      );
      return;
    }
    setError(null);
    onSubmit({
      variabile,
      plan: !variabile && plan === "dinamica" ? "monoraria" : plan,
      durataMesi,
      quotaFissaEurAnno: quota,
      energyEurKwh: energy,
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="own-offer-dialog"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <form
        className="flex h-full min-h-0 w-full flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="relative shrink-0 px-5 pt-14 sm:px-8 sm:pt-10">
          <button
            type="button"
            onClick={requestClose}
            className="absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-foreground sm:right-4 sm:top-4 sm:h-10 sm:w-10 dark:hover:bg-neutral-900"
            aria-label="Chiudi"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
          <h2 id={titleId} className="pr-12 text-2xl font-semibold tracking-tight sm:text-3xl">
            inserisci i dati dell&apos;offerta
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            guarda la <strong className="font-medium text-foreground">Scheda Sintetica</strong>{" "}
            (è obbligatoria!) e inserisci i dati qui sotto. Puoi aggiungere quante offerte vuoi.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <div className="grid gap-6">
            <Fieldset legend="Tipologia di prezzo" icon={<PrezzoIcon kind={variabile ? "prezzo variabile" : "prezzo fisso"} />}>
              <ChoiceChip
                active={!variabile}
                icon={<PrezzoIcon kind="prezzo fisso" />}
                onClick={() => {
                  setVariabile(false);
                  if (plan === "dinamica") setPlan("monoraria");
                }}
              >
                Fisso
              </ChoiceChip>
              <ChoiceChip
                active={variabile}
                icon={<PrezzoIcon kind="prezzo variabile" />}
                onClick={() => setVariabile(true)}
              >
                Variabile
              </ChoiceChip>
            </Fieldset>

            <Fieldset legend="Profilo orario" icon={<FasciaPlanIcon plan={plan === "dinamica" && !variabile ? "monoraria" : plan} />}>
              <ChoiceChip
                active={plan === "monoraria"}
                icon={<FasciaPlanIcon plan="monoraria" />}
                onClick={() => setPlan("monoraria")}
              >
                Monoraria
              </ChoiceChip>
              <ChoiceChip
                active={plan === "bioraria"}
                icon={<FasciaPlanIcon plan="bioraria" />}
                onClick={() => setPlan("bioraria")}
              >
                Bioraria
              </ChoiceChip>
              <ChoiceChip
                active={plan === "fasce"}
                icon={<FasciaPlanIcon plan="fasce" />}
                onClick={() => setPlan("fasce")}
              >
                Trioraria
              </ChoiceChip>
              {variabile ? (
                <ChoiceChip
                  active={plan === "dinamica"}
                  icon={<FasciaPlanIcon plan="dinamica" />}
                  onClick={() => setPlan("dinamica")}
                >
                  Dinamica
                </ChoiceChip>
              ) : null}
            </Fieldset>

            <Fieldset legend="Durata condizioni" icon={<CanoneIcon />}>
              {([12, 24, 36] as const).map((months) => (
                <ChoiceChip
                  key={months}
                  active={durataMesi === months}
                  icon={<CanoneIcon />}
                  onClick={() => setDurataMesi(months)}
                >
                  {months} mesi
                </ChoiceChip>
              ))}
            </Fieldset>

            <NumberField
              label="Quota fissa"
              unit="€/anno"
              icon={<CanoneIcon />}
              value={quotaFissa}
              onChange={setQuotaFissa}
              placeholder="120"
            />
            <NumberField
              label={variabile ? "Spread sull'energia" : "Quota energia"}
              unit="€/kWh"
              icon={<PrezzoIcon kind={variabile ? "prezzo variabile" : "prezzo fisso"} />}
              value={energia}
              onChange={setEnergia}
              placeholder={variabile ? "0,015" : "0,148"}
            />
          </div>
          {error ? <p className="mt-5 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </div>

        <div className="mt-auto shrink-0 border-t border-neutral-200 px-5 py-4 sm:flex sm:justify-end sm:px-8 sm:py-5 dark:border-neutral-800">
          <button
            type="submit"
            className="h-11 w-full rounded-md bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:w-fit"
          >
            Aggiungi al confronto
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Fieldset({
  legend,
  icon,
  children,
}: {
  legend: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        {icon}
        {legend}
      </legend>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function ChoiceChip({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon?: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
          : "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-transparent px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
      }
    >
      {icon}
      {children}
    </button>
  );
}

function NumberField({
  label,
  unit,
  icon,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  unit: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        {icon}
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-md border border-neutral-200 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
        />
        <span className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">{unit}</span>
      </div>
    </div>
  );
}

function parseItNumber(raw: string) {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function emptyDettaglio(): OfferteHitDettaglio {
  return {
    descrizione: null,
    garanzie: null,
    telefono: null,
    attivazione: [],
    pagamento: [],
    tipologiaContratto: [],
    residente: null,
    offertaSingola: null,
    onnicomprensiva: null,
    consumoMin: null,
    consumoMax: null,
    potenzaMin: null,
    potenzaMax: null,
    indicePrezzo: null,
    coefficiente: null,
    coverage: null,
    sconti: [],
    onereRecesso: null,
  };
}

export function buildCustomCompareOffer(
  nome: string,
  draft: OwnOfferDraft,
): { item: OfferteSuggestItem; profile: OfferteCompareProfile } {
  const id = `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const label = nome.trim() || "La tua offerta";
  const tipoOfferta = draft.variabile ? "prezzo variabile" : "prezzo fisso";
  const today = romeToday();
  const monthlyEur = draft.quotaFissaEurAnno / 12;
  const descrizione = "Offerta inserita da te.";

  return {
    item: {
      id,
      category: "nome",
      label,
      detail: "Inserita da te",
      codOfferta: null,
      venditoreKey: null,
      venditore: null,
      source: null,
      tipoCliente: "domestico",
      tipoOfferta,
      plan: draft.plan,
    },
    profile: {
      source: "ml",
      codOfferta: id,
      nome: label,
      venditore: "Inserita da te",
      tipoOfferta,
      tipoCliente: "domestico",
      plan: draft.plan,
      monthlyEur,
      spreadEurKwh: draft.energyEurKwh,
      spreadMinEurKwh: draft.energyEurKwh,
      spreadMaxEurKwh: draft.energyEurKwh,
      validFrom: today,
      validTo: today,
      durataMesi: draft.durataMesi,
      urlOfferta: null,
      dettaglio: {
        ...emptyDettaglio(),
        descrizione,
        indicePrezzo: draft.variabile ? "PUN" : null,
        coefficiente: draft.variabile ? 1 : null,
      },
      scheda: {
        descrizione,
        variabile: draft.variabile,
        indice: draft.variabile ? "PUN" : null,
        coefficiente: draft.variabile ? 1 : null,
        quotaFissaEurAnno: draft.quotaFissaEurAnno,
        quotaPotenzaEurKw: null,
        unaTantumEur: null,
        energia: [{ label: null, eurKwh: draft.energyEurKwh }],
        verde: null,
        dispacciamento: "Non indicato",
        sconti: [],
        cliente: "domestico",
        residente: null,
        consumo: null,
        potenza: null,
        copertura: "Inserita da te",
        soloAbbinamento: false,
        onnicomprensiva: null,
        pluriennale: null,
        onereRecesso: null,
        garanzie: null,
      },
    },
  };
}
