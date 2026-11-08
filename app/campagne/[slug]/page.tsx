import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DonorStage } from "@/components/crowd/DonorStage";
import { publicSiteUrl } from "@/lib/app-url";
import { campaignPath, campaignRaised, getCampaign, listCampaigns } from "@/lib/crowd/campaigns";

export function generateStaticParams() {
  return listCampaigns().map((campaign) => ({ slug: campaign.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/campagne/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const campaign = getCampaign(slug);
  if (!campaign) return { title: "Campagna non trovata" };

  return {
    title: campaign.title,
    description: campaign.summary,
    alternates: { canonical: `${publicSiteUrl()}${campaignPath(campaign.slug)}` },
  };
}

export default async function CampagnaPage({ params }: PageProps<"/campagne/[slug]">) {
  const { slug } = await params;
  const campaign = getCampaign(slug);
  if (!campaign) notFound();

  const raised = campaignRaised(campaign);
  const url = `${publicSiteUrl()}${campaignPath(campaign.slug)}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-10 sm:px-6 sm:pt-12">
      <DonorStage
        title={campaign.title}
        place={campaign.place}
        kwp={campaign.kwp}
        story={campaign.story}
        raised={raised}
        goal={campaign.goalEuro}
        donors={campaign.donors}
        shareUrl={url}
        shareTitle={campaign.title}
        shareText={campaign.summary}
      />
    </main>
  );
}
