"use client";

import {
  FormEvent,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { RegionSelect } from "@/components/RegionSelect";
import { zoneNameForRegion } from "@/lib/regions";

type SignupContextValue = {
  openSignup: () => void;
};

const SignupContext = createContext<SignupContextValue | null>(null);

export function SignupProvider({ children }: { children: React.ReactNode }) {
  const openSignup = useCallback(() => {
    document.getElementById("iscriviti")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <SignupContext.Provider value={{ openSignup }}>
      {children}
    </SignupContext.Provider>
  );
}

export function useSignup() {
  const context = useContext(SignupContext);
  if (!context) {
    throw new Error("useSignup must be used within SignupProvider");
  }
  return context;
}

export function SignupSlot() {
  return (
    <div id="iscriviti" className="mx-auto mt-10 w-full max-w-md scroll-mt-20 sm:mt-12">
      <SignupForm />
    </div>
  );
}

type ConfirmedSignup = {
  email: string;
  region: string;
};

export function SignupForm() {
  const [region, setRegion] = useState("");
  const [email, setEmail] = useState("");
  const [confirmed, setConfirmed] = useState<ConfirmedSignup | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!region || !email || pending) return;

    const form = event.currentTarget;
    const honeypot = new FormData(form).get("website");
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          region,
          website: typeof honeypot === "string" ? honeypot : "",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "Non è stato possibile completare l'iscrizione. Riprova.");
        return;
      }

      setConfirmed({ email, region });
    } catch {
      setError("Non è stato possibile completare l'iscrizione. Riprova.");
    } finally {
      setPending(false);
    }
  }

  function handleConfirmedClose() {
    setConfirmed(null);
    setRegion("");
    setEmail("");
  }

  return (
    <section
      aria-labelledby="signup-heading"
      className="w-full rounded-lg border border-neutral-200 bg-neutral-50 p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-950"
    >
      <h2
        id="signup-heading"
        className="text-base font-medium tracking-tight text-foreground sm:text-lg"
      >
        💌Ricevi ogni giorno i prezzi dell'energia nella tua zona. Gratis.
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Scegli la tua regione e inserisci l&apos;email.
      </p>

      <form onSubmit={handleSubmit} className="relative mt-5 flex flex-col gap-3">
        <div className="hidden" aria-hidden="true">
          <label>
            Sito web
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <RegionSelect required value={region} onChange={setRegion} />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Email
          </span>
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="tu@email.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-md border border-neutral-200 bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:placeholder:text-neutral-600 dark:focus:border-neutral-600"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-10 w-full rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Un attimo…" : "Iscriviti gratis"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-500">
        Annulla quando vuoi direttamente dalle mail.
      </p>

      <SignupConfirmDialog confirmed={confirmed} onClose={handleConfirmedClose} />
    </section>
  );
}

function SignupConfirmDialog({
  confirmed,
  onClose,
}: {
  confirmed: ConfirmedSignup | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const zoneName = confirmed ? zoneNameForRegion(confirmed.region) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirmed) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [confirmed]);

  function requestClose() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="signup-dialog"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
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

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-4 pt-16 sm:px-8 sm:pb-2 sm:pt-10">
          <h2 id={titleId} className="pr-10 text-2xl font-semibold tracking-tight">
            Iscrizione confermata
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Tutto pronto. Ogni giorno ti mandiamo i prezzi nella tua zona.
            Controlla la casella: ti arriva a breve una mail di benvenuto con i
            prezzi di oggi.
          </p>

          {confirmed ? (
            <dl className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
                  Email
                </dt>
                <dd className="text-sm break-all text-foreground">{confirmed.email}</dd>
              </div>
              <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
                  Regione
                </dt>
                <dd className="text-sm text-foreground">{confirmed.region}</dd>
              </div>
              {zoneName ? (
                <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
                    Zona
                  </dt>
                  <dd className="text-sm text-foreground">{zoneName}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>

        <div className="mt-auto px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
          <button
            type="button"
            onClick={requestClose}
            className="h-11 w-full rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Chiudi
          </button>
        </div>
      </div>
    </dialog>
  );
}
