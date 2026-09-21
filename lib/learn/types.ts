export const LEARN_SLIDE_TYPES = ["single", "multiple", "info", "open"] as const;

export type LearnSlideType = (typeof LEARN_SLIDE_TYPES)[number];

export type LearnOption = {
  id: string;
  label: string;
};

type LearnMedia = {
  title: string;
  image?: string | null;
};

export type LearnSinglePayload = LearnMedia & {
  question: string;
  options: LearnOption[];
  correctId: string;
  explanation?: string;
};

export type LearnMultiplePayload = LearnMedia & {
  question: string;
  options: LearnOption[];
  correctIds: string[];
  explanation?: string;
};

export type LearnInfoPayload = LearnMedia & {
  text: string;
};

export type LearnOpenPayload = LearnMedia & {
  question: string;
  explanation?: string;
};

export type LearnSlidePayload =
  | LearnSinglePayload
  | LearnMultiplePayload
  | LearnInfoPayload
  | LearnOpenPayload;

type LearnSlideBase = {
  id: string;
  active: boolean;
  created_at: string;
};

export type LearnSlide = LearnSlideBase &
  (
    | { type: "single"; payload: LearnSinglePayload }
    | { type: "multiple"; payload: LearnMultiplePayload }
    | { type: "info"; payload: LearnInfoPayload }
    | { type: "open"; payload: LearnOpenPayload }
  );

export type LearnChapter = {
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

export type LearnChapterWithSlides = LearnChapter & {
  slides: LearnSlide[];
};

export type LearnImage = {
  path: string;
  publicUrl: string;
  name: string;
};

export function learnChapterPath(slug: string) {
  return `/learn/${slug}`;
}

export function isLearnSlideType(value: string): value is LearnSlideType {
  return LEARN_SLIDE_TYPES.includes(value as LearnSlideType);
}
