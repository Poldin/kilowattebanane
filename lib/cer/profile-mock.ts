/**
 * Mock member profile for the UI-only route /cer/profile.
 * Replace this module when the page reads a real account.
 * Nothing here is fetched or written.
 */
import { isAreaConvenzionaleCode, parsePod } from "@/lib/cer/pod-parse";

export const CER_PROFILE_MOCK_NOTE =
  "Anteprima con dati di esempio. I pulsanti non inviano richieste e non modificano un account.";

export type MembershipStatus = "attiva" | "in_attesa";

export type CerSharePercent = 25 | 50 | 100;

export type MockCer = {
  id: string;
  name: string;
  town: string;
  summary: string;
  siteUrl: string;
  siteName: string;
  cabinaCodice: string;
  members: number;
};

export type MockBeneficiary = {
  id: string;
  name: string;
  town: string;
  description: string;
  logoSrc: string | null;
  initials: string;
  siteUrl: string | null;
};

export type MockActivity = {
  id: string;
  at: string;
  title: string;
  detail: string;
  preview?: boolean;
};

export type FeeTier = {
  id: "otto" | "cinque" | "tre";
  /** Basis points. 800 = 8%. Integer math avoids binary float drift. */
  bps: number;
  label: string;
  band: string;
  /** Inclusive upper bound of the beneficiary amount, in euro cents. */
  maxCents: number;
};

/**
 * Illustrative bands for the preview. The fee applies only to the euro
 * amount directed to the beneficiary, never to the part the household keeps.
 * Replace with the real tariff when the account is wired.
 */
export const CER_FEE_TIERS: readonly FeeTier[] = [
  { id: "otto", bps: 800, label: "8%", band: "fino a 100 €", maxCents: 10_000 },
  {
    id: "cinque",
    bps: 500,
    label: "5%",
    band: "oltre 100 € e fino a 300 €",
    maxCents: 30_000,
  },
  {
    id: "tre",
    bps: 300,
    label: "3%",
    band: "oltre 300 €",
    maxCents: Number.POSITIVE_INFINITY,
  },
];

export const CER_SHARE_OPTIONS: readonly { percent: CerSharePercent; hint: string }[] = [
  { percent: 25, hint: "Un quarto" },
  { percent: 50, hint: "Metà" },
  { percent: 100, hint: "Tutta" },
];

const MEMBER_CABINA = "AC001E04521";

export const CER_PROFILE_MOCK = {
  member: {
    fullName: "Giulia Ferretti",
    email: "giulia.ferretti@email.it",
    status: "attiva" as MembershipStatus,
  },
  supply: {
    /** Valid POD shape: IT + 3 digits + E + 8 characters. Shown masked. */
    pod: "IT001E00001234",
    address: "Via Roma 12",
    postalCode: "30030",
    city: "Vigonovo",
    province: "VE",
    cabinaCodice: MEMBER_CABINA,
    cabinaGestore: "e-distribuzione",
  },
  joinedOn: "2026-03-12",
  currentCerId: "cer-brenta",
  currentBeneficiaryId: "amico",
  sharePercent: 100 as CerSharePercent,
  impact: {
    year: 2026,
    sharedKwh: 1500,
    /** 10 cents = 0,10 € per shared kWh. Gross incentive = kWh × this value. */
    centPerSharedKwh: 10,
  },
  mandate: {
    grantedOn: "2026-03-18",
    can: [
      "Presentare e aggiornare la domanda di adesione alla CER che indichi, usando il POD della tua utenza.",
      "Comunicare il beneficiario e la percentuale della tua quota di incentivo destinata a lui.",
      "Ricevere i dati di energia condivisa che servono a mostrarti le stime in questa pagina.",
    ],
    cannot: [
      "Cambiare il fornitore di energia o il contratto che hai in bolletta.",
      "Addebitarti un costo. La commissione, quando c’è, esce solo dalla quota del beneficiario.",
      "Trattenere la parte di incentivo che decidi di tenere per te.",
    ],
  },
  cers: [
    {
      id: "cer-brenta",
      name: "CER Riviera del Brenta",
      town: "Vigonovo",
      summary:
        "Comunità del territorio tra Vigonovo, Fossò e la Riviera. Aperta a famiglie e piccole attività della stessa cabina.",
      siteUrl: "https://example.com/cer-riviera-del-brenta",
      siteName: "example.com/cer-riviera-del-brenta",
      cabinaCodice: MEMBER_CABINA,
      members: 86,
    },
    {
      id: "cer-saccisica",
      name: "CER Saccisica",
      town: "Piove di Sacco",
      summary:
        "Configurazione già attiva sulla stessa cabina. Il passaggio non cambia il POD né il venditore.",
      siteUrl: "https://example.com/cer-saccisica",
      siteName: "example.com/cer-saccisica",
      cabinaCodice: MEMBER_CABINA,
      members: 41,
    },
    {
      id: "cer-sile",
      name: "CER del Sile",
      town: "Fossò",
      summary:
        "Comunità locale con impianti fotovoltaici su tetti pubblici e di alcune aziende del paese.",
      siteUrl: "https://example.com/cer-del-sile",
      siteName: "example.com/cer-del-sile",
      cabinaCodice: MEMBER_CABINA,
      members: 27,
    },
    {
      id: "cer-brenta-sud",
      name: "CER Brenta Sud",
      town: "Dolo",
      summary:
        "Adesioni di famiglie e associazioni. Stessa area convenzionale della tua utenza.",
      siteUrl: "https://example.com/cer-brenta-sud",
      siteName: "example.com/cer-brenta-sud",
      cabinaCodice: MEMBER_CABINA,
      members: 63,
    },
    {
      id: "cer-laguna-nord",
      name: "CER Laguna Nord",
      town: "Jesolo",
      summary: "Su un’altra cabina primaria: questo POD non può entrarci.",
      siteUrl: "https://example.com/cer-laguna-nord",
      siteName: "example.com/cer-laguna-nord",
      cabinaCodice: "AC001E99999",
      members: 110,
    },
  ] satisfies MockCer[],
  beneficiaries: [
    {
      id: "amico",
      name: "L'Amico del Popolo",
      town: "Venezia",
      description:
        "Settimanale del territorio. La quota che destini sostiene la redazione e il racconto dei paesi.",
      logoSrc: "/cer/amico-del-popolo-logo.png",
      initials: "AP",
      siteUrl: "https://www.amicodelpopolo.it/",
    },
    {
      id: "don-bosco",
      name: "Asilo Don Bosco",
      town: "Vigonovo",
      description:
        "Asilo del paese. Il sostegno va alle attività con i bambini e alle spese della struttura.",
      logoSrc: null,
      initials: "DB",
      siteUrl: null,
    },
    {
      id: "oratorio",
      name: "Oratorio San Marco",
      town: "Fossò",
      description: "Spazio pomeridiano per ragazzi. I fondi restano su materiali e uscite.",
      logoSrc: null,
      initials: "SM",
      siteUrl: null,
    },
    {
      id: "croce-verde",
      name: "Croce Verde Vigonovo",
      town: "Vigonovo",
      description: "Pubblica assistenza. La quota aiuta mezzi e turni dei volontari.",
      logoSrc: null,
      initials: "CV",
      siteUrl: null,
    },
    {
      id: "biblioteca",
      name: "Biblioteca comunale",
      town: "Vigonovo",
      description: "Letture, laboratori e acquisto di libri per il prestito.",
      logoSrc: null,
      initials: "BC",
      siteUrl: null,
    },
    {
      id: "polisportiva",
      name: "Polisportiva Riviera",
      town: "Camponogara",
      description: "Società sportiva dilettantistica. Il contributo resta sulle attività giovanili.",
      logoSrc: null,
      initials: "PR",
      siteUrl: null,
    },
    {
      id: "pro-loco",
      name: "Pro Loco Vigonovo",
      town: "Vigonovo",
      description: "Eventi e feste del paese. Nessun costo per chi dona la propria quota.",
      logoSrc: null,
      initials: "PL",
      siteUrl: null,
    },
  ] satisfies MockBeneficiary[],
  activity: [
    {
      id: "iscrizione",
      at: "2026-03-12T09:40:00+01:00",
      title: "Iscrizione inviata",
      detail: "Richiesta di adesione alla CER Riviera del Brenta.",
    },
    {
      id: "beneficiario",
      at: "2026-03-12T09:41:00+01:00",
      title: "Beneficiario scelto",
      detail: "L'Amico del Popolo, 100% della quota incentivo.",
    },
    {
      id: "mandato",
      at: "2026-03-18T11:05:00+01:00",
      title: "Mandato firmato",
      detail: "Hai autorizzato kilowatt e banane a gestire l’adesione per tuo conto.",
    },
    {
      id: "attiva",
      at: "2026-04-02T16:20:00+01:00",
      title: "Iscrizione attiva",
      detail: "La CER ha confermato il POD sulla cabina AC001E04521.",
    },
    {
      id: "indirizzo",
      at: "2026-09-03T08:12:00+01:00",
      title: "Indirizzo utenza aggiornato",
      detail: "Via Roma 12, 30030 Vigonovo (VE).",
    },
  ] satisfies MockActivity[],
};

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = {
  attiva: "Iscrizione attiva",
  in_attesa: "In attesa di attivazione",
};

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

const longDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Rome",
});

const activityDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

export function maskPod(pod: string) {
  const clean = pod.toUpperCase();
  if (clean.length < 10) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-4)}`;
}

export function formatEuroCents(cents: number) {
  return euro.format(cents / 100);
}

export function formatInt(value: number) {
  return integer.format(value);
}

export function formatLongDate(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return longDate.format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function formatActivityWhen(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return activityDate.format(parsed);
}

export function utenzeLabel(count: number) {
  return `${formatInt(count)} ${count === 1 ? "utenza" : "utenze"}`;
}

export function supplyAddress(supply: typeof CER_PROFILE_MOCK.supply) {
  return `${supply.address}, ${supply.postalCode} ${supply.city} (${supply.province})`;
}

export function cerById(id: string) {
  const cer = CER_PROFILE_MOCK.cers.find((item) => item.id === id);
  if (!cer) throw new Error(`Unknown mock CER: ${id}`);
  return cer;
}

export function beneficiaryById(id: string) {
  const beneficiary = CER_PROFILE_MOCK.beneficiaries.find((item) => item.id === id);
  if (!beneficiary) throw new Error(`Unknown mock beneficiary: ${id}`);
  return beneficiary;
}

export function compatibleCers(cabinaCodice: string) {
  return CER_PROFILE_MOCK.cers.filter((cer) => cer.cabinaCodice === cabinaCodice);
}

export function incompatibleCerCount(cabinaCodice: string) {
  return CER_PROFILE_MOCK.cers.length - compatibleCers(cabinaCodice).length;
}

export function grossIncentiveCents() {
  const { sharedKwh, centPerSharedKwh } = CER_PROFILE_MOCK.impact;
  return sharedKwh * centPerSharedKwh;
}

export function tierForBeneficiaryCents(cents: number) {
  const amount = Math.max(0, cents);
  return (
    CER_FEE_TIERS.find((tier) => amount <= tier.maxCents) ??
    CER_FEE_TIERS[CER_FEE_TIERS.length - 1]
  );
}

export function applyBps(cents: number, bps: number) {
  return Math.round((cents * bps) / 10_000);
}

export type IncentiveSplit = {
  grossCents: number;
  sharePercent: CerSharePercent;
  keptCents: number;
  beneficiaryGrossCents: number;
  tier: FeeTier;
  feeCents: number;
  beneficiaryNetCents: number;
};

export function splitIncentive(sharePercent: CerSharePercent): IncentiveSplit {
  const grossCents = grossIncentiveCents();
  const beneficiaryGrossCents = Math.round((grossCents * sharePercent) / 100);
  const keptCents = grossCents - beneficiaryGrossCents;
  const tier = tierForBeneficiaryCents(beneficiaryGrossCents);
  const feeCents = applyBps(beneficiaryGrossCents, tier.bps);
  return {
    grossCents,
    sharePercent,
    keptCents,
    beneficiaryGrossCents,
    tier,
    feeCents,
    beneficiaryNetCents: beneficiaryGrossCents - feeCents,
  };
}

export function foldSearch(value: string) {
  return value
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function mandateDraftText(input: {
  memberName: string;
  email: string;
  podMasked: string;
  address: string;
  cabina: string;
  gestore: string;
  cerName: string;
  beneficiaryName: string;
  sharePercent: number;
  grantedOnLabel: string;
}) {
  return [
    "BOZZA DIMOSTRATIVA — senza valore",
    "Mandato a kilowatt e banane per l’adesione a una comunità energetica",
    "",
    `Titolare: ${input.memberName}`,
    `Email: ${input.email}`,
    `POD (mascherato): ${input.podMasked}`,
    `Utenza: ${input.address}`,
    `Cabina primaria: ${input.cabina} (${input.gestore})`,
    `CER: ${input.cerName}`,
    `Beneficiario: ${input.beneficiaryName}`,
    `Quota destinata al beneficiario: ${input.sharePercent}%`,
    `Mandato di esempio datato: ${input.grantedOnLabel}`,
    "",
    "La piattaforma può presentare e aggiornare l’adesione, indicare il beneficiario",
    "e leggere i dati di energia condivisa necessari alle stime.",
    "Non può cambiare il fornitore, addebitare costi alla famiglia, né trattenere",
    "la parte di incentivo che resta al titolare.",
    "",
    "File generato nel browser dai dati di esempio della pagina.",
    "Non è firmato e non è stato inviato a nessuno.",
  ].join("\n");
}

function assertProfileMock() {
  const pod = parsePod(CER_PROFILE_MOCK.supply.pod);
  if (!pod.ok) throw new Error(`Mock POD rejected: ${pod.error}`);
  const codes = [
    CER_PROFILE_MOCK.supply.cabinaCodice,
    ...CER_PROFILE_MOCK.cers.map((cer) => cer.cabinaCodice),
  ];
  for (const code of codes) {
    if (!isAreaConvenzionaleCode(code)) throw new Error(`Mock cabina rejected: ${code}`);
  }
  cerById(CER_PROFILE_MOCK.currentCerId);
  beneficiaryById(CER_PROFILE_MOCK.currentBeneficiaryId);
  if (!compatibleCers(CER_PROFILE_MOCK.supply.cabinaCodice).some((cer) => cer.id === CER_PROFILE_MOCK.currentCerId)) {
    throw new Error("Mock member CER is not on the member cabina");
  }
}

assertProfileMock();
