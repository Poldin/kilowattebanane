import { createSecretClient } from "@/lib/supabase/secret";
import { parseSlidePayload, parseSlideType, slideTitle } from "@/lib/learn/payload";
import type {
  LearnChapter,
  LearnChapterWithSlides,
  LearnSlide,
  LearnSlidePayload,
  LearnSlideType,
} from "@/lib/learn/types";

type SlideRow = {
  id: string;
  type: string;
  payload: unknown;
  active: boolean;
  created_at: string;
};

type ChapterRow = {
  id: string;
  slug: string;
  title: string;
  blurb: string;
  cover_url: string | null;
  takeaway: string;
  sort: number;
  active: boolean;
  created_at: string;
};

type JoinRow = {
  chapter_id: string;
  slide_id: string;
  position: number;
};

function learnClient() {
  return createSecretClient();
}

function asSlide(row: SlideRow): LearnSlide {
  const type = parseSlideType(row.type);
  const payload = parseSlidePayload(type, row.payload);
  return { id: row.id, type, payload, active: row.active, created_at: row.created_at } as LearnSlide;
}

function asChapter(row: ChapterRow): LearnChapter {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    blurb: row.blurb ?? "",
    cover_url: row.cover_url,
    takeaway: row.takeaway ?? "",
    sort: row.sort,
    active: row.active,
    created_at: row.created_at,
  };
}

export async function listLearnSlides(includeInactive = true) {
  const client = learnClient();
  let query = client
    .from("learn_slides")
    .select("id, type, payload, active, created_at")
    .order("created_at", { ascending: false });
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as SlideRow[]).map((row) => {
    try {
      return asSlide(row);
    } catch {
      return {
        id: row.id,
        type: "info",
        payload: { title: slideTitleFallback(row.payload), text: "" },
        active: row.active,
        created_at: row.created_at,
      };
    }
  });
}

function slideTitleFallback(payload: unknown) {
  if (payload && typeof payload === "object" && "title" in payload) {
    const title = (payload as { title?: unknown }).title;
    if (typeof title === "string") return title;
  }
  return "Slide";
}

export async function getLearnSlide(id: string) {
  const client = learnClient();
  const { data, error } = await client
    .from("learn_slides")
    .select("id, type, payload, active, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asSlide(data as SlideRow) : null;
}

export async function createLearnSlide(input: {
  type: LearnSlideType;
  payload: LearnSlidePayload;
  active?: boolean;
}) {
  const client = learnClient();
  const { data, error } = await client
    .from("learn_slides")
    .insert({
      type: input.type,
      payload: input.payload,
      active: input.active ?? true,
    })
    .select("id, type, payload, active, created_at")
    .single();
  if (error) throw new Error(error.message);
  return asSlide(data as SlideRow);
}

export async function updateLearnSlide(
  id: string,
  patch: {
    type?: LearnSlideType;
    payload?: LearnSlidePayload;
    active?: boolean;
  },
) {
  const client = learnClient();
  const { data, error } = await client
    .from("learn_slides")
    .update(patch)
    .eq("id", id)
    .select("id, type, payload, active, created_at")
    .single();
  if (error) throw new Error(error.message);
  return asSlide(data as SlideRow);
}

export async function deleteLearnSlide(id: string) {
  const client = learnClient();
  const { count, error: usedError } = await client
    .from("learn_chapter_slides")
    .select("chapter_id", { count: "exact", head: true })
    .eq("slide_id", id);
  if (usedError) throw new Error(usedError.message);
  if ((count ?? 0) > 0) {
    throw new Error("Questa lezione è usata in un capitolo. Toglila prima dai capitoli.");
  }
  const { error } = await client.from("learn_slides").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listLearnChapters(includeInactive = true) {
  const client = learnClient();
  let query = client
    .from("learn_chapters")
    .select("id, slug, title, blurb, cover_url, takeaway, sort, active, created_at")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as ChapterRow[]).map(asChapter);
}

export async function getLearnChapterBySlug(slug: string, includeInactive = false) {
  const client = learnClient();
  let query = client
    .from("learn_chapters")
    .select("id, slug, title, blurb, cover_url, takeaway, sort, active, created_at")
    .eq("slug", slug);
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return loadChapterSlides(asChapter(data as ChapterRow), !includeInactive);
}

export async function getLearnChapterById(id: string) {
  const client = learnClient();
  const { data, error } = await client
    .from("learn_chapters")
    .select("id, slug, title, blurb, cover_url, takeaway, sort, active, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return loadChapterSlides(asChapter(data as ChapterRow), false);
}

async function loadChapterSlides(
  chapter: LearnChapter,
  activeSlidesOnly: boolean,
): Promise<LearnChapterWithSlides> {
  const client = learnClient();
  const { data, error } = await client
    .from("learn_chapter_slides")
    .select("chapter_id, slide_id, position")
    .eq("chapter_id", chapter.id)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  const joins = (data as JoinRow[]) ?? [];
  if (joins.length === 0) return { ...chapter, slides: [] };

  const { data: slideRows, error: slideError } = await client
    .from("learn_slides")
    .select("id, type, payload, active, created_at")
    .in(
      "id",
      joins.map((row) => row.slide_id),
    );
  if (slideError) throw new Error(slideError.message);

  const byId = new Map((slideRows as SlideRow[]).map((row) => [row.id, row]));
  const slides = joins.flatMap((join) => {
    const row = byId.get(join.slide_id);
    if (!row) return [];
    if (activeSlidesOnly && !row.active) return [];
    try {
      return [asSlide(row)];
    } catch {
      return [];
    }
  });
  return { ...chapter, slides };
}

export async function listLearnChaptersWithCounts() {
  const chapters = await listLearnChapters(true);
  const client = learnClient();
  const { data, error } = await client
    .from("learn_chapter_slides")
    .select("chapter_id, slide_id");
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of (data as { chapter_id: string }[]) ?? []) {
    counts.set(row.chapter_id, (counts.get(row.chapter_id) ?? 0) + 1);
  }
  return chapters.map((chapter) => ({
    ...chapter,
    slideCount: counts.get(chapter.id) ?? 0,
  }));
}

function normalizeSlug(slug: string) {
  const next = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next)) {
    throw new Error("Lo slug può contenere solo lettere minuscole, numeri e trattini.");
  }
  return next;
}

async function replaceChapterSlides(chapterId: string, slideIds: string[]) {
  const client = learnClient();
  const { error: delError } = await client
    .from("learn_chapter_slides")
    .delete()
    .eq("chapter_id", chapterId);
  if (delError) throw new Error(delError.message);
  if (slideIds.length === 0) return;
  const { error } = await client.from("learn_chapter_slides").insert(
    slideIds.map((slideId, position) => ({
      chapter_id: chapterId,
      slide_id: slideId,
      position,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function createLearnChapter(input: {
  slug: string;
  title: string;
  blurb?: string;
  cover_url?: string | null;
  takeaway?: string;
  sort?: number;
  active?: boolean;
  slideIds?: string[];
}) {
  const title = input.title.trim();
  if (!title) throw new Error("Il titolo del capitolo è obbligatorio.");
  const client = learnClient();
  const { data, error } = await client
    .from("learn_chapters")
    .insert({
      slug: normalizeSlug(input.slug),
      title,
      blurb: input.blurb?.trim() ?? "",
      cover_url: input.cover_url || null,
      takeaway: input.takeaway?.trim() ?? "",
      sort: input.sort ?? 0,
      active: input.active ?? true,
    })
    .select("id, slug, title, blurb, cover_url, takeaway, sort, active, created_at")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Questo slug è già usato.");
    throw new Error(error.message);
  }
  const chapter = asChapter(data as ChapterRow);
  await replaceChapterSlides(chapter.id, input.slideIds ?? []);
  return loadChapterSlides(chapter, false);
}

export async function updateLearnChapter(
  id: string,
  patch: {
    slug?: string;
    title?: string;
    blurb?: string;
    cover_url?: string | null;
    takeaway?: string;
    sort?: number;
    active?: boolean;
    slideIds?: string[];
  },
) {
  const client = learnClient();
  const next: Record<string, unknown> = {};
  if (patch.slug != null) next.slug = normalizeSlug(patch.slug);
  if (patch.title != null) {
    const title = patch.title.trim();
    if (!title) throw new Error("Il titolo del capitolo è obbligatorio.");
    next.title = title;
  }
  if (patch.blurb != null) next.blurb = patch.blurb.trim();
  if (patch.cover_url !== undefined) next.cover_url = patch.cover_url || null;
  if (patch.takeaway != null) next.takeaway = patch.takeaway.trim();
  if (patch.sort != null) next.sort = patch.sort;
  if (patch.active != null) next.active = patch.active;

  if (Object.keys(next).length > 0) {
    const { error } = await client.from("learn_chapters").update(next).eq("id", id);
    if (error) {
      if (error.code === "23505") throw new Error("Questo slug è già usato.");
      throw new Error(error.message);
    }
  }
  if (patch.slideIds) await replaceChapterSlides(id, patch.slideIds);
  const chapter = await getLearnChapterById(id);
  if (!chapter) throw new Error("Capitolo non trovato.");
  return chapter;
}

export async function deleteLearnChapter(id: string) {
  const client = learnClient();
  const { error } = await client.from("learn_chapters").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function randomOtherChapter(slug: string) {
  const chapters = await listLearnChapters(false);
  const others = chapters.filter((chapter) => chapter.slug !== slug);
  const pool = others.length > 0 ? others : chapters;
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function publicSlideSummary(slide: LearnSlide) {
  return {
    id: slide.id,
    type: slide.type,
    title: slideTitle(slide.payload),
    active: slide.active,
    created_at: slide.created_at,
  };
}

export async function insertLearnEvent(input: {
  sessionId: string;
  slideId: string;
  chapterId?: string | null;
  interactions?: Record<string, unknown>;
}) {
  const client = learnClient();
  const { data, error } = await client
    .from("learn_events")
    .insert({
      session_id: input.sessionId,
      slide_id: input.slideId,
      chapter_id: input.chapterId || null,
      interactions: input.interactions ?? {},
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateLearnEvent(
  id: string,
  interactions: Record<string, unknown>,
) {
  const client = learnClient();
  const { data, error } = await client
    .from("learn_events")
    .update({ interactions })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}
