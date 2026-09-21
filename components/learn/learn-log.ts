const SESSION_KEY = "learn_session";

export function learnSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export async function startLearnEvent(input: {
  slideId: string;
  chapterId: string;
  interactions?: Record<string, unknown>;
}) {
  try {
    const response = await fetch("/api/learn/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: learnSessionId(),
        slideId: input.slideId,
        chapterId: input.chapterId,
        interactions: input.interactions ?? { shown: true },
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { id?: string };
    return payload.id ?? null;
  } catch {
    return null;
  }
}

export async function patchLearnEvent(
  id: string,
  interactions: Record<string, unknown>,
) {
  try {
    await fetch(`/api/learn/events/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interactions }),
    });
  } catch {
    // logging is best-effort
  }
}
