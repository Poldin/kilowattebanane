import { createAdminClient } from "@/lib/supabase/admin";

const TRANSIENT_READ = /gateway timeout|timed out|timeout|bad gateway|service unavailable|502|503|504|fetch failed|econnreset|etimedout|network/i;
const READ_ATTEMPTS = 3;

export function offerteReadClient() {
  return createAdminClient();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const chunk = await readPage(() => build(from, from + page - 1));
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}

async function readPage<T>(
  build: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  for (let attempt = 0; attempt < READ_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await build();
      if (error) throw new Error(error.message);
      return data ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === READ_ATTEMPTS - 1 || !TRANSIENT_READ.test(message)) {
        throw error instanceof Error ? error : new Error(message);
      }
      await sleep(700 * 2 ** attempt);
    }
  }
  throw new Error("Gateway Timeout");
}
