import { revalidatePath } from "next/cache";

export function revalidatePriceArchive() {
  revalidatePath("/prezzi");
  revalidatePath("/prezzi/[giorno]", "page");
  revalidatePath("/prezzi/[giorno]/dati");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
}
