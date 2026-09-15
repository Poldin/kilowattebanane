import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";

function previewBody(body: string, max = 500) {
  return body.length > max ? `${body.slice(0, max)}…` : body;
}

export async function withCronRoute(
  route: string,
  request: NextRequest,
  handler: () => Promise<Response>,
) {
  const started = Date.now();
  const path = request.nextUrl.pathname;
  const query = request.nextUrl.search;

  if (!authorizeCron(request)) {
    console.warn("[cron]", route, "unauthorized", { path, query });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron]", route, "start", {
    path,
    query: query || null,
    at: new Date().toISOString(),
  });

  try {
    const response = await handler();
    const body = await response.clone().text();
    console.log("[cron]", route, "done", {
      status: response.status,
      ms: Date.now() - started,
      preview: previewBody(body),
    });
    return response;
  } catch (error) {
    console.error("[cron]", route, "error", {
      ms: Date.now() - started,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
