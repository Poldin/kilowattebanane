import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateGeneration() {
  revalidateTag("generation", "max");
  revalidatePath("/");
  revalidatePath("/api/generation");
}
