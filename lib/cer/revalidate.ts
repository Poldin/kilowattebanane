import { revalidatePath, revalidateTag } from "next/cache";

export const CER_CACHE_TAG = "cer";
export const CER_CACHE_REVALIDATE = 7 * 24 * 60 * 60;

export function revalidateCer() {
  revalidateTag(CER_CACHE_TAG, "max");
  revalidatePath("/cer-stats");
}
