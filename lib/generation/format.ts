export function formatGw(mw: number) {
  const gw = mw / 1000;
  return gw >= 10 ? `${gw.toFixed(0)} GW` : `${gw.toFixed(1)} GW`;
}

export function formatGwh(mwh: number) {
  const gwh = mwh / 1000;
  if (gwh >= 1000) {
    const twh = gwh / 1000;
    return twh >= 10 ? `${twh.toFixed(0)} TWh` : `${twh.toFixed(1)} TWh`;
  }
  return gwh >= 100 ? `${gwh.toFixed(0)} GWh` : `${gwh.toFixed(1)} GWh`;
}

export function formatShare(share: number) {
  const pct = share * 100;
  return pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
}

export function formatAvgGwh(mwh: number) {
  const gwh = mwh / 1000;
  if (gwh > 0 && gwh < 0.05) return "<0,0 GWh";
  return formatGwh(mwh);
}

export function formatAvgShare(share: number) {
  const pct = share * 100;
  if (pct > 0 && pct < 0.05) return "<0,0%";
  return formatShare(share);
}
