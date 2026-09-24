"use client";

import { useCallback, useEffect, useState } from "react";
import { LearnAdminDialog } from "@/components/learn/LearnAdminDialog";
import { LearnAiSlidesDialog } from "@/components/learn/LearnAiSlidesDialog";
import { LearnImagePicker } from "@/components/learn/LearnImagePicker";
import { adminJson } from "@/components/learn/admin-client";
import { OFFERTE_ADMIN_TOKEN_KEY } from "@/lib/offerte/admin-constants";
import { emptyPayload } from "@/lib/learn/payload";
import {
  LEARN_SLIDE_TYPES,
  type LearnChapter,
  type LearnChapterWithSlides,
  type LearnOption,
  type LearnSlide,
  type LearnSlidePayload,
  type LearnSlideType,
} from "@/lib/learn/types";

const FIELD =
  "mt-2 h-11 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm outline-none focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600";
const AREA =
  "mt-2 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-800 dark:focus:border-neutral-600";
const BTN =
  "h-11 rounded-md border border-neutral-200 bg-neutral-900 px-4 text-sm text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900";
const GHOST =
  "rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900";

const TYPE_LABEL: Record<LearnSlideType, string> = {
  single: "Risposta singola",
  multiple: "Risposta multipla",
  info: "Slide informativa",
  open: "Risposta aperta",
};

type ChapterRow = LearnChapter & { slideCount?: number; slides?: LearnSlide[] };

export function LearnAdmin() {
  const [configured, setConfigured] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [tab, setTab] = useState<"slides" | "chapters">("slides");
  const [aiOpen, setAiOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch("/api/admin/offerte/session");
      const session = (await sessionRes.json()) as {
        configured?: boolean;
        authenticated?: boolean;
      };
      if (!sessionRes.ok || session.configured === false) {
        setConfigured(false);
        setAuthenticated(false);
        return;
      }
      setConfigured(true);
      setAuthenticated(Boolean(session.authenticated));
    } catch {
      setAuthError("Non riesco a verificare la sessione.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setAuthError(null);
    const response = await fetch("/api/admin/offerte/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = (await response.json()) as { error?: string; token?: string };
    if (!response.ok) {
      setAuthError(payload.error ?? "Password errata.");
      return;
    }
    if (payload.token) localStorage.setItem(OFFERTE_ADMIN_TOKEN_KEY, payload.token);
    setPassword("");
    setAuthenticated(true);
  }

  async function handleLogout() {
    await fetch("/api/admin/offerte/session", { method: "DELETE" });
    localStorage.removeItem(OFFERTE_ADMIN_TOKEN_KEY);
    setAuthenticated(false);
  }

  if (loading) {
    return <p className="mt-6 text-sm text-neutral-500">Carico…</p>;
  }
  if (!configured) {
    return (
      <p className="mt-6 text-sm text-red-600 dark:text-red-400">
        Imposta <code className="text-xs">OFFERTE_ADMIN_PASSWORD</code> per abilitare questa pagina.
      </p>
    );
  }
  if (!authenticated) {
    return (
      <form className="mt-8 max-w-sm" onSubmit={handleLogin}>
        <label htmlFor="learn-admin-password" className="text-sm text-neutral-600 dark:text-neutral-400">
          Password
        </label>
        <input
          id="learn-admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={FIELD}
        />
        {authError ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{authError}</p> : null}
        <button type="submit" className={`${BTN} mt-4`}>
          Entra
        </button>
      </form>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button type="button" className={tabClass(tab === "slides")} onClick={() => setTab("slides")}>
            Lezioni
          </button>
          <button type="button" className={tabClass(tab === "chapters")} onClick={() => setTab("chapters")}>
            Capitoli
          </button>
        </div>
        <button type="button" onClick={() => void handleLogout()} className={GHOST}>
          Esci
        </button>
      </div>
      {tab === "slides" ? (
        <SlidesPanel reloadToken={reloadToken} onOpenAi={() => setAiOpen(true)} />
      ) : (
        <ChaptersPanel reloadToken={reloadToken} />
      )}
      <LearnAiSlidesDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onCreated={async (result) => {
          setAiOpen(false);
          if (result.chapter) setTab("chapters");
          setReloadToken((value) => value + 1);
        }}
      />
    </div>
  );
}

function tabClass(active: boolean) {
  return `rounded-md px-3 py-1.5 text-sm ${
    active
      ? "bg-foreground text-background"
      : "border border-neutral-200 text-neutral-700 dark:border-neutral-800 dark:text-neutral-300"
  }`;
}

function SlidesPanel({
  reloadToken,
  onOpenAi,
}: {
  reloadToken: number;
  onOpenAi: () => void;
}) {
  const [slides, setSlides] = useState<LearnSlide[]>([]);
  const [editing, setEditing] = useState<LearnSlide | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const payload = await adminJson<{ slides: LearnSlide[] }>("/api/admin/learn/slides");
    setSlides(sortNewest(payload.slides));
  }, []);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Caricamento fallito.");
    });
  }, [load, reloadToken]);

  useEffect(() => {
    if (!pendingDeleteId) return;
    const timer = window.setTimeout(() => setPendingDeleteId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingDeleteId]);

  async function handleTrashClick(slide: LearnSlide) {
    if (deletingId) return;
    if (pendingDeleteId === slide.id) {
      setDeletingId(slide.id);
      setError(null);
      try {
        await adminJson(`/api/admin/learn/slides/${slide.id}`, { method: "DELETE" });
        setPendingDeleteId(null);
        if (editing && editing !== "new" && editing.id === slide.id) {
          setEditing(null);
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Eliminazione fallita.");
      } finally {
        setDeletingId(null);
      }
      return;
    }
    setPendingDeleteId(slide.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Una lezione è una slide. Puoi riusarla in più capitoli.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={GHOST} onClick={() => setEditing("new")}>
            Nuova lezione
          </button>
          <button type="button" className={GHOST} onClick={onOpenAi}>
            Nuova lezione con AI
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {editing ? (
        <SlideEditor
          slide={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {slides.map((slide) => {
          const pendingDelete = pendingDeleteId === slide.id;
          return (
            <li key={slide.id}>
              <div
                className={`relative flex h-full w-full flex-col rounded-lg border border-neutral-200 transition-colors dark:border-neutral-800 ${
                  pendingDelete ? "learn-admin-card-flash" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setEditing(slide)}
                  className="flex flex-1 flex-col p-4 pr-24 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    <LessonTypeIcon type={slide.type} />
                    {TYPE_LABEL[slide.type]}
                    {slide.active ? null : " · esclusa"}
                  </span>
                  <span className="mt-2 line-clamp-2 font-medium leading-snug">
                    {slide.payload.title || "Senza titolo"}
                  </span>
                  <span className="mt-auto pt-3 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatCreated(slide.created_at)}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleTrashClick(slide);
                  }}
                  className={`absolute right-2 top-2 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    pendingDelete
                      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
                  }`}
                  aria-label={pendingDelete ? "Conferma eliminazione lezione" : "Elimina lezione"}
                  title={pendingDelete ? "Clicca di nuovo per eliminare" : "Elimina lezione"}
                >
                  <TrashIcon />
                  <span>Elimina</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SlideEditor({
  slide,
  onClose,
  onSaved,
  framed = true,
  hideHeader = false,
}: {
  slide: LearnSlide | null;
  onClose: () => void;
  onSaved: (result?: { deleted?: boolean }) => Promise<void>;
  framed?: boolean;
  hideHeader?: boolean;
}) {
  const [type, setType] = useState<LearnSlideType>(slide?.type ?? "single");
  const [payload, setPayload] = useState<LearnSlidePayload>(slide?.payload ?? emptyPayload("single"));
  const [active, setActive] = useState(slide?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeType(next: LearnSlideType) {
    setType(next);
    setPayload({
      ...emptyPayload(next),
      title: payload.title,
      image: payload.image,
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (slide) {
        await adminJson(`/api/admin/learn/slides/${slide.id}`, {
          method: "PATCH",
          body: JSON.stringify({ type, payload, active }),
        });
      } else {
        await adminJson("/api/admin/learn/slides", {
          method: "POST",
          body: JSON.stringify({ type, payload, active }),
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio fallito.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!slide) return;
    if (!confirm("Eliminare questa lezione?")) return;
    setSaving(true);
    setError(null);
    try {
      await adminJson(`/api/admin/learn/slides/${slide.id}`, { method: "DELETE" });
      await onSaved({ deleted: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eliminazione fallita.");
      setSaving(false);
    }
  }

  return (
    <div
      className={
        framed
          ? "space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          : "space-y-4"
      }
    >
      {hideHeader ? null : (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">{slide ? "Modifica lezione" : "Nuova lezione"}</h2>
          <button type="button" className={GHOST} onClick={onClose}>
            Chiudi
          </button>
        </div>
      )}
      <label className="block text-sm">
        Tipo
        <select
          value={type}
          onChange={(event) => changeType(event.target.value as LearnSlideType)}
          className={FIELD}
        >
          {LEARN_SLIDE_TYPES.map((item) => (
            <option key={item} value={item}>
              {TYPE_LABEL[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Titolo
        <input
          value={payload.title}
          onChange={(event) => setPayload({ ...payload, title: event.target.value })}
          className={FIELD}
        />
      </label>
      <div>
        <p className="text-sm">Immagine</p>
        <LearnImagePicker
          value={payload.image}
          onChange={(image) => setPayload({ ...payload, image })}
        />
      </div>
      {type === "info" ? (
        <label className="block text-sm">
          Testo
          <textarea
            value={"text" in payload ? payload.text : ""}
            onChange={(event) => setPayload({ ...payload, text: event.target.value })}
            rows={6}
            className={AREA}
          />
        </label>
      ) : (
        <label className="block text-sm">
          Domanda
          <textarea
            value={"question" in payload ? payload.question : ""}
            onChange={(event) => setPayload({ ...payload, question: event.target.value })}
            rows={3}
            className={AREA}
          />
        </label>
      )}
      {type === "single" || type === "multiple" ? (
        <OptionsEditor type={type} payload={payload} onChange={setPayload} />
      ) : null}
      {type !== "info" ? (
        <label className="block text-sm">
          Spiegazione
          <textarea
            value={"explanation" in payload ? payload.explanation ?? "" : ""}
            onChange={(event) => setPayload({ ...payload, explanation: event.target.value })}
            rows={3}
            className={AREA}
          />
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        Attiva
      </label>
      <p className="text-xs text-neutral-500">
        Link: incolla un URL o usa <code>[testo](https://…)</code>.
      </p>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} disabled={saving} onClick={() => void save()}>
          {saving ? "Salvo…" : "Salva"}
        </button>
        {slide ? (
          <button type="button" className={GHOST} disabled={saving} onClick={() => void remove()}>
            Elimina
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OptionsEditor({
  type,
  payload,
  onChange,
}: {
  type: "single" | "multiple";
  payload: LearnSlidePayload;
  onChange: (payload: LearnSlidePayload) => void;
}) {
  const options = "options" in payload ? payload.options : [];
  const correctId = "correctId" in payload ? payload.correctId : "";
  const correctIds = "correctIds" in payload ? payload.correctIds : [];

  function updateOptions(next: LearnOption[]) {
    if (type === "single" && "correctId" in payload) {
      onChange({ ...payload, options: next, correctId: payload.correctId });
      return;
    }
    if (type === "multiple" && "correctIds" in payload) {
      onChange({ ...payload, options: next, correctIds: payload.correctIds });
    }
  }

  function toggleCorrect(id: string) {
    if (type === "single" && "correctId" in payload) {
      onChange({ ...payload, options, correctId: id });
      return;
    }
    if (type === "multiple" && "correctIds" in payload) {
      const next = payload.correctIds.includes(id)
        ? payload.correctIds.filter((item) => item !== id)
        : [...payload.correctIds, id];
      onChange({ ...payload, options, correctIds: next });
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">Risposte</p>
      {options.map((option, index) => (
        <div key={option.id} className="flex items-center gap-2">
          <input
            type={type === "single" ? "radio" : "checkbox"}
            name="learn-correct"
            checked={type === "single" ? correctId === option.id : correctIds.includes(option.id)}
            onChange={() => toggleCorrect(option.id)}
            aria-label="Corretta"
          />
          <input
            value={option.label}
            onChange={(event) => {
              const next = options.map((item, itemIndex) =>
                itemIndex === index ? { ...item, label: event.target.value } : item,
              );
              updateOptions(next);
            }}
            className={`${FIELD} mt-0!`}
            placeholder={`Risposta ${index + 1}`}
          />
          <button
            type="button"
            className={GHOST}
            onClick={() => updateOptions(options.filter((_, itemIndex) => itemIndex !== index))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={GHOST}
        onClick={() =>
          updateOptions([...options, { id: crypto.randomUUID().slice(0, 8), label: "" }])
        }
      >
        Aggiungi risposta
      </button>
    </div>
  );
}

function ChaptersPanel({ reloadToken }: { reloadToken: number }) {
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [slides, setSlides] = useState<LearnSlide[]>([]);
  const [editing, setEditing] = useState<ChapterRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSlides = useCallback(async () => {
    const slidePayload = await adminJson<{ slides: LearnSlide[] }>("/api/admin/learn/slides");
    const next = sortNewest(slidePayload.slides);
    setSlides(next);
    return next;
  }, []);

  const load = useCallback(async () => {
    const [chapterPayload] = await Promise.all([
      adminJson<{ chapters: ChapterRow[] }>("/api/admin/learn/chapters"),
      loadSlides(),
    ]);
    setChapters(chapterPayload.chapters);
  }, [loadSlides]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Caricamento fallito.");
    });
  }, [load, reloadToken]);

  async function openChapter(id: string) {
    const payload = await adminJson<{ chapter: LearnChapterWithSlides }>(
      `/api/admin/learn/chapters/${id}`,
    );
    setEditing(payload.chapter);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-3">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Un capitolo è una sequenza ordinata di lezioni.
        </p>
        <button type="button" className={GHOST} onClick={() => setEditing("new")}>
          Nuovo capitolo
        </button>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {editing ? (
        <ChapterEditor
          chapter={editing === "new" ? null : editing}
          slides={slides}
          onClose={() => setEditing(null)}
          onSlidesChanged={loadSlides}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {chapters.map((chapter) => (
          <li key={chapter.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{chapter.title}</p>
              <p className="text-xs text-neutral-500">
                /learn/{chapter.slug} · {chapter.slideCount ?? chapter.slides?.length ?? 0} lezioni
                {chapter.active ? "" : " · escluso"}
              </p>
            </div>
            <button type="button" className={GHOST} onClick={() => void openChapter(chapter.id)}>
              Modifica
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChapterEditor({
  chapter,
  slides,
  onClose,
  onSaved,
  onSlidesChanged,
}: {
  chapter: ChapterRow | null;
  slides: LearnSlide[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onSlidesChanged: () => Promise<LearnSlide[]>;
}) {
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [slug, setSlug] = useState(chapter?.slug ?? "");
  const [blurb, setBlurb] = useState(chapter?.blurb ?? "");
  const [takeaway, setTakeaway] = useState(chapter?.takeaway ?? "");
  const [cover, setCover] = useState<string | null>(chapter?.cover_url ?? null);
  const [sort, setSort] = useState(chapter?.sort ?? 0);
  const [active, setActive] = useState(chapter?.active ?? true);
  const [slideIds, setSlideIds] = useState<string[]>(
    chapter?.slides?.map((slide) => slide.id) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(chapter));
  const [editingSlide, setEditingSlide] = useState<LearnSlide | null>(null);

  const unused = slides.filter((slide) => slide.active && !slideIds.includes(slide.id));

  async function save() {
    setSaving(true);
    setError(null);
    const body = {
      title,
      slug,
      blurb,
      takeaway,
      cover_url: cover,
      sort,
      active,
      slideIds,
    };
    try {
      if (chapter) {
        await adminJson(`/api/admin/learn/chapters/${chapter.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await adminJson("/api/admin/learn/chapters", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio fallito.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!chapter) return;
    if (!confirm("Eliminare questo capitolo?")) return;
    setSaving(true);
    try {
      await adminJson(`/api/admin/learn/chapters/${chapter.id}`, { method: "DELETE" });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eliminazione fallita.");
      setSaving(false);
    }
  }

  function move(id: string, delta: number) {
    const index = slideIds.indexOf(id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= slideIds.length) return;
    const next = [...slideIds];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    setSlideIds(next);
  }

  function addSlide(id: string) {
    if (slideIds.includes(id)) return;
    setSlideIds([...slideIds, id]);
  }

  return (
    <>
    <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-4">
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="text-sm font-medium">Lezioni disponibili</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Non usate in questo capitolo. Clicca per aggiungere.
          </p>
          {unused.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {unused.map((slide) => (
                <li key={slide.id}>
                  <button
                    type="button"
                    onClick={() => addSlide(slide.id)}
                    className="flex w-full items-start gap-2 rounded-md border border-neutral-200 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  >
                    <LessonTypeIcon type={slide.type} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {slide.payload.title || "Senza titolo"}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                        {TYPE_LABEL[slide.type]}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Nessuna lezione attiva da aggiungere.</p>
          )}
        </div>
      </aside>
      <div className="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{chapter ? "Modifica capitolo" : "Nuovo capitolo"}</h2>
        <button type="button" className={GHOST} onClick={onClose}>
          Chiudi
        </button>
      </div>
      <label className="block text-sm">
        Titolo
        <input
          value={title}
          onChange={(event) => {
            const next = event.target.value;
            setTitle(next);
            if (!slugTouched) setSlug(slugify(next));
          }}
          className={FIELD}
        />
      </label>
      <label className="block text-sm">
        Slug
        <input
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          className={FIELD}
        />
      </label>
      <label className="block text-sm">
        Anteprima
        <textarea value={blurb} onChange={(event) => setBlurb(event.target.value)} rows={2} className={AREA} />
      </label>
      <label className="block text-sm">
        Takeaway finale
        <textarea
          value={takeaway}
          onChange={(event) => setTakeaway(event.target.value)}
          rows={2}
          className={AREA}
        />
      </label>
      <div>
        <p className="text-sm">Cover</p>
        <LearnImagePicker value={cover} onChange={setCover} />
      </div>
      <label className="block text-sm">
        Ordine
        <input
          type="number"
          value={sort}
          onChange={(event) => setSort(Number(event.target.value) || 0)}
          className={FIELD}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
        Attivo
      </label>

      <div>
        <p className="text-sm font-medium">Lezioni nel capitolo</p>
        <ul className="mt-2 space-y-2">
          {slideIds.map((id, index) => {
            const slide = slides.find((item) => item.id === id);
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
              >
                <span className="flex min-w-0 items-center gap-2 truncate">
                  {slide ? <LessonTypeIcon type={slide.type} /> : null}
                  <span className="truncate">
                    {index + 1}. {slide?.payload.title ?? id}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className={GHOST}
                    disabled={!slide}
                    onClick={() => {
                      if (slide) setEditingSlide(slide);
                    }}
                  >
                    Modifica
                  </button>
                  <button type="button" className={GHOST} onClick={() => move(id, -1)}>
                    ↑
                  </button>
                  <button type="button" className={GHOST} onClick={() => move(id, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className={GHOST}
                    onClick={() => setSlideIds(slideIds.filter((item) => item !== id))}
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        {unused.length > 0 ? (
          <label className="mt-3 block text-sm lg:hidden">
            Aggiungi lezione
            <select
              className={FIELD}
              value=""
              onChange={(event) => {
                if (event.target.value) addSlide(event.target.value);
              }}
            >
              <option value="">Scegli…</option>
              {unused.map((slide) => (
                <option key={slide.id} value={slide.id}>
                  {slide.payload.title} · {TYPE_LABEL[slide.type]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-2 text-sm text-neutral-500 lg:hidden">Nessuna lezione attiva da aggiungere.</p>
        )}
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} disabled={saving} onClick={() => void save()}>
          {saving ? "Salvo…" : "Salva capitolo"}
        </button>
        {chapter ? (
          <button type="button" className={GHOST} disabled={saving} onClick={() => void remove()}>
            Elimina
          </button>
        ) : null}
      </div>
      </div>
    </div>
      <LearnAdminDialog
        open={Boolean(editingSlide)}
        title={editingSlide ? "Modifica lezione" : "Lezione"}
        onClose={() => setEditingSlide(null)}
        wide
      >
        {editingSlide ? (
          <SlideEditor
            key={editingSlide.id}
            slide={editingSlide}
            framed={false}
            hideHeader
            onClose={() => setEditingSlide(null)}
            onSaved={async (result) => {
              const id = editingSlide.id;
              setEditingSlide(null);
              await onSlidesChanged();
              if (result?.deleted) {
                setSlideIds((ids) => ids.filter((item) => item !== id));
              }
            }}
          />
        ) : null}
      </LearnAdminDialog>
    </>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortNewest(slides: LearnSlide[]) {
  return [...slides].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
}

function formatCreated(iso: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  }).format(new Date(iso));
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d="M3.5 4.5h9M6 4.5V3.25A.75.75 0 0 1 6.75 2.5h2.5a.75.75 0 0 1 .75.75V4.5M6.25 7v4.25M9.75 7v4.25M4.25 4.5l.5 8.25A.75.75 0 0 0 5.5 13.5h5a.75.75 0 0 0 .75-.75l.5-8.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LessonTypeIcon({ type }: { type: LearnSlideType }) {
  const className = "h-4 w-4 shrink-0";
  if (type === "single") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
        <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="2.1" fill="currentColor" />
      </svg>
    );
  }
  if (type === "multiple") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
        <rect x="2.5" y="2.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M3.6 5.1 4.7 6.2 7 3.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="8.5" y="8.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M9.6 11.1 10.7 12.2 13 9.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === "open") {
    return (
      <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
        <path
          d="M3 4.5h10M3 8h7M3 11.5h5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <rect x="3.5" y="2.5" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6h4M6 9h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
