import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateGeneration() {
  revalidateTag("generation", "max");
  revalidatePath("/");
  revalidatePath("/api/generation");
  revalidatePath("/api/mail/mix-chart");
}
