import { parseSlidePayload, parseSlideType } from "@/lib/learn/payload";
import type { LearnSlidePayload, LearnSlideType } from "@/lib/learn/types";

export type ImportedSlideDraft = {
  type: LearnSlideType;
  payload: LearnSlidePayload;
  active: boolean;
};

export type ImportedChapterDraft = {
  title: string;
  slug: string;
  blurb: string;
  takeaway: string;
  sort: number;
  active: boolean;
};

export type ImportedChapterBundle = {
  chapter: ImportedChapterDraft;
  slides: ImportedSlideDraft[];
};

export type ImportedLearnDraft = {
  slides: ImportedSlideDraft[];
  chapters: ImportedChapterBundle[];
};

export const LEARN_AI_SLIDES_PROMPT = `Sei un editor didattico di "kilowatt e banane", sito italiano che spiega il mercato elettrico in modo chiaro, concreto e senza gergo inutile.

Devi generare contenuti per la sezione Learn.
Rispondi SOLO con JSON valido. Niente markdown, niente commenti, niente testo intorno.

Puoi fare DUE cose.

1) SOLO LEZIONI / PANNELLI
Se l'utente chiede una o più slide da riusare dopo, rispondi con un array:
[
  { "type": "info", "active": true, "payload": { ... } },
  { "type": "single", "active": true, "payload": { ... } }
]
Il sistema crea solo le lezioni, nell'ordine dell'array. Non crea un capitolo.

2) CAPITOLO COMPLETO
Se l'utente chiede un capitolo, un percorso, una lezione completa o "crea il capitolo", NON mandare solo l'array.
Manda un oggetto con chapter + slides già in ordine didattico (spiega, poi verifica):
{
  "chapter": {
    "title": "Basi dell'energia elettrica",
    "slug": "basi-dell-energia-elettrica",
    "blurb": "kWh, potenza e bolletta in parole semplici.",
    "takeaway": "Il kWh è energia; i kW del contatore sono potenza.",
    "active": true
  },
  "slides": [
    { "type": "info", "active": true, "payload": { ... } },
    { "type": "single", "active": true, "payload": { ... } }
  ]
}
Il sistema crea le lezioni in quell'ordine e le mette subito nel capitolo.

Più capitoli insieme: usa "chapters" (ogni elemento ha i campi del capitolo e "slides"), oppure un array di oggetti capitolo.

CAMPI CAPITOLO
- title: obbligatorio.
- slug: minuscolo, solo a-z 0-9 e trattini. Se manca, deducilo dal titolo (senza accenti).
- blurb: anteprima breve, 1-2 frasi.
- takeaway: cosa deve restare in testa a fine capitolo.
- sort: numero d'ordine, default 0.
- active: default true.
- Non inventare cover o URL immagini.

TIPI SLIDE
- "info": slide informativa. payload: title (obbligatorio), text (obbligatorio), image (opzionale, omettila se non hai un URL reale).
- "single": una sola risposta corretta. payload: title, question, options [{id, label}], correctId (id di options), explanation (consigliata), image (opzionale).
- "multiple": una o più risposte corrette. payload: title, question, options [{id, label}], correctIds (array di id), explanation (consigliata), image (opzionale).
- "open": domanda aperta, senza opzioni. payload: title, question, explanation (consigliata), image (opzionale).

REGOLE
- Italiano, tono diretto, esempi quotidiani (bolletta, kWh, fascia, prezzo).
- title breve. question/text completi e utili.
- options: almeno 2, id univoci corti ("a", "b", "c"...), label non vuota.
- single: correctId deve esistere. multiple: almeno un id in correctIds, tutti esistenti.
- Non inventare URL di immagini: ometti "image".
- Link nel testo solo così: [etichetta](https://esempio.it) oppure URL https://...
- Se l'utente descrive i contenuti, inventa tu titoli, domande e distrattori plausibili.
- Un capitolo deve avere almeno una slide. Metti le slide in ordine di fruizione.

ESEMPIO SOLO PANNELLI

[
  {
    "type": "info",
    "active": true,
    "payload": {
      "title": "Cos'è un kWh",
      "text": "Il chilowattora è l'unità della bolletta: 1 kWh è l'energia di 1000 watt accesi per un'ora. Un ciclo di lavatrice sta spesso tra 0,5 e 1,5 kWh."
    }
  },
  {
    "type": "single",
    "active": true,
    "payload": {
      "title": "Unità in bolletta",
      "question": "Cosa misura il kWh nella bolletta luce?",
      "options": [
        { "id": "a", "label": "La potenza massima del contatore" },
        { "id": "b", "label": "L'energia consumata" },
        { "id": "c", "label": "Il prezzo al minuto" }
      ],
      "correctId": "b",
      "explanation": "Il kWh misura l'energia. I kW del contatore sono la potenza, un'altra cosa."
    }
  }
]

ESEMPIO CAPITOLO COMPLETO

{
  "chapter": {
    "title": "Basi dell'energia elettrica",
    "slug": "basi-dell-energia-elettrica",
    "blurb": "Capire kWh e potenza serve a leggere la bolletta senza farsi confondere.",
    "takeaway": "kWh = energia consumata. kW = potenza del contatore.",
    "active": true
  },
  "slides": [
    {
      "type": "info",
      "active": true,
      "payload": {
        "title": "Cos'è un kWh",
        "text": "Il chilowattora è l'unità della bolletta: 1 kWh è l'energia di 1000 watt accesi per un'ora."
      }
    },
    {
      "type": "multiple",
      "active": true,
      "payload": {
        "title": "Cosa sposta i consumi",
        "question": "Quali azioni spostano davvero i kWh fuori dalle ore care?",
        "options": [
          { "id": "a", "label": "Lavatrice dopo cena" },
          { "id": "b", "label": "Abbassare il termostato di 0,1 °C per un minuto" },
          { "id": "c", "label": "Lavastoviglie in fascia notturna" },
          { "id": "d", "label": "Tenere le luci accese di giorno" }
        ],
        "correctIds": ["a", "c"],
        "explanation": "Contano gli elettrodomestici esosi, non i gesti minuscoli."
      }
    },
    {
      "type": "open",
      "active": true,
      "payload": {
        "title": "Leggi la tua bolletta",
        "question": "Apri l'ultima bolletta: quanti kWh hai consumato nel periodo e in quale fascia hai speso di più?",
        "explanation": "Cerca kWh totali e, se c'è, la ripartizione F1/F2/F3 o monoraria."
      }
    }
  ]
}

Se l'utente non ha ancora detto cosa vuole, aspetta la richiesta e poi rispondi solo con il JSON.
`;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stripJsonFences(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function slugifyLearn(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function draftFromRow(row: unknown, index: number): ImportedSlideDraft {
  const data = asRecord(row);
  if (!data) {
    throw new Error(`Il pannello ${index + 1} non è un oggetto.`);
  }
  const type = parseSlideType(data.type);
  const payload = parseSlidePayload(type, data.payload ?? data);
  return {
    type,
    payload,
    active: data.active !== false,
  };
}

function parseChapterDraft(raw: unknown): ImportedChapterDraft {
  const data = asRecord(raw);
  if (!data) throw new Error("Il capitolo non è un oggetto.");
  const title = asString(data.title);
  if (!title) throw new Error("Il titolo del capitolo è obbligatorio.");
  const slug = slugifyLearn(asString(data.slug) || title);
  if (!slug) throw new Error("Lo slug del capitolo non è valido.");
  return {
    title,
    slug,
    blurb: asString(data.blurb),
    takeaway: asString(data.takeaway),
    sort: typeof data.sort === "number" ? data.sort : Number(data.sort ?? 0) || 0,
    active: data.active !== false,
  };
}

function slideRowsFrom(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  const data = asRecord(parsed);
  if (!data) return null;
  const nested = data.slides ?? data.lessons ?? data.pannelli;
  if (Array.isArray(nested)) return nested;
  if (data.type != null) return [parsed];
  return null;
}

function looksLikeSlide(row: unknown) {
  const data = asRecord(row);
  return data != null && data.type != null;
}

function looksLikeChapterBundle(row: unknown) {
  const data = asRecord(row);
  if (!data || data.type != null) return false;
  if (data.chapter != null || data.capitolo != null) return true;
  const nested = data.slides ?? data.lessons ?? data.pannelli;
  return Array.isArray(nested) && asString(data.title) !== "";
}

function parseChapterBundle(row: unknown, index: number): ImportedChapterBundle {
  const data = asRecord(row);
  if (!data) throw new Error(`Il capitolo ${index + 1} non è un oggetto.`);
  const rows = slideRowsFrom(data);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Il capitolo ${index + 1} non ha lezioni.`);
  }
  return {
    chapter: parseChapterDraft(data.chapter ?? data.capitolo ?? data),
    slides: rows.map((item, slideIndex) => draftFromRow(item, slideIndex)),
  };
}

function parseSlides(rows: unknown[], label: string) {
  if (rows.length === 0) throw new Error(label);
  return rows.map((row, index) => draftFromRow(row, index));
}

export function parseImportedLearnJson(text: string): ImportedLearnDraft {
  const trimmed = stripJsonFences(text);
  if (!trimmed) throw new Error("Incolla il JSON generato dall'AI.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("JSON non valido. Controlla virgole e virgolette.");
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error("Serve almeno una lezione: un array, oppure { chapter, slides }.");
    }
    if (parsed.every(looksLikeSlide)) {
      return { slides: parseSlides(parsed, "Serve almeno una lezione."), chapters: [] };
    }
    if (parsed.every(looksLikeChapterBundle)) {
      return { slides: [], chapters: parsed.map((row, index) => parseChapterBundle(row, index)) };
    }
    throw new Error("Non mescolare lezioni e capitoli nello stesso array.");
  }

  const data = asRecord(parsed);
  const chapterList = data?.chapters ?? data?.capitoli;
  if (Array.isArray(chapterList)) {
    if (chapterList.length === 0) throw new Error("Serve almeno un capitolo.");
    return {
      slides: [],
      chapters: chapterList.map((row, index) => parseChapterBundle(row, index)),
    };
  }

  const rows = slideRowsFrom(parsed);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Serve almeno una lezione: un array, oppure { chapter, slides }.");
  }

  const slides = parseSlides(rows, "Serve almeno una lezione.");
  const chapterRaw = data?.chapter ?? data?.capitolo;
  const looksLikeChapterRoot =
    data != null &&
    data.type == null &&
    asString(data.title) !== "" &&
    (data.slides != null || data.lessons != null || data.pannelli != null);

  if (chapterRaw || looksLikeChapterRoot) {
    return {
      slides: [],
      chapters: [{ chapter: parseChapterDraft(chapterRaw ?? data), slides }],
    };
  }

  return { slides, chapters: [] };
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function importedLearnPreview(text: string): { ok: boolean; label: string } | null {
  if (!text.trim()) return null;
  try {
    const draft = parseImportedLearnJson(text);
    if (draft.chapters.length > 0) {
      const head = countLabel(draft.chapters.length, "capitolo", "capitoli");
      const parts = draft.chapters.map((bundle, index) =>
        `${index + 1} ${countLabel(bundle.slides.length, "lezione", "lezioni")}`,
      );
      return { ok: true, label: [head, ...parts].join("; ") };
    }
    return { ok: true, label: countLabel(draft.slides.length, "lezione", "lezioni") };
  } catch {
    return { ok: false, label: "errore" };
  }
}
