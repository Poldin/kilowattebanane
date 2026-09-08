import { createSecretClient } from "@/lib/supabase/secret";
import { zoneForRegion, type ItalianRegion, type MarketZoneId } from "@/lib/market-zones";
import type { TariffPlanId } from "@/lib/fasce";
import { resolveMailTariff } from "@/lib/tariff-pref";

export type Subscriber = {
  id: string;
  email: string;
  region: ItalianRegion;
  zone: MarketZoneId;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  contract_type: string | null;
  tariff: TariffPlanId;
};

const SUBSCRIBER_COLUMNS =
  "id, email, region, zone, unsubscribe_token, unsubscribed_at, contract_type";

function asSubscriber(row: {
  id: string;
  email: string;
  region: string;
  zone: string;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  contract_type: string | null;
}): Subscriber {
  return {
    id: row.id,
    email: row.email,
    region: row.region as ItalianRegion,
    zone: row.zone as MarketZoneId,
    unsubscribe_token: row.unsubscribe_token,
    unsubscribed_at: row.unsubscribed_at,
    contract_type: row.contract_type,
    tariff: resolveMailTariff(row.contract_type),
  };
}

export async function upsertSubscriber(
  email: string,
  region: ItalianRegion,
  contractType?: string | null,
) {
  const zone = zoneForRegion(region);
  if (!zone) throw new Error("Unknown region");

  const supabase = createSecretClient();
  const normalized = email.trim().toLowerCase();
  const contract_type = resolveMailTariff(contractType);
  const now = new Date().toISOString();

  const { data: existing, error: lookupError } = await supabase
    .from("subscribers")
    .select(SUBSCRIBER_COLUMNS)
    .eq("email", normalized)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  if (existing && !existing.unsubscribed_at) {
    if (
      existing.region !== region ||
      existing.zone !== zone ||
      existing.contract_type !== contract_type
    ) {
      const { data, error } = await supabase
        .from("subscribers")
        .update({ region, zone, contract_type, updated_at: now })
        .eq("id", existing.id)
        .select(SUBSCRIBER_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return { subscriber: asSubscriber(data), created: false, reactivated: false };
    }
    return { subscriber: asSubscriber(existing), created: false, reactivated: false };
  }

  if (existing) {
    const { data, error } = await supabase
      .from("subscribers")
      .update({
        region,
        zone,
        contract_type,
        unsubscribed_at: null,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select(SUBSCRIBER_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return { subscriber: asSubscriber(data), created: false, reactivated: true };
  }

  const { data, error } = await supabase
    .from("subscribers")
    .insert({ email: normalized, region, zone, contract_type })
    .select(SUBSCRIBER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return { subscriber: asSubscriber(data), created: true, reactivated: false };
}

export async function unsubscribeByToken(token: string) {
  const supabase = createSecretClient();
  const { data: existing, error: lookupError } = await supabase
    .from("subscribers")
    .select("id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (!existing) return { ok: false as const, reason: "not-found" as const };
  if (existing.unsubscribed_at) return { ok: true as const, already: true };

  const { error } = await supabase
    .from("subscribers")
    .update({
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) throw new Error(error.message);
  return { ok: true as const, already: false };
}

export async function listActiveSubscribers() {
  const supabase = createSecretClient();
  const rows: Subscriber[] = [];
  let from = 0;
  const page = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("subscribers")
      .select(SUBSCRIBER_COLUMNS)
      .is("unsubscribed_at", null)
      .order("id", { ascending: true })
      .range(from, from + page - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data.map(asSubscriber));
    if (data.length < page) break;
    from += page;
  }

  return rows;
}

export async function sentSubscriberIds(deliveryDate: string) {
  const supabase = createSecretClient();
  const ids = new Set<string>();
  let from = 0;
  const page = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("digest_deliveries")
      .select("subscriber_id")
      .eq("delivery_date", deliveryDate)
      .eq("status", "sent")
      .range(from, from + page - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) ids.add(row.subscriber_id as string);
    if (data.length < page) break;
    from += page;
  }

  return ids;
}
