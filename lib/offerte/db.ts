import { createAdminClient } from "@/lib/supabase/admin";

export function offerteReadClient() {
  return createAdminClient();
}

export async function paginateSelect<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const page = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}
