"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CER_WAITLIST_ID,
  type CerSignupAnswers,
  type CerSignupChoice,
  type CerSignupImpianto,
  type CerSignupRole,
} from "@/lib/cer/signup";
import { POD_HELP_HREF } from "@/lib/cer/help";
import { lookupPodOnGse } from "@/lib/cer/pod-gse";
import { normalizePodInput, parsePod, type PodCerHit } from "@/lib/cer/pod-parse";

type CerSignupDialogProps = {
  open: boolean;
  onClose: () => void;
  cabinaCodice?: string | null;
  cabinaGestore?: string | null;
  initialPod?: string | null;
  cers?: PodCerHit[];
};

type CabinaPreview = {
  codice: string;
  gestore: string | null;
};

type CabinaStatus = "idle" | "loading" | "ready" | "miss" | "error";

type DraftChoice = Omit<CerSignupChoice, "rank"> & {
  potenzaKw: number | null;
  nUtenze: number | null;
  inVetrina: boolean;
};
type StepId = "role" | "impianto" | "potenza" | "prosumer" | "pod" | "email" | "cers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: {
  id: CerSignupRole;
  title: string;
  body: string;
}[] = [
  {
    id: "consumatore",
    title: "Consumatore",
    body: "Preleva energia dalla rete. In una CER riceve una quota dell’energia condivisa e l’incentivo, senza dover installare pannelli o cambiare fornitore.",
  },
  {
    id: "produttore",
    title: "Produttore",
    body: "Ha un impianto rinnovabile e immette energia in rete, nella stessa cabina primaria degli altri membri. Riceve inncentivi se l'energia che immette viene consumata dalla CER.",
  },
];

const IMPIANTO_OPTIONS: {
  id: CerSignupImpianto;
  title: string;
  body: string;
}[] = [
  {
    id: "attivo",
    title: "Già attivo",
    body: "L’impianto produce e immette già energia in rete.",
  },
  {
    id: "progetto",
    title: "In progetto",
    body: "Lo sto realizzando, oppure sto valutando di farlo.",
  },
];

const PROSUMER_OPTIONS: {
  id: "yes" | "no";
  title: string;
  body: string;
}[] = [
  {
    id: "yes",
    title: "Produco e consumo",
    body: "Uso prima l’energia dei miei pannelli e condivido il surplus con la comunità.",
  },
  {
    id: "no",
    title: "Solo produco",
    body: "Immetto in rete e condivido con i consumatori collegati alla stessa cabina.",
  },
];

function stepsFor(role: CerSignupRole | null): StepId[] {
  if (role === "produttore") {
    return ["role", "impianto", "potenza", "prosumer", "pod", "email", "cers"];
  }
  return ["role", "pod", "email", "cers"];
}

function buildInitialChoices(cers: PodCerHit[]): DraftChoice[] {
  return cers.map((cer, index) => ({
    id: `cer-${index}`,
    kind: "cer" as const,
    label: cer.denominazione ?? "CER",
    enabled: true,
    potenzaKw: cer.potenzaKw,
    nUtenze: cer.nUtenze,
    inVetrina: cer.inVetrina,
  }));
}

function waitlistChoice(rank: number): CerSignupChoice {
  return {
    id: CER_WAITLIST_ID,
    kind: "waitlist",
    label: "Lista d'attesa kilowatt e banane",
    enabled: true,
    rank,
  };
}

function withRanks(choices: DraftChoice[]): CerSignupChoice[] {
  return choices.map((choice, rank) => ({
    id: choice.id,
    kind: choice.kind,
    label: choice.label,
    enabled: choice.enabled,
    rank,
  }));
}

function enrollmentChoices(choices: DraftChoice[]): CerSignupChoice[] {
  const ranked = withRanks(choices).filter((choice) => choice.enabled);
  if (choices.length >= 2) return ranked;
  return [...ranked, waitlistChoice(ranked.length)];
}

async function loadCers(codice: string): Promise<PodCerHit[]> {
  try {
    const response = await fetch("/api/cer/pod", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codice }),
    });
    const payload = (await response.json()) as { cer?: PodCerHit[] };
    return Array.isArray(payload.cer) ? payload.cer : [];
  } catch {
    return [];
  }
}

function parsePotenzaInput(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const normalized = trimmed.replace(/\s/g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 50_000) return { ok: false };
  return { ok: true, value: Math.round(value * 10) / 10 };
}

export function CerSignupDialog({
  open,
  onClose,
  cabinaCodice = null,
  cabinaGestore = null,
  initialPod = null,
  cers = [],
}: CerSignupDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [stepIndex, setStepIndex] = useState(0);
  const [role, setRole] = useState<CerSignupRole | null>(null);
  const [impianto, setImpianto] = useState<CerSignupImpianto | null>(null);
  const [potenza, setPotenza] = useState("");
  const [prosumer, setProsumer] = useState<boolean | null>(null);
  const [pod, setPod] = useState("");
  const [podCabina, setPodCabina] = useState<CabinaPreview | null>(null);
  const [podCabinaStatus, setPodCabinaStatus] = useState<CabinaStatus>("idle");
  const [email, setEmail] = useState("");
  const [choices, setChoices] = useState<DraftChoice[]>(() => buildInitialChoices(cers));
  const [cersReady, setCersReady] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const steps = useMemo(() => {
    const base = stepsFor(role);
    return cersReady && choices.length < 2 ? base.filter((id) => id !== "cers") : base;
  }, [role, choices.length, cersReady]);
  const step = confirmed ? null : (steps[Math.min(stepIndex, steps.length - 1)] ?? "role");
  const isLastStep = step != null && step === steps[steps.length - 1];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setStepIndex(0);
      setRole(null);
      setImpianto(null);
      setPotenza("");
      setProsumer(null);
      setPod(initialPod ?? "");
      setPodCabina(null);
      setPodCabinaStatus("idle");
      setEmail("");
      setChoices(buildInitialChoices(cers));
      setCersReady(true);
      setPending(false);
      setError(null);
      setConfirmed(false);
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open, initialPod, cers]);

  useEffect(() => {
    if (!open) return;
    const parsed = parsePod(pod);
    if (!pod.trim() || !parsed.ok) {
      setPodCabina(null);
      setPodCabinaStatus("idle");
      return;
    }

    if (initialPod && cabinaCodice && parsed.pod === initialPod) {
      setPodCabina({ codice: cabinaCodice, gestore: cabinaGestore });
      setPodCabinaStatus("ready");
      return;
    }

    let cancelled = false;
    setPodCabina(null);
    setPodCabinaStatus("loading");
    const timer = window.setTimeout(() => {
      void lookupPodOnGse(parsed.pod)
        .then((gse) => {
          if (cancelled) return;
          if (!gse.found) {
            setPodCabina(null);
            setPodCabinaStatus("miss");
            return;
          }
          setPodCabina({ codice: gse.codice, gestore: gse.gestore });
          setPodCabinaStatus("ready");
        })
        .catch(() => {
          if (cancelled) return;
          setPodCabina(null);
          setPodCabinaStatus("error");
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, pod, initialPod, cabinaCodice, cabinaGestore]);

  useEffect(() => {
    if (!open) return;
    if (podCabinaStatus !== "ready" || !podCabina) {
      setChoices(buildInitialChoices(cers));
      setCersReady(true);
      return;
    }
    if (cabinaCodice && podCabina.codice === cabinaCodice) {
      setChoices(buildInitialChoices(cers));
      setCersReady(true);
      return;
    }
    let cancelled = false;
    setCersReady(false);
    void loadCers(podCabina.codice).then((hits) => {
      if (cancelled) return;
      setChoices(buildInitialChoices(hits));
      setCersReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, podCabina, podCabinaStatus, cabinaCodice, cers]);

  function requestClose() {
    dialogRef.current?.close();
  }

  function toggleAllChoices() {
    setChoices((prev) => {
      if (prev.length === 0) return prev;
      const enable = !prev.every((choice) => choice.enabled);
      return prev.map((choice) => ({ ...choice, enabled: enable }));
    });
  }

  function toggleChoice(id: string) {
    setChoices((prev) =>
      prev.map((choice) =>
        choice.id === id ? { ...choice, enabled: !choice.enabled } : choice,
      ),
    );
  }

  function moveChoice(id: string, delta: -1 | 1) {
    setChoices((prev) => {
      const index = prev.findIndex((choice) => choice.id === id);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[next]] = [copy[next]!, copy[index]!];
      return copy;
    });
  }

  function answersPayload(): CerSignupAnswers {
    if (role !== "produttore") return {};
    const parsed = parsePotenzaInput(potenza);
    return {
      impianto: impianto ?? undefined,
      potenzaKw: parsed.ok ? parsed.value : null,
      prosumer: prosumer ?? undefined,
    };
  }

  function validateStep(current: StepId): string | null {
    if (current === "role" && !role) return "Scegli se sei un consumatore o un produttore.";
    if (current === "impianto" && !impianto) return "Dimmi se l’impianto è già attivo o in progetto.";
    if (current === "potenza") {
      const parsed = parsePotenzaInput(potenza);
      if (!parsed.ok) return "Inserisci la potenza in kW, oppure lascia vuoto se non la sai.";
    }
    if (current === "prosumer" && prosumer == null) {
      return "Scegli se usi anche tu l’energia che produci.";
    }
    if (current === "pod") {
      if (!pod.trim()) {
        if (!cabinaCodice) return "Inserisci un POD valido per vedere la cabina primaria.";
      } else {
        const parsed = parsePod(pod);
        if (!parsed.ok) return parsed.error;
        if (podCabinaStatus === "loading") return "Un attimo, sto cercando la cabina primaria.";
        if (podCabinaStatus === "miss") return "Il GSE non ha questo POD.";
        if (podCabinaStatus === "error") return "Non riesco a interrogare il GSE. Riprova.";
        if (podCabinaStatus !== "ready" || !podCabina) {
          return "Inserisci un POD valido per vedere la cabina primaria.";
        }
        if (!cersReady) return "Un attimo, sto cercando le comunità energetiche.";
      }
    }
    if (current === "email") {
      const trimmed = email.trim().toLowerCase();
      if (!EMAIL_RE.test(trimmed) || trimmed.length > 254) return "Inserisci un’email valida.";
    }
    if (current === "cers" && !choices.some((choice) => choice.enabled)) {
      return "Attiva almeno una CER.";
    }
    return null;
  }

  function goBack() {
    setError(null);
    setStepIndex((index) => Math.max(0, index - 1));
  }

  async function goNext() {
    if (!step) return;
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    if (!isLastStep) {
      setStepIndex((index) => Math.min(index + 1, steps.length - 1));
      return;
    }
    await submit();
  }

  async function submit() {
    if (!role) {
      setError("Scegli se sei un consumatore o un produttore.");
      return;
    }
    const resolvedCabina = podCabina?.codice ?? cabinaCodice;
    if (!resolvedCabina) {
      setError("Inserisci un POD valido per vedere la cabina primaria.");
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/cer/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          pod: pod.trim() || undefined,
          cabinaCodice: resolvedCabina,
          role,
          answers: answersPayload(),
          choices: enrollmentChoices(choices),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Non è stato possibile completare l'iscrizione. Riprova.");
        return;
      }
      setConfirmed(true);
    } catch {
      setError("Non è stato possibile completare l'iscrizione. Riprova.");
    } finally {
      setPending(false);
    }
  }

  const activeChoices = enrollmentChoices(choices);
  const progress = confirmed ? 1 : (stepIndex + 1) / steps.length;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="cer-signup-dialog"
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
          void goNext();
        }}
      >
        <div className="h-1 shrink-0 bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full bg-[#165B44] transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-10 sm:py-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col">
            <div className="-mr-2 mb-6 flex items-center justify-between gap-4 sm:-mr-3">
              <h2
                id={titleId}
                className="min-w-0 text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                {confirmed ? "Richiesta inviata" : "Iscriviti a una CER"}
              </h2>
              <button
                type="button"
                onClick={requestClose}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-foreground sm:h-10 sm:w-10 dark:hover:bg-neutral-900"
                aria-label="Chiudi"
              >
                <CloseIcon />
              </button>
            </div>

            {confirmed ? (
              <ConfirmedSummary
                role={role}
                impianto={impianto}
                potenza={potenza}
                prosumer={prosumer}
                email={email}
                cabinaCodice={podCabina?.codice ?? cabinaCodice ?? ""}
                pod={pod}
                choices={activeChoices}
              />
            ) : (
              <div key={step} className="learn-q-in">
                {step === "role" ? (
                  <ChoiceStep
                    question="Sei un consumatore o un produttore?"
                    hint="Scegli il ruolo con cui vuoi entrare in una comunità energetica."
                    value={role}
                    options={ROLE_OPTIONS}
                    onChange={(value) => {
                      setRole(value);
                      setError(null);
                      setStepIndex(1);
                    }}
                    large
                  />
                ) : null}
                {step === "impianto" ? (
                  <ChoiceStep
                    question="Il tuo impianto è già in funzione?"
                    value={impianto}
                    options={IMPIANTO_OPTIONS}
                    onChange={setImpianto}
                  />
                ) : null}
                {step === "potenza" ? (
                  <PotenzaStep value={potenza} onChange={setPotenza} />
                ) : null}
                {step === "prosumer" ? (
                  <ChoiceStep
                    question="Usi anche tu l’energia che produci?"
                    value={prosumer == null ? null : prosumer ? "yes" : "no"}
                    options={PROSUMER_OPTIONS}
                    onChange={(value) => setProsumer(value === "yes")}
                  />
                ) : null}
                {step === "pod" ? (
                  <PodStep
                    value={pod}
                    onChange={setPod}
                    cabina={podCabina}
                    cabinaStatus={podCabinaStatus}
                  />
                ) : null}
                {step === "email" ? (
                  <EmailStep value={email} onChange={setEmail} />
                ) : null}
                {step === "cers" ? (
                  <CersStep
                    choices={choices}
                    onToggle={toggleChoice}
                    onToggleAll={toggleAllChoices}
                    onMove={moveChoice}
                  />
                ) : null}
              </div>
            )}
            {error ? (
              <p className="mt-5 text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            {confirmed ? null : (
              <div className="mt-8 flex gap-3">
                {stepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="h-12 rounded-md border border-neutral-200 px-5 text-sm font-medium text-foreground transition-colors hover:bg-neutral-100 sm:min-w-28 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  >
                    Indietro
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={pending}
                  className="h-12 min-w-0 flex-1 rounded-md bg-[#165B44] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70 sm:flex-none sm:px-8"
                >
                  {pending ? "Invio…" : isLastStep ? "Invia richiesta" : "Avanti"}
                </button>
              </div>
            )}
          </div>
        </div>
      </form>
    </dialog>
  );
}

function ChoiceStep<T extends string>({
  question,
  hint,
  value,
  options,
  onChange,
  large = false,
}: {
  question: string;
  hint?: string;
  value: T | null;
  options: { id: T; title: string; body: string }[];
  onChange: (value: T) => void;
  large?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-3xl font-bold tracking-tight sm:text-4xl">{question}</legend>
      {hint ? (
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {hint}
        </p>
      ) : null}
      <div role="radiogroup" aria-label={question} className="mt-8 flex flex-col gap-3">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.id)}
              className={`flex w-full items-start gap-4 rounded-lg border px-4 py-4 text-left transition-colors sm:px-5 sm:py-5 ${
                selected
                  ? "border-[#165B44] bg-[#165B44]/8 dark:border-[#F5D547] dark:bg-[#F5D547]/10"
                  : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
              }`}
            >
              <Flag checked={selected} />
              <span className="min-w-0 flex-1">
                <span
                  className={
                    large
                      ? "block text-3xl font-bold tracking-tight sm:text-4xl"
                      : "block text-2xl font-bold tracking-tight sm:text-3xl"
                  }
                >
                  {option.title}
                </span>
                <span className="mt-1.5 block max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {option.body}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function PotenzaStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-3xl font-bold tracking-tight sm:text-4xl">
        Quanti kW hai, o avrai?
      </span>
      <span className="mt-2 block max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        La potenza nominale dell’impianto, come in bolletta o sul preventivo. Se non la sai,
        vai avanti comunque.
      </span>
      <span className="relative mt-8 block max-w-sm">
        <input
          inputMode="decimal"
          autoComplete="off"
          placeholder="6,0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-14 w-full rounded-md border border-neutral-200 bg-transparent px-4 pr-16 text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:font-normal placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-neutral-500">
          kW
        </span>
      </span>
    </label>
  );
}

function PodHelpLink() {
  return (
    <a
      href={POD_HELP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 px-3 text-sm font-medium text-foreground hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
    >
      cos’è il POD?
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path
          d="M4.5 11.5 11.5 4.5M6.5 4.5h5v5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

function PodStep({
  value,
  onChange,
  cabina,
  cabinaStatus,
}: {
  value: string;
  onChange: (value: string) => void;
  cabina: CabinaPreview | null;
  cabinaStatus: CabinaStatus;
}) {
  return (
    <div>
      <p className="text-3xl font-bold tracking-tight sm:text-4xl">A quale POD?</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          indica il POD da iscrivere alla CER
        </p>
        <PodHelpLink />
      </div>
      <input
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={18}
        placeholder="IT001E12345678"
        value={value}
        onChange={(event) => onChange(normalizePodInput(event.target.value))}
        className="mt-8 h-14 w-full max-w-sm rounded-md border border-neutral-200 bg-transparent px-4 text-lg tracking-[0.12em] text-foreground outline-none placeholder:tracking-normal placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
      />
      {cabinaStatus === "loading" ? (
        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          Cerco la cabina primaria…
        </p>
      ) : null}
      {cabinaStatus === "miss" ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">Il GSE non ha questo POD.</p>
      ) : null}
      {cabinaStatus === "error" ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Non riesco a interrogare il GSE. Riprova.
        </p>
      ) : null}
      {cabinaStatus === "ready" && cabina ? (
        <div className="mt-5">
          <p className="text-xs font-medium tracking-[0.16em] text-neutral-500 uppercase">
            Cabina primaria
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-[0.08em]">{cabina.codice}</p>
          {cabina.gestore ? (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{cabina.gestore}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmailStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-3xl font-bold tracking-tight sm:text-4xl">
        A quale email ti ricontattiamo?
      </span>
      <span className="mt-2 block max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Ti scriviamo per le adesioni attive e, se serve, per la lista d’attesa kilowatt e
        banane.
      </span>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="nome@esempio.it"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-8 h-14 w-full max-w-md rounded-md border border-neutral-200 bg-transparent px-4 text-lg text-foreground outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600"
      />
    </label>
  );
}

function formatKw(value: number) {
  if (value >= 1000) {
    const mw = value / 1000;
    const rounded = mw >= 10 ? Math.round(mw) : Math.round(mw * 10) / 10;
    const label = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
    return `${label} MW`;
  }
  const rounded = Math.round(value * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${label} kW`;
}

function formatItInt(value: number) {
  return String(Math.trunc(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function CersStep({
  choices,
  onToggle,
  onToggleAll,
  onMove,
}: {
  choices: DraftChoice[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onMove: (id: string, delta: -1 | 1) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const firstRects = useRef<Map<string, DOMRect> | null>(null);
  const allOn = choices.length > 0 && choices.every((choice) => choice.enabled);

  useLayoutEffect(() => {
    const first = firstRects.current;
    const list = listRef.current;
    if (!first || !list) return;
    firstRects.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const el of list.querySelectorAll<HTMLElement>("[data-choice-id]")) {
      const id = el.dataset.choiceId;
      if (!id) continue;
      const prev = first.get(id);
      if (!prev) continue;
      const last = el.getBoundingClientRect();
      const dy = prev.top - last.top;
      if (Math.abs(dy) < 1) continue;
      el.animate(
        [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
        { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
  }, [choices]);

  function move(id: string, delta: -1 | 1) {
    const list = listRef.current;
    if (list) {
      firstRects.current = new Map(
        [...list.querySelectorAll<HTMLElement>("[data-choice-id]")].flatMap((el) => {
          const choiceId = el.dataset.choiceId;
          return choiceId ? [[choiceId, el.getBoundingClientRect()] as const] : [];
        }),
      );
    }
    onMove(id, delta);
  }

  return (
    <fieldset>
      <legend className="text-3xl font-bold tracking-tight sm:text-4xl">
        Che CER preferisci?
      </legend>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        il POD che hai inserito può essere associato alle seguenti CER. Dicci se hai delle
        preferenze di iscrizione.
      </p>
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={allOn}
          aria-label={allOn ? "Spegni tutte" : "Attiva tutte"}
          onClick={onToggleAll}
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
            allOn ? "bg-[#165B44]" : "bg-neutral-300 dark:bg-neutral-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              allOn ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-sm font-medium text-foreground">
          {allOn ? "Spegni tutte" : "Attiva tutte"}
        </span>
      </div>
      <ol ref={listRef} className="mt-4 flex flex-col gap-2">
        {choices.map((choice, index) => (
          <li
            key={choice.id}
            data-choice-id={choice.id}
            className={`flex items-start gap-2 rounded-lg border px-3 py-3 ${
              choice.enabled
                ? "border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/50"
                : "border-neutral-200 bg-transparent opacity-60 dark:border-neutral-800"
            }`}
          >
            <button
              type="button"
              role="switch"
              aria-checked={choice.enabled}
              aria-label={
                choice.enabled ? `Disattiva ${choice.label}` : `Attiva ${choice.label}`
              }
              onClick={() => onToggle(choice.id)}
              className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${
                choice.enabled ? "bg-[#165B44]" : "bg-neutral-300 dark:bg-neutral-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  choice.enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className="min-w-0 flex-1 text-sm leading-snug text-foreground">
              <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <CerMark />
                  <span className="min-w-0">
                    {choice.label}
                    {choice.inVetrina ? " · in vetrina" : null}
                  </span>
                </span>
              </span>
              {choice.potenzaKw != null || choice.nUtenze != null ? (
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-500 dark:text-neutral-400">
                  {choice.potenzaKw != null ? (
                    <span title="potenza" className="inline-flex items-center gap-1">
                      <BoltMark />
                      {formatKw(choice.potenzaKw)}
                    </span>
                  ) : null}
                  {choice.nUtenze != null ? (
                    <span title="utenze" className="inline-flex items-center gap-1">
                      <UtenzeMark />
                      {formatItInt(choice.nUtenze)}
                      <span className="sr-only"> utenze</span>
                    </span>
                  ) : null}
                </span>
              ) : null}
            </span>
            <div className="flex shrink-0 flex-col gap-0.5">
              <IconButton
                label="Sposta su"
                disabled={index === 0}
                onClick={() => move(choice.id, -1)}
              >
                <ChevronUpIcon />
              </IconButton>
              <IconButton
                label="Sposta giù"
                disabled={index === choices.length - 1}
                onClick={() => move(choice.id, 1)}
              >
                <ChevronDownIcon />
              </IconButton>
            </div>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}

const CER_SHARE_TITLE = "Comunità energetiche rinnovabili (CER) · kilowatt e banane";
const CER_SHARE_TEXT =
  "Scopri la tua cabina primaria e a quali comunità energetiche puoi iscriverti. Gratis.";

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function ConfirmedSummary({
  role,
  impianto,
  potenza,
  prosumer,
  email,
  cabinaCodice,
  pod,
  choices,
}: {
  role: CerSignupRole | null;
  impianto: CerSignupImpianto | null;
  potenza: string;
  prosumer: boolean | null;
  email: string;
  cabinaCodice: string;
  pod: string;
  choices: CerSignupChoice[];
}) {
  const parsedPotenza = parsePotenzaInput(potenza);
  return (
    <div>
      <p className="text-3xl font-bold tracking-tight sm:text-4xl">✅Richiesta inviata</p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Abbiamo registrato la tua richiesta.
      </p>
      <dl className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        <SummaryRow
          label="Ruolo"
          value={role === "produttore" ? "Produttore" : "Consumatore"}
        />
        {role === "produttore" && impianto ? (
          <SummaryRow
            label="Impianto"
            value={impianto === "attivo" ? "Già attivo" : "In progetto"}
          />
        ) : null}
        {role === "produttore" && parsedPotenza.ok && parsedPotenza.value != null ? (
          <SummaryRow label="Potenza" value={`${String(parsedPotenza.value).replace(".", ",")} kW`} />
        ) : null}
        {role === "produttore" && prosumer != null ? (
          <SummaryRow
            label="Uso"
            value={prosumer ? "Produco e consumo" : "Solo produco"}
          />
        ) : null}
        <SummaryRow label="Email" value={email.trim()} />
        <SummaryRow label="Cabina primaria" value={cabinaCodice} mono />
        {pod.trim() ? <SummaryRow label="POD" value={pod.trim()} mono /> : null}
        {choices.length > 0 ? (
          <div className="px-4 py-3">
            <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
              Preferenze
            </dt>
            <dd className="mt-2 flex flex-col gap-1.5">
              {choices.map((choice) => (
                <span
                  key={choice.id}
                  className="inline-flex max-w-full items-center gap-1.5 text-sm text-foreground"
                >
                  {choice.kind === "waitlist" ? <WaitlistLabel /> : <CerMark />}
                  <span className="min-w-0">
                    {choice.kind === "waitlist"
                      ? "Lista d'attesa kilowatt e banane"
                      : choice.label}
                  </span>
                </span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-8 max-w-xl">
        <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          <span className="text-[#165B44] dark:text-[#F5D547]">il 68%</span>
          {" "}dei nuovi utenti CER arriva per passaparola
        </p>
        <p className="mt-2 text-base leading-relaxed text-foreground">
          a chi puoi condividerlo?
        </p>
        <div className="mt-5">
          <ShareCerPageButton />
        </div>
      </div>
    </div>
  );
}

function ShareCerPageButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL("/comunita-energetiche", window.location.origin).toString();
    const data = { title: CER_SHARE_TITLE, text: CER_SHARE_TEXT, url };

    if (typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (isAbortError(error)) return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; ignore so the button never throws.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#165B44] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
    >
      {copied ? "Link copiato" : "Condividi"}
      {copied ? null : (
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function Flag({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
        checked
          ? "border-[#165B44] bg-[#165B44] text-white dark:border-[#F5D547] dark:bg-[#F5D547] dark:text-[#111111]"
          : "border-neutral-300 bg-transparent dark:border-neutral-600"
      }`}
    >
      {checked ? <CheckIcon /> : null}
    </span>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">{label}</dt>
      <dd className={`text-sm break-all text-foreground ${mono ? "tracking-[0.08em]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function WaitlistLabel() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 text-base" aria-hidden>
      <span>💡</span>
      <span>🍌</span>
    </span>
  );
}

function BoltMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M8.8 1.75 3.75 9.1h4.1L7.2 14.25l5.05-7.35h-4.1Z" strokeLinejoin="round" />
    </svg>
  );
}

function UtenzeMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="5" r="2.1" />
      <path d="M3.5 13.25c.4-2.2 2-3.4 4.5-3.4s4.1 1.2 4.5 3.4" strokeLinecap="round" />
    </svg>
  );
}

function CerMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-[#165B44] dark:text-[#F5D547]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="3.9" r="1.55" />
      <path d="M5.6 12.6c.2-1.85 1.15-2.9 2.4-2.9s2.2 1.05 2.4 2.9" strokeLinecap="round" />
      <circle cx="3.6" cy="5.4" r="1.2" />
      <path d="M1.7 12.6c.15-1.4.9-2.15 1.9-2.15s1.75.75 1.9 2.15" strokeLinecap="round" />
      <circle cx="12.4" cy="5.4" r="1.2" />
      <path d="M10.5 12.6c.15-1.4.9-2.15 1.9-2.15s1.75.75 1.9 2.15" strokeLinecap="round" />
    </svg>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-neutral-900"
    >
      {children}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <path d="M3.5 8.2 6.4 11l6.1-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
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
  );
}

function ChevronUpIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M4 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
