import {
  fasciaAveragesFromQuarters,
  fasciaBadgeLabel,
  fasciaCheapPeak,
  fasciaStatForPlanHour,
  fasciaStatsForCheapPeak,
  fasciaTipLabel,
  tariffDayOccasion,
  type FasciaAverages,
  type FasciaStatId,
  type TariffPlanId,
} from "@/lib/fasce";
import { computeRecommendations } from "@/lib/insights";

export type TariffTips = {
  bestTip: string;
  worstTip: string;
};

export type TariffTipTone = "cheap" | "peak" | "mid";

export type TariffNowAdvice = {
  before: string;
  mark: string;
  after: string;
  tone: TariffTipTone;
  fruit: "🍌" | "🐵" | null;
  fasciaId: FasciaStatId | null;
};

function planPhrase(tariff: "fasce" | "bioraria" | "monoraria") {
  if (tariff === "fasce") return "la tariffa a fasce";
  if (tariff === "bioraria") return "la bioraria";
  return "la monoraria";
}

function nowMomentAdvice(percentile: number): TariffNowAdvice {
  if (percentile >= 0.95) {
    return {
      before: "tra i ",
      mark: "5% più cari",
      after: ": se puoi, non consumare",
      tone: "peak",
      fruit: "🐵",
      fasciaId: null,
    };
  }
  if (percentile >= 0.9) {
    return {
      before: "tra i ",
      mark: "10% più cari",
      after: ": meglio evitare i consumi",
      tone: "peak",
      fruit: "🐵",
      fasciaId: null,
    };
  }
  if (percentile >= 0.65) {
    return {
      before: "",
      mark: "non è il momento più idilliaco",
      after: " per consumare",
      tone: "peak",
      fruit: "🐵",
      fasciaId: null,
    };
  }
  if (percentile >= 0.35) {
    return {
      before: "prezzi nella media, ",
      mark: "il medione",
      after: "",
      tone: "mid",
      fruit: percentile < 0.5 ? "🍌" : "🐵",
      fasciaId: null,
    };
  }
  if (percentile >= 0.1) {
    return {
      before: "",
      mark: "momento discreto",
      after: " per consumare",
      tone: "cheap",
      fruit: "🍌",
      fasciaId: null,
    };
  }
  if (percentile >= 0.05) {
    return {
      before: "tra i ",
      mark: "10% più convenienti",
      after: ": buon momento",
      tone: "cheap",
      fruit: "🍌",
      fasciaId: null,
    };
  }
  return {
    before: "tra i ",
    mark: "5% più convenienti",
    after: ": se puoi, consuma ora",
    tone: "cheap",
    fruit: "🍌",
    fasciaId: null,
  };
}

function fasciaNowAdvice(
  fasciaId: FasciaStatId,
  cheap: FasciaStatId | null,
  peak: FasciaStatId | null,
  tariff: "fasce" | "bioraria" | "monoraria",
): TariffNowAdvice {
  if (tariff === "monoraria") {
    return {
      before: ": con ",
      mark: "la monoraria l'ora non cambia la bolletta",
      after: "",
      tone: "mid",
      fruit: null,
      fasciaId,
    };
  }

  if (!peak) {
    return {
      before: ": oggi è ",
      mark: "tutta questa fascia",
      after: `, con ${planPhrase(tariff)} spostare i consumi non cambia la bolletta`,
      tone: "mid",
      fruit: null,
      fasciaId,
    };
  }

  if (fasciaId === cheap) {
    return {
      before: ": oggi è ",
      mark: "la più conveniente",
      after: ", se puoi consuma",
      tone: "cheap",
      fruit: "🍌",
      fasciaId,
    };
  }

  if (fasciaId === peak) {
    return {
      before: ": oggi è ",
      mark: "la più cara",
      after: ", meglio non consumare",
      tone: "peak",
      fruit: "🐵",
      fasciaId,
    };
  }

  return {
    before: ": oggi ",
    mark: "non è la più conveniente",
    after: "",
    tone: "mid",
    fruit: null,
    fasciaId,
  };
}

export function computeTariffTips(
  prices: number[],
  ymd: string,
  tariff: TariffPlanId,
): TariffTips {
  if (tariff === "dinamica") {
    const rec = computeRecommendations(prices);
    return { bestTip: rec.bestTip, worstTip: rec.worstTip };
  }

  if (tariff === "monoraria") {
    return {
      bestTip:
        "Con la monoraria il prezzo in bolletta è lo stesso 0–24: conta quanto usi, non quando.",
      worstTip: "",
    };
  }

  const avgs = fasciaAveragesFromQuarters(ymd, prices);
  const ids = fasciaStatsForCheapPeak(tariff);
  const { cheap, peak } = fasciaCheapPeak(avgs, ids);
  const phrase = planPhrase(tariff);

  if (!cheap || !peak) {
    const only = ids.find((id) => avgs[id] != null) ?? cheap;
    const fasciaBit = only
      ? `tutta ${fasciaTipLabel(ymd, only)}`
      : "una sola fascia";
    const occasion = tariffDayOccasion(ymd);
    const when = occasion ? `Oggi è ${occasion}: ` : "Oggi è ";
    return {
      bestTip: `${when}${fasciaBit}. Con ${phrase} spostare i consumi non cambia la bolletta.`,
      worstTip: "",
    };
  }

  return {
    bestTip: `🍌 Top risparmio in ${fasciaTipLabel(ymd, cheap)}`,
    worstTip: `🐵 Evita consumi in ${fasciaTipLabel(ymd, peak)}`,
  };
}

export function tariffNowAdvice(
  ymd: string,
  hour: number,
  tariff: TariffPlanId,
  percentile: number,
  avgs: FasciaAverages,
): TariffNowAdvice {
  if (tariff === "dinamica") return nowMomentAdvice(percentile);

  const stat = fasciaStatForPlanHour(ymd, hour, tariff);
  if (!stat) return nowMomentAdvice(percentile);

  if (tariff === "monoraria") {
    return fasciaNowAdvice(stat, null, null, "monoraria");
  }

  const { cheap, peak } = fasciaCheapPeak(avgs, fasciaStatsForCheapPeak(tariff));
  return fasciaNowAdvice(stat, cheap, peak, tariff);
}

export function fasciaNowBadgeLabel(id: FasciaStatId) {
  return fasciaBadgeLabel(id);
}
