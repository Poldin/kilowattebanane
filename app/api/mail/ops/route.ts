import { NextRequest } from "next/server";
import { withCronRoute } from "@/lib/cron-route";
import { sendOpsKpiEmail } from "@/lib/mail/ops";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  return withCronRoute("mail/ops", request, async () => {
    const force = request.nextUrl.searchParams.get("force") === "1";

    try {
      const summary = await sendOpsKpiEmail({ force });
      return Response.json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ops KPI mail failed";
      return Response.json({ error: message }, { status: 500 });
    }
  });
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}
