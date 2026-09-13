import { render } from "react-email";
import { Resend } from "resend";
import { OpsKpiEmail } from "@/emails/ops-kpi";
import { opsAlertEmail, resendFrom } from "@/lib/app-url";
import { formatOpsKpiText, loadOpsKpiReport } from "@/lib/mail/ops-kpis";
import { createSecretClient } from "@/lib/supabase/secret";

type OpsRunRow = {
  status: string;
  started_at: string | null;
};

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  return new Resend(apiKey);
}

function isInProgress(run: OpsRunRow | null) {
  if (!run || run.status !== "sending" || !run.started_at) return false;
  return Date.now() - new Date(run.started_at).getTime() < 10 * 60 * 1000;
}

export async function sendOpsKpiEmail(options: { force?: boolean } = {}) {
  const supabase = createSecretClient();
  const report = await loadOpsKpiReport();

  const { data: existing, error: loadError } = await supabase
    .from("ops_kpi_runs")
    .select("status, started_at")
    .eq("report_date", report.reportDate)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);

  const run = existing as OpsRunRow | null;
  if (!options.force && run?.status === "sent") {
    return { skipped: true as const, reason: "already-sent" as const, report };
  }
  if (!options.force && isInProgress(run)) {
    return { skipped: true as const, reason: "in-progress" as const, report };
  }

  const { error: claimError } = await supabase.from("ops_kpi_runs").upsert({
    report_date: report.reportDate,
    status: "sending",
    subject: report.subject,
    started_at: new Date().toISOString(),
    last_error: null,
  });
  if (claimError) throw new Error(claimError.message);

  try {
    const html = await render(OpsKpiEmail({ report }));
    const text = formatOpsKpiText(report);
    const { error } = await getResend().emails.send({
      from: resendFrom(),
      to: opsAlertEmail(),
      subject: report.subject,
      html,
      text,
    });
    if (error) throw new Error(error.message);

    await supabase
      .from("ops_kpi_runs")
      .update({
        status: "sent",
        finished_at: new Date().toISOString(),
        subject: report.subject,
        last_error: null,
      })
      .eq("report_date", report.reportDate);

    return { skipped: false as const, report };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ops KPI mail failed";
    await supabase
      .from("ops_kpi_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        last_error: message,
      })
      .eq("report_date", report.reportDate);
    throw error;
  }
}
