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
