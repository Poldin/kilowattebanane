import type { CerNamesAnalysis } from "@/lib/cer/public-types";

export function CerNamesExplorer({ analysis }: { analysis: CerNamesAnalysis }) {
  const maxConfigs = analysis.topRipetuti[0]?.configurazioni ?? 1;
  const pctUnici =
    analysis.totaleConfigurazioni > 0
      ? (analysis.configurazioniNomiUnici / analysis.totaleConfigurazioni) * 100
      : 0;
  const pctRipetuti =
    analysis.totaleConfigurazioni > 0
      ? (analysis.configurazioniNomiRipetuti / analysis.totaleConfigurazioni) * 100
      : 0;

  return (
    <section className="mt-14 sm:mt-16" aria-labelledby="cer-nomi">
      <h2 id="cer-nomi" className="text-xl font-semibold tracking-tight sm:text-2xl">
        Nomi e reti
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Ogni CER registrata ha un codice TIAD e una cabina primaria. Molti operatori però
        riusano lo stesso nome su decine di comunità locali — ecco come si distribuiscono.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="CER registrate"
          value={formatIt(analysis.totaleConfigurazioni)}
          accent
        />
        <StatTile label="Nomi distinti" value={formatIt(analysis.nomiDistinti)} />
        <StatTile
          label="Media per nome ripetuto"
          value={
            analysis.mediaConfigurazioniPerNomeRipetuto != null
              ? formatItNum(analysis.mediaConfigurazioniPerNomeRipetuto)
              : "—"
          }
          hint={
            analysis.nomiRipetuti > 0
              ? `${formatIt(analysis.nomiRipetuti)} nomi compaiono più volte`
              : undefined
          }
        />
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <SplitLegend
            label="Nome compare una volta"
            count={analysis.nomiUnaVolta}
            configs={analysis.configurazioniNomiUnici}
            pct={pctUnici}
          />
          <SplitLegend
            label="Nome ripetuto"
            count={analysis.nomiRipetuti}
            configs={analysis.configurazioniNomiRipetuti}
            pct={pctRipetuti}
            align="end"
          />
        </div>
        <div
          className="mt-2 flex h-6 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900"
          aria-hidden
        >
          {pctUnici > 0 ? (
            <div
              className="bg-neutral-300 dark:bg-neutral-700"
              style={{ width: `${pctUnici}%` }}
            />
          ) : null}
          {pctRipetuti > 0 ? (
            <div
              className="bg-[#F5D547]"
              style={{ width: `${pctRipetuti}%` }}
            />
          ) : null}
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          La barra mostra le{" "}
          <strong className="font-medium text-foreground">configurazioni</strong>, non i nomi: i
          nomi ripetuti pesano molto di più.
        </p>
      </div>

      {analysis.topRipetuti.length > 0 ? (
        <div className="mt-10">
          <h3 className="text-sm font-medium uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
            Top 10 nomi più diffusi
          </h3>
          <ol className="mt-4 flex flex-col gap-3">
            {analysis.topRipetuti.map((group, index) => {
              const width =
                maxConfigs > 0 ? (group.configurazioni / maxConfigs) * 100 : 0;
              return (
                <li key={group.denominazione}>
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-5 shrink-0 tabular-nums text-xs font-medium text-neutral-400 dark:text-neutral-500"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="min-w-0 text-sm font-medium leading-snug text-foreground">
                          {group.denominazione}
                        </p>
                        <p className="shrink-0 tabular-nums text-sm text-neutral-600 dark:text-neutral-400">
                          <span className="font-semibold text-foreground">
                            {formatIt(group.configurazioni)}
                          </span>
                          {" CER"}
                        </p>
                      </div>
                      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-neutral-900 dark:bg-neutral-100"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                        {formatIt(group.cabinePrimarie)} cabine
                        {group.comuni > 0 ? ` · ${formatIt(group.comuni)} comuni` : null}
                        {group.potenzaKwTotale != null
                          ? ` · ${formatPower(group.potenzaKwTotale)}`
                          : null}
                        {group.utenzeTotale != null
                          ? ` · ${formatIt(group.utenzeTotale)} utenze`
                          : null}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        accent
          ? "border-[#F5D547]/40 bg-[#F5D547]/10"
          : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${
          accent ? "text-[#111111] dark:text-[#F5D547]" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
      ) : null}
    </div>
  );
}

function SplitLegend({
  label,
  count,
  configs,
  pct,
  align = "start",
}: {
  label: string;
  count: number;
  configs: number;
  pct: number;
  align?: "start" | "end";
}) {
  return (
    <div className={align === "end" ? "text-right" : ""}>
      <p className="text-sm text-foreground">{label}</p>
      <p className="mt-0.5 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
        {formatIt(count)} nomi · {formatIt(configs)} CER · {formatPct(pct)}
      </p>
    </div>
  );
}

function formatPower(kw: number) {
  if (kw >= 1000) {
    const mw = kw / 1000;
    return `${mw >= 10 ? formatIt(Math.round(mw)) : formatItNum(mw)} MW`;
  }
  return `${formatItNum(kw)} kW`;
}

function formatIt(value: number) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.round(Math.abs(value));
  return sign + String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatItNum(value: number) {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return formatIt(rounded);
  const [int, dec] = rounded.toFixed(1).split(".");
  return `${formatIt(Number(int))},${dec}`;
}

function formatPct(value: number) {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(rounded)}%`;
}
