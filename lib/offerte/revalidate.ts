import { revalidatePath, revalidateTag } from "next/cache";

export const OFFERTE_CACHE_TAG = "offerte";
export const OFFERTE_CACHE_REVALIDATE = 24 * 60 * 60;

export function revalidateOfferte() {
  revalidateTag(OFFERTE_CACHE_TAG, "max");
  revalidatePath("/");
  revalidatePath("/offer-stats");
  revalidatePath("/offer-compare");
  revalidatePath("/api/offerte/stats", "page");
}
