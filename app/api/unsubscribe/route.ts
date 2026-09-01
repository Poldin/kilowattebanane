import { NextRequest } from "next/server";
import { unsubscribeByToken } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tokenFrom(request: NextRequest) {
  return request.nextUrl.searchParams.get("token")?.trim() ?? "";
}

export async function POST(request: NextRequest) {
  const token = tokenFrom(request);
  if (!TOKEN_RE.test(token)) {
    return new Response(null, { status: 200 });
  }

  try {
    await unsubscribeByToken(token);
  } catch {
    // One-click: always 200/202, no body.
  }

  return new Response(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const token = tokenFrom(request);
  const site = new URL("/disiscriviti", request.nextUrl.origin);

  if (!TOKEN_RE.test(token)) {
    site.searchParams.set("stato", "link-non-valido");
    return Response.redirect(site, 303);
  }

  try {
    const result = await unsubscribeByToken(token);
    site.searchParams.set(
      "stato",
      result.ok ? (result.already ? "gia-annullata" : "ok") : "link-non-valido",
    );
  } catch {
    site.searchParams.set("stato", "errore");
  }

  return Response.redirect(site, 303);
}
