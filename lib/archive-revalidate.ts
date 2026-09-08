import { revalidatePath, revalidateTag } from "next/cache";

export function revalidatePriceArchive() {
  revalidateTag("prices", "max");
  revalidatePath("/");
  revalidatePath("/api/zone/[zone]", "page");
  revalidatePath("/api/zone/[zone]/slots", "page");
  revalidatePath("/prezzi");
  revalidatePath("/prezzi/[giorno]", "page");
  revalidatePath("/prezzi/[giorno]/dati", "page");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
}
