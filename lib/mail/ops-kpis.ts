import { addCalendarDays, romeMidnightUtc } from "@/lib/entsoe";
import { romeToday } from "@/lib/day-ahead-query";
import { isCompleteDay } from "@/lib/insights";
import { MARKET_ZONES, MARKET_ZONE_IDS } from "@/lib/market-zones";
import { createSecretClient } from "@/lib/supabase/secret";
import type { ImportKind } from "@/lib/offerte/types";

const OFFERTE_KINDS: ImportKind[] = ["parametri_e", "placet_e", "ml_e"];

const KIND_LABEL: Record<ImportKind, string> = {
  geo: "geo",
  parametri_e: "parametri",
  placet_e: "PLACET",
  ml_e: "ML",
};

const MONTHS_IT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
];

export type OpsImportRun = {
  kind: ImportKind;
  label: string;
  snapshotDate: string;
  status: string;
  inserted: number;
  unchanged: number;
  delisted: number;
  relisted: number;
  error: string | null;
};

export type OpsCompleteness = {
  date: string;
  complete: number;
  total: number;
  missing: string[];
};

export type OpsKpiReport = {
  reportDate: string;
  subject: string;
  alerts: string[];
  subscribers: {
    active: number;
    newToday: number;
    unsubscribedToday: number;
  };
  digest: {
    deliveryDate: string;
    status: string | null;
    lastError: string | null;
    sent: number;
    failed: number;
    pending: number;
  };
  entsoToday: OpsCompleteness;
  entsoTomorrow: OpsCompleteness;
  offerte: {
    lastOkDate: string | null;
    staleDays: number;
    runs: OpsImportRun[];
  };
};

type ImportRunRow = {
  kind: string;
  snapshot_date: string;
  status: string;
  inserted: number | null;
  unchanged: number | null;
  delisted: number | null;
  relisted: number | null;
  error: string | null;
};

export function shortItDate(iso: string) {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS_IT[month - 1]}`;
}

function daysBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000,
  );
}

function asKind(value: string): ImportKind | null {
  return OFFERTE_KINDS.includes(value as ImportKind)
    ? (value as ImportKind)
    : null;
}

function completeness(
  date: string,
  rows: { zone: string; delivery_date: string; slot_count: number }[],
): OpsCompleteness {
  const byZone = new Map(
    rows
      .filter((row) => row.delivery_date === date)
      .map((row) => [row.zone, row.slot_count]),
  );
  const missing = MARKET_ZONE_IDS.filter(
    (zone) => !isCompleteDay(byZone.get(zone) ?? 0),
  ).map((zone) => MARKET_ZONES[zone].name);
  return {
    date,
    complete: MARKET_ZONE_IDS.length - missing.length,
    total: MARKET_ZONE_IDS.length,
    missing,
  };
}

export function formatOpsKpiText(report: OpsKpiReport) {
  const sign = (value: number) => (value > 0 ? `+${value}` : `${value}`);
  const digest =
    report.digest.status == null
      ? "assente"
      : [
          report.digest.status,
          report.digest.lastError,
          `${report.digest.sent}/${report.digest.sent + report.digest.failed + report.digest.pending} inviate`,
        ]
          .filter(Boolean)
          .join(" · ");

  const offerte = report.offerte.lastOkDate
    ? [
        report.offerte.staleDays > 0
          ? `ultimo ok ${shortItDate(report.offerte.lastOkDate)}`
          : "oggi",
        report.offerte.runs
          .map((run) => `${run.label} ${run.status}`)
          .join(", "),
        `${report.offerte.runs.reduce((sum, run) => sum + run.inserted, 0)} nuove / ${report.offerte.runs.reduce((sum, run) => sum + run.delisted, 0)} uscite`,
      ].join(" · ")
    : "nessun sync";

  const zoneLine = (row: OpsCompleteness) => {
    const base = `${row.complete}/${row.total} complete`;
    if (row.missing.length === 0) return base;
    if (row.missing.length === row.total) return `${base} (mancano tutte)`;
    return `${base} (${row.missing.join(", ")})`;
  };

  return [
    `ISCRITTI     ${report.subscribers.active} attivi  (${sign(report.subscribers.newToday)} / ${sign(-report.subscribers.unsubscribedToday)} oggi)`,
    `DIGEST ${shortItDate(report.digest.deliveryDate).padEnd(5)} ${digest}`,
    `ENTSO oggi   ${zoneLine(report.entsoToday)}`,
    `ENTSO ${shortItDate(report.entsoTomorrow.date).padEnd(6)} ${zoneLine(report.entsoTomorrow)}`,
    `OFFERTE      ${offerte}`,
  ].join("\n");
}

export async function loadOpsKpiReport(): Promise<OpsKpiReport> {
  const supabase = createSecretClient();
  const today = romeToday();
  const tomorrow = addCalendarDays(today, 1);
  const start = romeMidnightUtc(today).toISOString();
  const end = romeMidnightUtc(tomorrow).toISOString();

  const [
    activeRes,
    newRes,
    unsubRes,
    digestRes,
    deliveriesRes,
    statsRes,
    importRes,
  ] = await Promise.all([
    supabase
      .from("subscribers")
      .select("id", { count: "exact", head: true })
      .is("unsubscribed_at", null),
    supabase
      .from("subscribers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("subscribers")
      .select("id", { count: "exact", head: true })
      .gte("unsubscribed_at", start)
      .lt("unsubscribed_at", end),
    supabase
      .from("digest_runs")
      .select("delivery_date, status, last_error")
      .eq("delivery_date", tomorrow)
      .maybeSingle(),
    supabase
      .from("digest_deliveries")
      .select("status")
      .eq("delivery_date", tomorrow),
    supabase
      .from("day_ahead_day_stats")
      .select("zone, delivery_date, slot_count")
      .in("delivery_date", [today, tomorrow]),
    supabase
      .from("po_import_runs")
      .select(
        "kind, snapshot_date, status, inserted, unchanged, delisted, relisted, error, started_at",
      )
      .order("started_at", { ascending: false })
      .limit(40),
  ]);

  for (const result of [
    activeRes,
    newRes,
    unsubRes,
    digestRes,
    deliveriesRes,
    statsRes,
    importRes,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const active = activeRes.count ?? 0;
  const sent = (deliveriesRes.data ?? []).filter((row) => row.status === "sent").length;
  const failed = (deliveriesRes.data ?? []).filter((row) => row.status === "failed").length;
  const pending = Math.max(0, active - sent - failed);

  const latestByKind = new Map<ImportKind, OpsImportRun>();
  const lastOkByKind = new Map<ImportKind, string>();
  for (const row of (importRes.data ?? []) as ImportRunRow[]) {
    const kind = asKind(row.kind);
    if (!kind) continue;
    if (!latestByKind.has(kind)) {
      latestByKind.set(kind, {
        kind,
        label: KIND_LABEL[kind],
        snapshotDate: row.snapshot_date,
        status: row.status,
        inserted: row.inserted ?? 0,
        unchanged: row.unchanged ?? 0,
        delisted: row.delisted ?? 0,
        relisted: row.relisted ?? 0,
        error: row.error,
      });
    }
    if (row.status === "ok" && !lastOkByKind.has(kind)) {
      lastOkByKind.set(kind, row.snapshot_date);
    }
  }
  const runs = OFFERTE_KINDS.map((kind) => latestByKind.get(kind)).filter(
    (row): row is OpsImportRun => row != null,
  );

  const lastOkDates = ["placet_e", "ml_e"]
    .map((kind) => lastOkByKind.get(kind as ImportKind))
    .filter((value): value is string => value != null);
  const lastOkDate =
    lastOkDates.length === 2 ? lastOkDates.reduce((a, b) => (a < b ? a : b)) : null;

  const staleDays = lastOkDate ? Math.max(0, daysBetween(lastOkDate, today)) : 99;
  const digestStatus = digestRes.data?.status ?? null;
  const digestError = digestRes.data?.last_error ?? null;
  const entsoToday = completeness(today, statsRes.data ?? []);
  const entsoTomorrow = completeness(tomorrow, statsRes.data ?? []);

  const alerts: string[] = [];
  if (digestStatus !== "sent") {
    alerts.push(digestStatus === "failed" ? "digest failed" : "digest assente");
  }
  if (staleDays > 0) {
    alerts.push(
      lastOkDate ? `offerte ferme da ${staleDays}g` : "offerte mai sincronizzate",
    );
  }
  if (entsoTomorrow.complete < entsoTomorrow.total) {
    alerts.push(`entso ${shortItDate(tomorrow)} incompleto`);
  }
  if (entsoToday.complete < entsoToday.total) {
    alerts.push("entso oggi incompleto");
  }

  const subject = `KPI ${shortItDate(today)} · ${alerts.length > 0 ? alerts.join(" · ") : "ok"}`;

  return {
    reportDate: today,
    subject,
    alerts,
    subscribers: {
      active,
      newToday: newRes.count ?? 0,
      unsubscribedToday: unsubRes.count ?? 0,
    },
    digest: {
      deliveryDate: tomorrow,
      status: digestStatus,
      lastError: digestError,
      sent,
      failed,
      pending,
    },
    entsoToday,
    entsoTomorrow,
    offerte: { lastOkDate, staleDays, runs },
  };
}
