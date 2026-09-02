import { revalidatePath, revalidateTag } from "next/cache";

export function revalidatePriceArchive() {
  revalidateTag("prices", "max");
  revalidatePath("/");
  revalidatePath("/api/zone/[zone]");
  revalidatePath("/api/zone/[zone]/slots");
  revalidatePath("/prezzi");
  revalidatePath("/prezzi/[giorno]", "page");
  revalidatePath("/prezzi/[giorno]/dati");
  revalidatePath("/sitemap.xml");
  revalidatePath("/llms.txt");
}
