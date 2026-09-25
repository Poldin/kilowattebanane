export function formatGw(mw: number) {
  const gw = mw / 1000;
  return gw >= 10 ? `${gw.toFixed(0)} GW` : `${gw.toFixed(1)} GW`;
}

export function formatGwh(mwh: number) {
  const gwh = mwh / 1000;
  return gwh >= 100 ? `${gwh.toFixed(0)} GWh` : `${gwh.toFixed(1)} GWh`;
}

export function formatShare(share: number) {
  const pct = share * 100;
  return pct >= 10 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
}
