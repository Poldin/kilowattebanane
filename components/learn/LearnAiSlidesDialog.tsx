"use client";

import { useMemo, useState } from "react";
import { LearnAdminDialog } from "@/components/learn/LearnAdminDialog";
import { adminJson } from "@/components/learn/admin-client";
import {
  importedLearnPreview,
  LEARN_AI_SLIDES_PROMPT,
  parseImportedLearnJson,
  type ImportedSlideDraft,
} from "@/lib/learn/ai-import";
import type { LearnChapterWithSlides, LearnSlide } from "@/lib/learn/types";

const AREA =
  "mt-2 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600";
const BTN =
  "h-11 rounded-md border border-neutral-200 bg-neutral-900 px-4 text-sm text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900";
const GHOST =
  "rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900";

export function LearnAiSlidesDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: { chapter: boolean }) => Promise<void>;
}) {
  const [jsonText, setJsonText] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => importedLearnPreview(jsonText), [jsonText]);

  async function copyPrompt() {
    setError(null);
    try {
      await navigator.clipboard.writeText(LEARN_AI_SLIDES_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Non riesco a copiare. Seleziona il prompt e copialo a mano.");
    }
  }

  async function createSlides(slides: ImportedSlideDraft[]) {
    const created: LearnSlide[] = [];
    for (const [index, slide] of slides.entries()) {
      try {
        const payload = await adminJson<{ slide: LearnSlide }>("/api/admin/learn/slides", {
          method: "POST",
          body: JSON.stringify(slide),
        });
        created.push(payload.slide);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Salvataggio fallito.";
        throw new Error(
          created.length > 0
            ? `Create ${created.length} di ${slides.length} lezioni. Errore sul pannello ${index + 1}: ${reason}`
            : `Errore sul pannello ${index + 1}: ${reason}`,
        );
      }
    }
    return created;
  }

  async function createFromJson() {
    setSaving(true);
    setError(null);
    try {
      const draft = parseImportedLearnJson(jsonText);

      if (draft.slides.length > 0) {
        await createSlides(draft.slides);
      }

      for (const [chapterIndex, bundle] of draft.chapters.entries()) {
        const created = await createSlides(bundle.slides);
        try {
          await adminJson<{ chapter: LearnChapterWithSlides }>("/api/admin/learn/chapters", {
            method: "POST",
            body: JSON.stringify({
              ...bundle.chapter,
              slideIds: created.map((slide) => slide.id),
            }),
          });
        } catch (err) {
          const reason = err instanceof Error ? err.message : "Salvataggio fallito.";
          throw new Error(
            `Lezioni create, ma il capitolo ${chapterIndex + 1} no: ${reason}. Le trovi nel tab Lezioni.`,
          );
        }
      }

      setJsonText("");
      await onCreated({ chapter: draft.chapters.length > 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creazione fallita.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <LearnAdminDialog open={open} title="Nuova lezione con AI" onClose={onClose} wide>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Copia il prompt, fallo compilare a un&apos;AI, poi incolla qui il JSON. Puoi creare solo
        lezioni, oppure uno o più capitoli già ordinati.
      </p>
      <div className="mt-3">
        <button type="button" className={GHOST} onClick={() => void copyPrompt()}>
          {copied ? "Prompt copiato" : "Copia prompt per AI"}
        </button>
      </div>
      <label className="mt-4 block text-sm">
        JSON
        <textarea
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          rows={14}
          spellCheck={false}
          className={AREA}
          placeholder='{"chapter":{"title":"…","slug":"…"},"slides":[{"type":"info","payload":{"title":"…","text":"…"}}]}'
        />
      </label>
      {preview ? (
        <p
          className={`mt-2 text-sm ${
            preview.ok ? "text-neutral-600 dark:text-neutral-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {preview.label}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="mt-4">
        <button
          type="button"
          className={BTN}
          disabled={saving || !preview?.ok}
          onClick={() => void createFromJson()}
        >
          {saving ? "Creo…" : "Crea"}
        </button>
      </div>
    </LearnAdminDialog>
  );
}
