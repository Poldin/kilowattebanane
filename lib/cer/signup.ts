import { createSecretClient } from "@/lib/supabase/secret";

export const CER_WAITLIST_ID = "kilowatt-banane-waitlist";

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

export type CerSignupRequest = {
  email: string;
  pod: string | null;
  cabinaCodice: string;
  role: CerSignupRole;
  answers: CerSignupAnswers;
  choices: CerSignupChoice[];
};

export async function insertCerSignupRequest(request: CerSignupRequest) {
  const supabase = createSecretClient();
  const { error } = await supabase.from("cer_signup_requests").insert({
    email: request.email.trim().toLowerCase(),
    pod: request.pod,
    cabina_codice: request.cabinaCodice,
    role: request.role,
    answers: request.answers,
    choices: request.choices,
  });
  if (error) throw new Error(error.message);
}
