"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { MAIL_SIGNUP_HELP_HREF } from "@/lib/cer/help";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORT_MAIL = "attivacer@amicodelpopolo.it";
const MAILTO = `mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent("Voglio sostenere L'Amico del Popolo")}`;

const fieldClass =
  "h-12 w-full rounded-md border border-neutral-200 bg-transparent px-4 text-base text-foreground outline-none placeholder:text-neutral-400 focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600";

const STEPS = [
  "Allega la bolletta",
  "Compila e firma il foglio",
  "Allega un tuo documento di identità",
];

export function CerBeneficiaryForm() {
  const [digital, setDigital] = useState(false);

  return (
    <div id="cer-iscrizione" className="mt-6 w-full">
      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-5 text-neutral-800 sm:px-5">
        <p className="text-pretty text-base font-bold leading-relaxed text-neutral-900 sm:text-lg">
          Segui le istruzioni per supportarci.
        </p>
        <div className="mt-4 rounded-xl border-[3px] border-dashed border-neutral-400 px-4 py-5 sm:px-5">
          <p className="text-pretty text-base leading-relaxed text-neutral-800 sm:text-lg">
            Scrivici una mail a{" "}
            <a
              href={MAILTO}
              className="font-semibold text-neutral-900 underline decoration-neutral-400 underline-offset-2 hover:decoration-neutral-900"
            >
              {SUPPORT_MAIL}
            </a>
          </p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-600 sm:text-base">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-sm leading-relaxed text-neutral-600">
              Hai dubbi?
            </span>
            <a
              href={MAIL_SIGNUP_HELP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
            >
              segui la guida operativa
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDigital(true)}
          className="mt-4 w-full rounded-md border border-neutral-200 px-4 py-3 text-left text-sm leading-relaxed text-neutral-600 transition-colors hover:bg-neutral-50 sm:text-base"
        >
          Vuoi iscriverti digitalmente? Clicca qui e procedi
        </button>
        {digital ? <DigitalSignup /> : null}
      </div>
    </div>
  );
}

function DigitalSignup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-4 rounded-xl border border-neutral-200 px-4 py-5 dark:border-neutral-800"
      noValidate
      aria-label="Iscrizione digitale"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!EMAIL_RE.test(trimmed) || trimmed.length > 254) {
          setError("Inserisci un’email valida.");
          return;
        }
        if (password.length < 8) {
          setError("La password deve avere almeno 8 caratteri.");
          return;
        }
        setError(null);
      }}
    >
      <button
        type="button"
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
      >
        <GoogleMark />
        Continua con Google
      </button>
      <div className="mt-4 flex items-center gap-3 text-xs tracking-[0.16em] text-neutral-400 uppercase">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        oppure
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Email</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="mt-2.5 block">
        <span className="sr-only">Password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClass}
        />
      </label>
      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="mt-4 h-12 w-full rounded-md bg-[#165B44] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Iscriviti
      </button>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.97 6.97 0 0 1 5.48 12c0-.72.13-1.43.36-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}
