import type { Metadata } from "next";
import { CampaignCard } from "@/components/crowd/CampaignCard";
import { publicSiteUrl } from "@/lib/app-url";
import { listCampaigns } from "@/lib/crowd/campaigns";

export const metadata: Metadata = {
  title: "Campagne in corso",
  description:
    "Finanzia un impianto fotovoltaico. Chi mette di più resta in evidenza sulla pagina della campagna.",
  alternates: { canonical: `${publicSiteUrl()}/campagne` },
};

export default function CampagnePage() {
  const campaigns = listCampaigns();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-12">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Campagne in corso</h1>
      <div className="mt-8 flex flex-col gap-6">
        {campaigns.map((campaign) => (
          <CampaignCard key={campaign.slug} campaign={campaign} />
        ))}
      </div>
    </main>
  );
}
