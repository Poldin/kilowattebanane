import { revalidatePath } from "next/cache";

export function revalidateLearn(slug?: string) {
  revalidatePath("/learn");
  revalidatePath("/learn/[chapterid]", "page");
  if (slug) revalidatePath(`/learn/${slug}`);
  revalidatePath("/sitemap.xml");
}
