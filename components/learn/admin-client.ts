import { OFFERTE_ADMIN_TOKEN_KEY } from "@/lib/offerte/admin-constants";

export function adminHeaders(): HeadersInit {
  const token = localStorage.getItem(OFFERTE_ADMIN_TOKEN_KEY);
  if (!token) return {};
  return { "x-offerte-admin-token": token };
}

export async function adminJson<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...adminHeaders(),
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Richiesta fallita.");
  }
  return payload;
}
