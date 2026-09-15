import { NextRequest, NextResponse } from "next/server";
import { adminAuthConfigured, adminTokenFromRequest } from "@/lib/offerte/admin-auth";
import { loadOfferteImportStatus } from "@/lib/offerte/admin-status";
import { openDataFileLabel } from "@/lib/offerte/source";
import { romeToday } from "@/lib/offerte/dates";
import { PORTALE_OFFERTE_URL } from "@/lib/offerte/public-types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!adminAuthConfigured()) {
    return NextResponse.json({ error: "Upload non configurato." }, { status: 503 });
  }
  if (!adminTokenFromRequest(request)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  const today = romeToday();
  const status = await loadOfferteImportStatus();

  return NextResponse.json({
    ...status,
    portaleUrl: PORTALE_OFFERTE_URL,
    files: [
      {
        kind: "placet_e",
        label: "PLACET",
        filename: openDataFileLabel("placet_e", today),
        downloadUrl: `/api/admin/offerte/download?kind=placet_e`,
      },
      {
        kind: "ml_e",
        label: "Mercato libero",
        filename: openDataFileLabel("ml_e", today),
        downloadUrl: `/api/admin/offerte/download?kind=ml_e`,
      },
      {
        kind: "parametri_e",
        label: "Parametri",
        filename: openDataFileLabel("parametri_e", today),
        downloadUrl: `/api/admin/offerte/download?kind=parametri_e`,
      },
    ],
  });
}
