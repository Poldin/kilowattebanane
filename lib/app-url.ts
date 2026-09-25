export function publicSiteUrl() {
  const raw =
    process.env.base_url_production ||
    process.env.APP_BASE_URL ||
    process.env.base_url ||
    "https://kilowattebanane.it";
  return raw.replace(/\/$/, "");
}

export function unsubscribeApiUrl(token: string) {
  return `${publicSiteUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function unsubscribePageUrl(token: string) {
  return `${publicSiteUrl()}/disiscriviti?token=${encodeURIComponent(token)}`;
}

export function resendFrom() {
  return process.env.RESEND_FROM ?? "Paolo <onboarding@resend.dev>";
}

export function opsAlertEmail() {
  return process.env.OPS_ALERT_EMAIL?.trim() || "oloapiccoli@gmail.com";
}

export function mailChartUrl(zone: string, date: string, tariff?: string) {
  const url = new URL("/api/mail/chart", publicSiteUrl());
  url.searchParams.set("zona", zone);
  url.searchParams.set("giorno", date);
  if (tariff) url.searchParams.set("piano", tariff);
  return url.toString();
}

export function mailOutlookChartUrl(zone: string, date: string, tariff?: string) {
  const url = new URL("/api/mail/outlook-chart", publicSiteUrl());
  url.searchParams.set("zona", zone);
  url.searchParams.set("giorno", date);
  if (tariff) url.searchParams.set("piano", tariff);
  return url.toString();
}

export function mailMixChartUrl(date: string) {
  const url = new URL("/api/mail/mix-chart", publicSiteUrl());
  url.searchParams.set("giorno", date);
  return url.toString();
}

export function mailLearnUrl() {
  return `${publicSiteUrl()}/learn`;
}

export function mailOfferCompareUrl() {
  return `${publicSiteUrl()}/offer-compare`;
}

export function mailOfferStatsUrl() {
  return `${publicSiteUrl()}/offer-stats`;
}

export function mailShareUrl() {
  const url = new URL("/", publicSiteUrl());
  url.searchParams.set("utm_source", "mail");
  url.searchParams.set("utm_medium", "share");
  return url.toString();
}
