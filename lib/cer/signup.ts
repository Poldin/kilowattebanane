import { createSecretClient } from "@/lib/supabase/secret";

export const CER_WAITLIST_ID = "kilowatt-banane-waitlist";
export const CER_WAITLIST_LABEL = "Lista d'attesa kilowatt e banane";

export const CER_SHARE_HIGHLIGHT = "sapevi che il 68%";
export const CER_SHARE_REST = "dei nuovi utenti CER arriva per passaparola";
export const CER_SHARE_LEAD = "e tu, con chi puoi condividerlo?";
export const CER_SHARE_TITLE = "Comunità energetiche rinnovabili (CER) · kilowatt e banane";
export const CER_SHARE_TEXT =
  "Scopri la tua cabina primaria e a quali comunità energetiche puoi iscriverti. Gratis.";

export type CerSignupRole = "consumatore" | "produttore";

export type CerSignupImpianto = "attivo" | "progetto";

export type CerSignupChoice = {
  id: string;
  kind: "waitlist" | "cer";
  label: string;
  enabled: boolean;
  rank: number;
};

export type CerSignupAnswers = {
  impianto?: CerSignupImpianto;
  potenzaKw?: number | null;
  prosumer?: boolean;
};

export type CerEnrollmentPath = "nocol" | "1col" | "morecol";

export type CerSignupRequest = {
  email: string;
  pod: string | null;
  cabinaCodice: string | null;
  role: CerSignupRole;
  answers: CerSignupAnswers;
  choices: CerSignupChoice[];
  enrollmentPath: CerEnrollmentPath;
};

export type CerSignupSummaryRow = {
  label: string;
  value: string;
  mono?: boolean;
};

export type CerSignupSummary = {
  nocol: boolean;
  title: string;
  lead: string;
  remember: string | null;
  rows: CerSignupSummaryRow[];
  preferences: string[];
  shareHighlight: string;
  shareRest: string;
  shareLead: string;
  subject: string;
};

export function enrollmentPathForCollaborazioni(count: number): CerEnrollmentPath {
  if (count <= 0) return "nocol";
  if (count === 1) return "1col";
  return "morecol";
}

function formatPotenzaKw(value: number) {
  const label = String(value).replace(".", ",");
  return `${label} kW`;
}

export function cerSignupSummary(request: {
  email: string;
  pod: string | null;
  cabinaCodice: string | null;
  role: CerSignupRole | null;
  answers: CerSignupAnswers;
  choices: CerSignupChoice[];
  enrollmentPath: CerEnrollmentPath;
}): CerSignupSummary {
  const nocol = request.enrollmentPath === "nocol";
  const role = request.role ?? "consumatore";
  const rows: CerSignupSummaryRow[] = [
    { label: "Ruolo", value: role === "produttore" ? "Produttore" : "Consumatore" },
  ];

  if (role === "produttore") {
    if (request.answers.impianto) {
      rows.push({
        label: "Impianto",
        value: request.answers.impianto === "attivo" ? "Già attivo" : "In progetto",
      });
    }
    if (request.answers.potenzaKw != null) {
      rows.push({ label: "Potenza", value: formatPotenzaKw(request.answers.potenzaKw) });
    }
    if (typeof request.answers.prosumer === "boolean") {
      rows.push({
        label: "Uso",
        value: request.answers.prosumer ? "Produco e consumo" : "Solo produco",
      });
    }
  }

  rows.push({ label: "Email", value: request.email.trim() });
  if (request.cabinaCodice) {
    rows.push({ label: "Cabina primaria", value: request.cabinaCodice, mono: true });
  }
  if (request.pod) {
    rows.push({ label: "POD", value: request.pod, mono: true });
  }

  const preferences = nocol
    ? []
    : request.choices
        .filter((choice) => choice.kind !== "waitlist")
        .map((choice) => choice.label);

  return {
    nocol,
    title: nocol ? "Abbiamo registrato la tua richiesta!" : "✅Richiesta inviata",
    lead: nocol
      ? "Al momento non ci sono CER aperte a nuove adesioni nella tua cabina primaria, ma ci attiviamo per te e appena abbiamo notizie ti scriviamo."
      : "Abbiamo registrato la tua richiesta.",
    remember: nocol
      ? "aderire a una CER non comporta mai il cambio del piano di fornitura né pagamenti di alcun tipo. Fai attenzione alle truffe."
      : null,
    rows,
    preferences,
    shareHighlight: CER_SHARE_HIGHLIGHT,
    shareRest: CER_SHARE_REST,
    shareLead: CER_SHARE_LEAD,
    subject: nocol ? "Abbiamo registrato la tua richiesta" : "Richiesta inviata",
  };
}

export async function insertCerSignupRequest(request: CerSignupRequest) {
  const supabase = createSecretClient();
  const cabina = request.cabinaCodice?.trim().toUpperCase() || null;
  const { data, error } = await supabase
    .from("cer_signup_requests")
    .insert({
      email: request.email.trim().toLowerCase(),
      pod: request.pod,
      cabina_codice: cabina,
      role: request.role,
      answers: request.answers,
      choices: request.choices,
      enrollment_path: request.enrollmentPath,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function updateCerSignupMailResult(
  id: string,
  result: { sent: true; resendId: string | null } | { sent: false; error: string },
) {
  const supabase = createSecretClient();
  const patch =
    result.sent
      ? {
          mail_sent_at: new Date().toISOString(),
          mail_resend_id: result.resendId,
          mail_error: null,
        }
      : {
          mail_sent_at: null,
          mail_resend_id: null,
          mail_error: result.error.slice(0, 500),
        };
  const { error } = await supabase.from("cer_signup_requests").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
