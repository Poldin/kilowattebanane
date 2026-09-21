import {
  isLearnSlideType,
  type LearnMultiplePayload,
  type LearnOpenPayload,
  type LearnOption,
  type LearnInfoPayload,
  type LearnSinglePayload,
  type LearnSlidePayload,
  type LearnSlideType,
} from "@/lib/learn/types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalUrl(value: unknown) {
  const text = asString(value);
  return text || null;
}

function asOptions(value: unknown): LearnOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const row = asRecord(item);
    const label = asString(row.label);
    if (!label) return [];
    return [{ id: asString(row.id) || `opt-${index + 1}`, label }];
  });
}

function requireOptions(options: LearnOption[], min = 2) {
  if (options.length < min) {
    throw new Error(`Servono almeno ${min} risposte.`);
  }
  const ids = new Set(options.map((option) => option.id));
  if (ids.size !== options.length) {
    throw new Error("Ogni risposta deve avere un id univoco.");
  }
  return options;
}

export function parseSlideType(value: unknown): LearnSlideType {
  const type = asString(value);
  if (!isLearnSlideType(type)) {
    throw new Error("Tipo slide non valido.");
  }
  return type;
}

export function parseSlidePayload(type: LearnSlideType, raw: unknown): LearnSlidePayload {
  const data = asRecord(raw);
  const title = asString(data.title);
  if (!title) throw new Error("Il titolo è obbligatorio.");
  const image = asOptionalUrl(data.image);

  if (type === "info") {
    const text = asString(data.text);
    if (!text) throw new Error("Il testo è obbligatorio.");
    const payload: LearnInfoPayload = { title, image, text };
    return payload;
  }

  if (type === "open") {
    const question = asString(data.question);
    if (!question) throw new Error("La domanda è obbligatoria.");
    const payload: LearnOpenPayload = {
      title,
      image,
      question,
      explanation: asString(data.explanation) || undefined,
    };
    return payload;
  }

  const question = asString(data.question);
  if (!question) throw new Error("La domanda è obbligatoria.");
  const options = requireOptions(asOptions(data.options));
  const explanation = asString(data.explanation) || undefined;

  if (type === "single") {
    const correctId = asString(data.correctId);
    if (!options.some((option) => option.id === correctId)) {
      throw new Error("Segna la risposta corretta.");
    }
    const payload: LearnSinglePayload = {
      title,
      image,
      question,
      options,
      correctId,
      explanation,
    };
    return payload;
  }

  const correctIds = Array.isArray(data.correctIds)
    ? [...new Set(data.correctIds.map((id) => asString(id)).filter(Boolean))]
    : [];
  if (correctIds.length === 0 || correctIds.some((id) => !options.some((option) => option.id === id))) {
    throw new Error("Segna almeno una risposta corretta.");
  }
  const payload: LearnMultiplePayload = {
    title,
    image,
    question,
    options,
    correctIds,
    explanation,
  };
  return payload;
}

export function slideTitle(payload: LearnSlidePayload) {
  return payload.title;
}

export function emptyPayload(type: LearnSlideType): LearnSlidePayload {
  if (type === "info") return { title: "", text: "" };
  if (type === "open") return { title: "", question: "" };
  if (type === "multiple") {
    return {
      title: "",
      question: "",
      options: [
        { id: "a", label: "" },
        { id: "b", label: "" },
      ],
      correctIds: [],
    };
  }
  return {
    title: "",
    question: "",
    options: [
      { id: "a", label: "" },
      { id: "b", label: "" },
    ],
    correctId: "a",
  };
}
