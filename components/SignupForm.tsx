"use client";

import {
  FormEvent,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { RegionSelect } from "@/components/RegionSelect";

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
    <div id="iscriviti" className="mx-auto mt-10 w-full max-w-md sm:mt-12">
      <SignupForm />
    </div>
  );
}

export function SignupForm() {
  const [region, setRegion] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!submitted) return;

    const timeoutId = window.setTimeout(() => {
      setSubmitted(false);
      setRegion("");
      setEmail("");
    }, 7000);

    return () => window.clearTimeout(timeoutId);
  }, [submitted]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!region || !email) return;
    // Placeholder until backend is wired.
    setSubmitted(true);
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
        Ricevi i prezzi dell'energia ogni giorno
      </h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Scegli la tua regione e inserisci l&apos;email.
      </p>

      {submitted ? (
        <p className="mt-5 text-sm text-neutral-700 dark:text-neutral-300">
          ✅ Perfetto. Controlla la casella: ti arriverà la prima mail a breve.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
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

          <button
            type="submit"
            className="mt-1 h-10 w-full rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Iscriviti gratis
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-500">
        Annulla quando vuoi direttamente dalle mail.
      </p>
    </section>
  );
}
