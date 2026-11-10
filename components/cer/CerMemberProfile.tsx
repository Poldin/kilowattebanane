"use client";

import { ArrowUpRight, Check, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  CER_FEE_TIERS,
  CER_PROFILE_MOCK,
  CER_PROFILE_MOCK_NOTE,
  CER_SHARE_OPTIONS,
  MEMBERSHIP_STATUS_LABEL,
  beneficiaryById,
  cerById,
  compatibleCers,
  foldSearch,
  formatActivityWhen,
  formatEuroCents,
  formatInt,
  formatLongDate,
  incompatibleCerCount,
  mandateDraftText,
  maskPod,
  splitIncentive,
  supplyAddress,
  utenzeLabel,
  type CerSharePercent,
  type IncentiveSplit,
  type MockActivity,
  type MockBeneficiary,
  type MockCer,
} from "@/lib/cer/profile-mock";

const SECTIONS = [
  { id: "utenza", label: "Utenza" },
  { id: "cer", label: "CER" },
  { id: "beneficiario", label: "Beneficiario" },
  { id: "impatto", label: "Impatto" },
  { id: "mandato", label: "Mandato" },
  { id: "storico", label: "Storico" },
] as const;

type DialogModel =
  | { kind: "closed" }
  | { kind: "cer"; step: "pick" | "confirm"; pickedId: string }
  | { kind: "leave"; step: "ask" | "noted" }
  | { kind: "beneficiary"; step: "pick" | "confirm"; query: string; pickedId: string }
  | { kind: "revoke"; step: "ask" | "noted" }
  | { kind: "erase"; step: "ask" | "noted" }
  | { kind: "privacy" };

const CLOSED: DialogModel = { kind: "closed" };

const primaryBtn =
  "inline-flex h-11 items-center justify-center rounded-md bg-[#165B44] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165B44] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const secondaryBtn =
  "inline-flex h-11 items-center justify-center rounded-md border border-neutral-200 bg-transparent px-4 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900";

const dangerBtn =
  "inline-flex h-11 items-center justify-center rounded-md border border-red-200 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-red-900/80 dark:text-red-300 dark:hover:bg-red-950/40";

const linkClass =
  "font-medium text-foreground underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400";

export function CerMemberProfile() {
  const titleId = useId();
  const mock = CER_PROFILE_MOCK;
  const [cerId, setCerId] = useState(mock.currentCerId);
  const [beneficiaryId, setBeneficiaryId] = useState(mock.currentBeneficiaryId);
  const [share, setShare] = useState<CerSharePercent>(mock.sharePercent);
  const [activity, setActivity] = useState<MockActivity[]>(() =>
    [...mock.activity].sort((a, b) => b.at.localeCompare(a.at)),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogModel>(CLOSED);

  const cer = cerById(cerId);
  const beneficiary = beneficiaryById(beneficiaryId);
  const split = splitIncentive(share);
  const address = supplyAddress(mock.supply);
  const maskedPod = maskPod(mock.supply.pod);
  const cerChanged = cerId !== mock.currentCerId;
  const beneficiaryChanged = beneficiaryId !== mock.currentBeneficiaryId;

  function closeDialog() {
    setDialog((current) => (current.kind === "closed" ? current : CLOSED));
  }

  function pushPreview(title: string, detail: string) {
    setActivity((current) => [
      {
        id: `preview-${current.length}-${title}`,
        at: new Date().toISOString(),
        title,
        detail,
        preview: true,
      },
      ...current,
    ]);
  }

  function confirmCer(pickedId: string) {
    const next = cerById(pickedId);
    const previous = cerById(cerId);
    setCerId(pickedId);
    pushPreview(
      "Cambio CER in anteprima",
      `Da ${previous.name} a ${next.name}. Nessuna richiesta inviata.`,
    );
    setNotice(`In questa anteprima risulti in ${next.name}. Non è partita nessuna richiesta.`);
    closeDialog();
  }

  function confirmBeneficiary(pickedId: string) {
    const next = beneficiaryById(pickedId);
    setBeneficiaryId(pickedId);
    pushPreview(
      "Cambio beneficiario in anteprima",
      `${next.name}, ${share}% della quota. Nessuna richiesta inviata.`,
    );
    setNotice(
      `In questa anteprima il beneficiario è ${next.name}. Non è partita nessuna richiesta.`,
    );
    closeDialog();
  }

  function downloadMandate() {
    const text = mandateDraftText({
      memberName: mock.member.fullName,
      email: mock.member.email,
      podMasked: maskedPod,
      address,
      cabina: mock.supply.cabinaCodice,
      gestore: mock.supply.cabinaGestore,
      cerName: cer.name,
      beneficiaryName: beneficiary.name,
      sharePercent: share,
      grantedOnLabel: formatLongDate(mock.mandate.grantedOn),
    });
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mandato-cer-anteprima.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice("Bozza scaricata sul dispositivo. Non è il mandato firmato e non è stata inviata.");
  }

  return (
    <>
      <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
        Area riservata
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{mock.member.fullName}</h1>
        <StatusBadge status={mock.member.status} />
      </div>
      <p className="mt-2 text-sm text-neutral-600 sm:text-base dark:text-neutral-400">
        {mock.member.email}
      </p>
      <p className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm leading-relaxed text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
        {CER_PROFILE_MOCK_NOTE}
      </p>
      {notice ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-[#165B44]/30 bg-[#165B44]/8 px-3 py-2.5 text-sm leading-relaxed text-neutral-800 dark:border-[#F5D547]/40 dark:bg-[#F5D547]/10 dark:text-neutral-100"
        >
          {notice}
        </p>
      ) : null}

      <nav aria-label="Sezioni del profilo" className="profile-month-scroll mt-6 flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:focus-visible:ring-neutral-500"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <section id="utenza" className="mt-10 scroll-mt-24 border-t border-neutral-200 pt-8 dark:border-neutral-800" aria-labelledby="utenza-heading">
        <h2 id="utenza-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          La mia utenza
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Il punto di prelievo con cui sei nella comunità. Il POD è mascherato: le cifre centrali non si vedono.
        </p>
        <dl className="mt-4 divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          <Fact label="POD" value={maskedPod} mono hint="mascherato" />
          <Fact label="Indirizzo" value={address} />
          <Fact
            label="Cabina primaria"
            value={mock.supply.cabinaCodice}
            mono
            hint={mock.supply.cabinaGestore}
          />
        </dl>
      </section>

      <section id="cer" className="mt-12 scroll-mt-24 border-t border-neutral-200 pt-8 dark:border-neutral-800" aria-labelledby="cer-heading">
        <h2 id="cer-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          La mia CER
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Sei in una sola comunità. Per cambiarla il POD resta sulla stessa cabina primaria, e il fornitore non cambia.
        </p>
        <article className="mt-4 rounded-xl border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            Comunità attuale
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{cer.name}</h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {cer.town} · {utenzeLabel(cer.members)}
          </p>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {cer.summary}
          </p>
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            {cerChanged
              ? "Cambio solo in questa pagina: non c’è una data di adesione reale."
              : `Dentro dal ${formatLongDate(mock.joinedOn)}.`}
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            <a
              href={cer.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 ${linkClass}`}
            >
              Sito della comunità
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            </a>
            <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
              Collegamento di esempio: {cer.siteName}
            </span>
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={`${primaryBtn} w-full sm:w-auto`}
              onClick={() => setDialog({ kind: "cer", step: "pick", pickedId: cerId })}
            >
              Cambia CER
            </button>
            <button
              type="button"
              className={`${secondaryBtn} w-full sm:w-auto`}
              onClick={() => setDialog({ kind: "leave", step: "ask" })}
            >
              Esci dalla CER
            </button>
          </div>
        </article>
      </section>

      <section
        id="beneficiario"
        className="mt-12 scroll-mt-24 border-t border-neutral-200 pt-8 dark:border-neutral-800"
        aria-labelledby="beneficiario-heading"
      >
        <h2 id="beneficiario-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Il mio beneficiario
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          La percentuale che scegli della tua quota incentivo va a questo soggetto. Sulla parte che tieni per te non c’è commissione.
        </p>
        <BeneficiaryCard
          beneficiary={beneficiary}
          since={
            beneficiaryChanged
              ? "Scelto solo in questa anteprima."
              : `Destinatario dal ${formatLongDate(mock.joinedOn)}.`
          }
        />
        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-foreground">
            Quota della tua incentivazione destinata al beneficiario
          </legend>
          <div
            role="radiogroup"
            aria-label="Percentuale destinata al beneficiario"
            className="mt-3 grid grid-cols-3 gap-2"
          >
            {CER_SHARE_OPTIONS.map((option) => {
              const selected = share === option.percent;
              return (
                <button
                  key={option.percent}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setShare(option.percent)}
                  className={`rounded-lg border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165B44] dark:focus-visible:ring-[#F5D547] ${
                    selected
                      ? "border-[#165B44] bg-[#165B44]/8 dark:border-[#F5D547] dark:bg-[#F5D547]/10"
                      : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  }`}
                >
                  <span className="block text-lg font-semibold tabular-nums tracking-tight">
                    {option.percent}%
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            In anteprima la percentuale si aggiorna solo su questa pagina
            {share === mock.sharePercent ? "." : `, ed è diversa dal ${mock.sharePercent}% di esempio.`}
          </p>
        </fieldset>
        <button
          type="button"
          className={`${secondaryBtn} mt-4 w-full sm:w-auto`}
          onClick={() =>
            setDialog({
              kind: "beneficiary",
              step: "pick",
              query: "",
              pickedId: beneficiaryId,
            })
          }
        >
          Cambia beneficiario
        </button>
      </section>

      <section
        id="impatto"
        className="mt-12 scroll-mt-24 border-t border-neutral-200 pt-8 dark:border-neutral-800"
        aria-labelledby="impatto-heading"
      >
        <h2 id="impatto-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Il mio impatto
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Stime indicative sul {mock.impact.year}, non un accredito e non un conteggio del GSE.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stat
            label="kWh condivisi stimati"
            value={formatInt(mock.impact.sharedKwh)}
            unit="kWh"
            hint={`nel ${mock.impact.year}`}
          />
          <Stat
            label="Al beneficiario, al netto"
            value={formatEuroCents(split.beneficiaryNetCents)}
            hint="dopo la commissione, stima"
          />
        </div>
        <h3 className="mt-6 text-base font-semibold tracking-tight">Come si divide l’incentivo</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {formatInt(mock.impact.sharedKwh)} kWh × {formatEuroCents(mock.impact.centPerSharedKwh)} per
          kWh condiviso = {formatEuroCents(split.grossCents)} di incentivo stimato sulla tua quota.
        </p>
        <dl className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          <MoneyRow label="Incentivo stimato della tua quota" cents={split.grossCents} />
          <MoneyRow
            label={`Resta a te (${100 - share}%), senza commissione`}
            cents={split.keptCents}
          />
          <MoneyRow
            label={`Destinato a ${beneficiary.name} (${share}%)`}
            cents={split.beneficiaryGrossCents}
          />
          <MoneyRow
            label={`Commissione kilowatt e banane (${split.tier.label})`}
            cents={split.feeCents}
            negative
          />
          <MoneyRow label="Al beneficiario, al netto" cents={split.beneficiaryNetCents} strong />
        </dl>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          La commissione si calcola solo sull’importo destinato al beneficiario. Sulla parte che resta a te non tratteniamo nulla.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Scaglioni della commissione">
          {CER_FEE_TIERS.map((tier) => {
            const active = tier.id === split.tier.id;
            return (
              <li
                key={tier.id}
                className={`rounded-lg border px-3 py-3 ${
                  active
                    ? "border-[#165B44] bg-[#165B44]/8 dark:border-[#F5D547] dark:bg-[#F5D547]/10"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <p className="text-lg font-semibold tabular-nums tracking-tight">{tier.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {tier.band}
                </p>
                {active ? (
                  <p className="mt-2 text-xs font-medium text-[#165B44] dark:text-[#F5D547]">
                    Scaglione di questa stima
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Stime indicative. Gli scaglioni 8% / 5% / 3% sono la regola di questa anteprima, da collegare alla tariffa reale.
        </p>
      </section>

      <section
        id="mandato"
        className="mt-12 scroll-mt-24 border-t border-neutral-200 pt-8 dark:border-neutral-800"
        aria-labelledby="mandato-heading"
      >
        <h2 id="mandato-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Mandato e privacy
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Mandato di esempio del {formatLongDate(mock.mandate.grantedOn)}. È quello che la piattaforma può fare al posto tuo, e quello che non può fare.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <MandateList title="Può" items={mock.mandate.can} tone="can" />
          <MandateList title="Non può" items={mock.mandate.cannot} tone="cannot" />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          <a
            href="#informativa-privacy"
            className={linkClass}
            onClick={(event) => {
              event.preventDefault();
              setDialog({ kind: "privacy" });
            }}
          >
            Informativa privacy
          </a>
          <span aria-hidden className="px-2 text-neutral-300 dark:text-neutral-600">
            ·
          </span>
          <a href="/termini" target="_blank" rel="noopener noreferrer" className={linkClass}>
            Termini e condizioni
          </a>
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" className={`${primaryBtn} w-full sm:w-auto`} onClick={downloadMandate}>
            Scarica bozza del mandato
          </button>
          <button
            type="button"
            className={`${secondaryBtn} w-full sm:w-auto`}
            onClick={() => setDialog({ kind: "revoke", step: "ask" })}
          >
            Revoca il mandato
          </button>
          <button
            type="button"
            className={`${dangerBtn} w-full sm:w-auto`}
            onClick={() => setDialog({ kind: "erase", step: "ask" })}
          >
            Richiedi cancellazione dati
          </button>
        </div>
      </section>

      <section
        id="storico"
        className="mt-12 scroll-mt-24 border-t border-neutral-200 pt-8 dark:border-neutral-800"
        aria-labelledby="storico-heading"
      >
        <h2 id="storico-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Storico
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          I passaggi dell’adesione, dal più recente. Le righe segnate «solo anteprima» esistono solo in questa pagina.
        </p>
        <ol className="mt-4">
          {activity.map((event) => (
            <li
              key={event.id}
              className="relative border-l border-neutral-200 py-3 pl-5 dark:border-neutral-800"
            >
              <span
                aria-hidden
                className={`absolute top-5 -left-[5px] h-2.5 w-2.5 rounded-full ${
                  event.preview ? "bg-[#165B44] dark:bg-[#F5D547]" : "bg-neutral-300 dark:bg-neutral-600"
                }`}
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {formatActivityWhen(event.at)}
                {event.preview ? (
                  <span className="ml-2 inline-flex rounded-full bg-[#165B44]/10 px-2 py-0.5 font-medium text-[#165B44] dark:bg-[#F5D547]/15 dark:text-[#F5D547]">
                    solo anteprima
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-sm font-medium">{event.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {event.detail}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <ProfileDialog open={dialog.kind !== "closed"} titleId={titleId} onClose={closeDialog}>
        <DialogBody
          titleId={titleId}
          dialog={dialog}
          cer={cer}
          beneficiary={beneficiary}
          share={share}
          split={split}
          onDialog={setDialog}
          onClose={closeDialog}
          onConfirmCer={confirmCer}
          onConfirmBeneficiary={confirmBeneficiary}
          onAcknowledge={setNotice}
        />
      </ProfileDialog>
    </>
  );
}

function StatusBadge({ status }: { status: keyof typeof MEMBERSHIP_STATUS_LABEL }) {
  const waiting = status === "in_attesa";
  return (
    <p
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        waiting
          ? "bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
          : "bg-[#165B44]/10 text-[#165B44] dark:bg-[#F5D547]/15 dark:text-[#F5D547]"
      }`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {MEMBERSHIP_STATUS_LABEL[status]}
    </p>
  );
}

function Fact({
  label,
  value,
  hint,
  mono = false,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
        {label}
      </dt>
      <dd className={`text-sm text-foreground sm:text-right ${mono ? "font-mono" : ""}`}>
        {value}
        {hint ? (
          <span className="mt-0.5 block text-xs font-sans text-neutral-500 sm:text-right dark:text-neutral-400">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function BeneficiaryCard({
  beneficiary,
  since,
}: {
  beneficiary: MockBeneficiary;
  since: string;
}) {
  return (
    <article className="mt-4 rounded-xl border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        <BeneficiaryMark beneficiary={beneficiary} />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">{beneficiary.name}</h3>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{beneficiary.town}</p>
        </div>
      </div>
      <p className="mt-3 text-pretty text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {beneficiary.description}
      </p>
      <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{since}</p>
      {beneficiary.siteUrl ? (
        <p className="mt-3 text-sm">
          <a
            href={beneficiary.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 ${linkClass}`}
          >
            Sito del beneficiario
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
        </p>
      ) : null}
    </article>
  );
}

function BeneficiaryMark({ beneficiary }: { beneficiary: MockBeneficiary }) {
  if (beneficiary.logoSrc) {
    return (
      <span className="flex h-14 w-[7.5rem] shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white px-2">
        {/* Same treatment as the partner mark in the header: a fixed box, not next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beneficiary.logoSrc}
          alt=""
          width={1300}
          height={209}
          className="max-h-8 w-full object-contain object-left"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#165B44]/10 text-sm font-semibold tracking-tight text-[#165B44] dark:bg-[#F5D547]/15 dark:text-[#F5D547]"
    >
      {beneficiary.initials}
    </span>
  );
}

function Stat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 px-4 py-4 dark:border-neutral-800">
      <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
        {value}
        {unit ? <span className="ml-1 text-base font-medium text-neutral-500">{unit}</span> : null}
      </p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
    </div>
  );
}

function MoneyRow({
  label,
  cents,
  negative = false,
  strong = false,
}: {
  label: string;
  cents: number;
  negative?: boolean;
  strong?: boolean;
}) {
  const shown = formatEuroCents(Math.abs(cents));
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className={`text-sm ${strong ? "font-medium text-foreground" : "text-neutral-600 dark:text-neutral-400"}`}>
        {label}
      </dt>
      <dd
        className={`shrink-0 text-sm tabular-nums ${
          strong ? "font-semibold text-[#165B44] dark:text-[#F5D547]" : "text-foreground"
        }`}
      >
        {negative && cents !== 0 ? `−${shown}` : shown}
      </dd>
    </div>
  );
}

function MandateList({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly string[];
  tone: "can" | "cannot";
}) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <span
              aria-hidden
              className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                tone === "can"
                  ? "bg-[#165B44]/10 text-[#165B44] dark:bg-[#F5D547]/15 dark:text-[#F5D547]"
                  : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              }`}
            >
              {tone === "can" ? "✓" : "–"}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfileDialog({
  open,
  titleId,
  onClose,
  children,
}: {
  open: boolean;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="cer-profile-dialog"
      aria-labelledby={open ? titleId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function DialogBody({
  titleId,
  dialog,
  cer,
  beneficiary,
  share,
  split,
  onDialog,
  onClose,
  onConfirmCer,
  onConfirmBeneficiary,
  onAcknowledge,
}: {
  titleId: string;
  dialog: DialogModel;
  cer: MockCer;
  beneficiary: MockBeneficiary;
  share: CerSharePercent;
  split: IncentiveSplit;
  onDialog: (next: DialogModel) => void;
  onClose: () => void;
  onConfirmCer: (id: string) => void;
  onConfirmBeneficiary: (id: string) => void;
  onAcknowledge: (message: string) => void;
}) {
  if (dialog.kind === "closed") return null;

  if (dialog.kind === "cer") {
    const options = compatibleCers(CER_PROFILE_MOCK.supply.cabinaCodice);
    const hidden = incompatibleCerCount(CER_PROFILE_MOCK.supply.cabinaCodice);
    const picked = cerById(dialog.pickedId);
    const same = dialog.pickedId === cer.id;
    return (
      <Shell
        titleId={titleId}
        kicker={dialog.step === "pick" ? "Passo 1 di 2" : "Passo 2 di 2"}
        title="Cambia CER"
        onClose={onClose}
        footer={
          dialog.step === "pick" ? (
            <DialogActions
              secondary="Annulla"
              onSecondary={onClose}
              primary="Continua"
              primaryDisabled={same}
              onPrimary={() => onDialog({ ...dialog, step: "confirm" })}
            />
          ) : (
            <DialogActions
              secondary="Indietro"
              onSecondary={() => onDialog({ ...dialog, step: "pick" })}
              primary="Conferma cambio"
              onPrimary={() => onConfirmCer(dialog.pickedId)}
            />
          )
        }
      >
        {dialog.step === "pick" ? (
          <>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Comunità di esempio sulla cabina {CER_PROFILE_MOCK.supply.cabinaCodice}, la stessa della tua utenza.
              Un POD non sta in due CER.
            </p>
            <div role="radiogroup" aria-label="Comunità compatibili" className="mt-4 flex flex-col gap-2">
              {options.map((option) => (
                <Choice
                  key={option.id}
                  selected={dialog.pickedId === option.id}
                  title={option.name}
                  meta={`${option.town} · ${utenzeLabel(option.members)}${option.id === cer.id ? " · attuale" : ""}`}
                  body={option.summary}
                  onClick={() => onDialog({ ...dialog, pickedId: option.id })}
                />
              ))}
            </div>
            {same ? (
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                Sei già in questa comunità. Scegline un’altra per continuare.
              </p>
            ) : null}
            {hidden > 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {hidden === 1
                  ? "1 comunità di esempio è su un’altra cabina e non compare: il POD non può seguirla."
                  : `${hidden} comunità di esempio sono su un’altra cabina e non compaiono: il POD non può seguirle.`}
              </p>
            ) : null}
          </>
        ) : (
          <div className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <p>
              Passi da <strong className="font-medium text-foreground">{cer.name}</strong> a{" "}
              <strong className="font-medium text-foreground">{picked.name}</strong>. Il POD e la cabina{" "}
              {CER_PROFILE_MOCK.supply.cabinaCodice} restano gli stessi. Il fornitore non cambia.
            </p>
            <p className="mt-3">
              Il beneficiario resta {beneficiary.name}, con il {share}% della quota, finché non lo cambi.
            </p>
            <p className="mt-3">
              In questa anteprima il cambio non viene inviato. Aggiorniamo solo quello che vedi.
            </p>
          </div>
        )}
      </Shell>
    );
  }

  if (dialog.kind === "leave") {
    return (
      <Shell
        titleId={titleId}
        kicker="Recesso"
        title="Esci dalla CER"
        onClose={onClose}
        footer={
          dialog.step === "ask" ? (
            <DialogActions
              secondary="Annulla"
              onSecondary={onClose}
              primary="Conferma recesso"
              primaryTone="danger"
              onPrimary={() => {
                onAcknowledge(
                  "Recesso non inviato. L’iscrizione resta attiva in questa anteprima.",
                );
                onDialog({ kind: "leave", step: "noted" });
              }}
            />
          ) : (
            <DialogActions secondary="Chiudi" onSecondary={onClose} />
          )
        }
      >
        {dialog.step === "ask" ? (
          <div className="space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <p>
              Il recesso è previsto e si può revocare. Esci da {cer.name} senza cambiare fornitore e senza costi:
              la bolletta resta quella di sempre.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>La richiesta parte verso la comunità, quando l’area sarà collegata al tuo account.</li>
              <li>Puoi annullarla finché la CER non la prende in carico.</li>
              <li>L’incentivo sulla tua quota si ferma dal periodo successivo. Quello già maturato non si perde.</li>
              <li>Il POD può rientrare dopo in una CER della stessa cabina. Non può stare in due comunità insieme.</li>
            </ul>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            In questa anteprima il recesso non viene inviato. L’iscrizione resta attiva e {cer.name} resta la tua comunità.
          </p>
        )}
      </Shell>
    );
  }

  if (dialog.kind === "beneficiary") {
    const query = dialog.query.trim();
    const filtered = CER_PROFILE_MOCK.beneficiaries.filter((item) => {
      if (!query) return true;
      const hay = foldSearch(`${item.name} ${item.town} ${item.description}`);
      return hay.includes(foldSearch(query));
    });
    const picked = beneficiaryById(dialog.pickedId);
    const same = dialog.pickedId === beneficiary.id;
    return (
      <Shell
        titleId={titleId}
        kicker={dialog.step === "pick" ? "Passo 1 di 2" : "Passo 2 di 2"}
        title="Cambia beneficiario"
        onClose={onClose}
        footer={
          dialog.step === "pick" ? (
            <DialogActions
              secondary="Annulla"
              onSecondary={onClose}
              primary="Continua"
              primaryDisabled={same}
              onPrimary={() => onDialog({ ...dialog, step: "confirm" })}
            />
          ) : (
            <DialogActions
              secondary="Indietro"
              onSecondary={() => onDialog({ ...dialog, step: "pick" })}
              primary="Conferma beneficiario"
              onPrimary={() => onConfirmBeneficiary(dialog.pickedId)}
            />
          )
        }
      >
        {dialog.step === "pick" ? (
          <>
            <form
              onSubmit={(event) => event.preventDefault()}
              role="search"
            >
              <label className="block">
                <span className="sr-only">Cerca beneficiario per nome o comune</span>
                <span className="relative block">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
                    strokeWidth={1.75}
                  />
                  <input
                    type="search"
                    value={dialog.query}
                    autoFocus
                    placeholder="Cerca per nome o comune"
                    onChange={(event) => onDialog({ ...dialog, query: event.target.value })}
                    className="h-12 w-full rounded-md border border-neutral-200 bg-transparent pr-3 pl-10 text-base text-foreground outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
                  />
                </span>
              </label>
            </form>
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
              {filtered.length === 0
                ? "Nessun risultato"
                : filtered.length === 1
                  ? "1 beneficiario di esempio"
                  : `${filtered.length} beneficiari di esempio`}
            </p>
            <div role="radiogroup" aria-label="Beneficiari" className="mt-2 flex flex-col gap-2">
              {filtered.map((option) => (
                <Choice
                  key={option.id}
                  selected={dialog.pickedId === option.id}
                  title={option.name}
                  meta={`${option.town}${option.id === beneficiary.id ? " · attuale" : ""}`}
                  body={option.description}
                  mark={<BeneficiaryMark beneficiary={option} />}
                  onClick={() => onDialog({ ...dialog, pickedId: option.id })}
                />
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                Nessun beneficiario con questo nome. Prova con il comune, per esempio Vigonovo.
              </p>
            ) : null}
            {same && filtered.length > 0 ? (
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                È già il tuo beneficiario. Scegline un altro per continuare.
              </p>
            ) : null}
          </>
        ) : (
          <div className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <p>
              Il beneficiario diventa <strong className="font-medium text-foreground">{picked.name}</strong>,{" "}
              {picked.town}. Gli va il {share}% della tua quota: {formatEuroCents(split.beneficiaryGrossCents)} lordi
              stimati, {formatEuroCents(split.beneficiaryNetCents)} al netto della commissione {split.tier.label}.
            </p>
            <p className="mt-3">Numeri indicativi. In questa anteprima la scelta non viene inviata.</p>
          </div>
        )}
      </Shell>
    );
  }

  if (dialog.kind === "revoke") {
    return (
      <Shell
        titleId={titleId}
        kicker="Mandato"
        title="Revoca il mandato"
        onClose={onClose}
        footer={
          dialog.step === "ask" ? (
            <DialogActions
              secondary="Annulla"
              onSecondary={onClose}
              primary="Conferma revoca"
              primaryTone="danger"
              onPrimary={() => {
                onAcknowledge(
                  "Revoca non inviata. In questa anteprima il mandato di esempio resta com’è.",
                );
                onDialog({ kind: "revoke", step: "noted" });
              }}
            />
          ) : (
            <DialogActions secondary="Chiudi" onSecondary={onClose} />
          )
        }
      >
        {dialog.step === "ask" ? (
          <div className="space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <p>
              Revocare il mandato toglie a kilowatt e banane la possibilità di aggiornare l’adesione e il beneficiario per tuo conto.
            </p>
            <p>
              Non ti fa uscire da sola dalla CER e non cancella i dati. Quando l’area sarà collegata, la revoca si potrà annullare finché non la lavoriamo.
            </p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            In questa anteprima la revoca non viene inviata. Il mandato di esempio resta com’è.
          </p>
        )}
      </Shell>
    );
  }

  if (dialog.kind === "erase") {
    return (
      <Shell
        titleId={titleId}
        kicker="Privacy"
        title="Richiedi cancellazione dati"
        onClose={onClose}
        footer={
          dialog.step === "ask" ? (
            <DialogActions
              secondary="Annulla"
              onSecondary={onClose}
              primary="Conferma richiesta"
              primaryTone="danger"
              onPrimary={() => {
                onAcknowledge(
                  "Richiesta di cancellazione non inviata. I dati di esempio restano solo in questa pagina.",
                );
                onDialog({ kind: "erase", step: "noted" });
              }}
            />
          ) : (
            <DialogActions secondary="Chiudi" onSecondary={onClose} />
          )
        }
      >
        {dialog.step === "ask" ? (
          <div className="space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <p>
              La richiesta riguarda i dati dell’account e dell’utenza che conserviamo per l’adesione: nome, email, POD, scelta della CER e del beneficiario.
            </p>
            <p>
              Non cancella ciò che la CER o il GSE già detengono in base alle loro regole. Si può ritirare finché non la lavoriamo.
            </p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            In questa anteprima la richiesta non parte. I dati di esempio restano solo in questa pagina.
          </p>
        )}
      </Shell>
    );
  }

  return (
    <Shell
      titleId={titleId}
      kicker="Segnaposto"
      title="Informativa privacy"
      onClose={onClose}
      footer={<DialogActions secondary="Chiudi" onSecondary={onClose} />}
    >
      <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        L’informativa privacy di questa area non è ancora pubblicata. Il collegamento è un segnaposto e non apre un documento.
      </p>
    </Shell>
  );
}

function Shell({
  titleId,
  kicker,
  title,
  onClose,
  footer,
  children,
}: {
  titleId: string;
  kicker: string;
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full max-h-full min-h-0 w-full flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
              {kicker}
            </p>
            <h2 id={titleId} className="mt-1 text-2xl font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:hover:bg-neutral-900"
            aria-label="Chiudi"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="mt-4 pb-5">{children}</div>
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-neutral-200 bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-neutral-800 sm:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function DialogActions({
  secondary,
  onSecondary,
  primary,
  onPrimary,
  primaryDisabled = false,
  primaryTone = "brand",
}: {
  secondary: string;
  onSecondary: () => void;
  primary?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryTone?: "brand" | "danger";
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" className={`${secondaryBtn} w-full sm:w-auto`} onClick={onSecondary}>
        {secondary}
      </button>
      {primary && onPrimary ? (
        <button
          type="button"
          className={`${primaryTone === "danger" ? dangerBtn : primaryBtn} w-full sm:w-auto`}
          disabled={primaryDisabled}
          onClick={onPrimary}
        >
          {primary}
        </button>
      ) : null}
    </div>
  );
}

function Choice({
  selected,
  title,
  meta,
  body,
  mark,
  onClick,
}: {
  selected: boolean;
  title: string;
  meta: string;
  body: string;
  mark?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165B44] dark:focus-visible:ring-[#F5D547] ${
        selected
          ? "border-[#165B44] bg-[#165B44]/8 dark:border-[#F5D547] dark:bg-[#F5D547]/10"
          : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
      }`}
    >
      {mark ? <span className="mt-0.5 shrink-0">{mark}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{title}</span>
          {selected ? (
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#165B44] dark:text-[#F5D547]" strokeWidth={1.75} />
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">{meta}</span>
        <span className="mt-1 block text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{body}</span>
      </span>
    </button>
  );
}
