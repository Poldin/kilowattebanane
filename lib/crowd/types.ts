export type CrowdDonor = {
  id: string;
  name: string;
  subtitle: string;
  amountEuro: number;
};

export type CrowdCampaign = {
  slug: string;
  title: string;
  place: string;
  technology: "fotovoltaico";
  kwp: number;
  goalEuro: number;
  kwhYear: number;
  closesOn: string;
  summary: string;
  story: string;
  donors: CrowdDonor[];
};

export type RankedDonor = CrowdDonor & {
  preview: boolean;
  rank: number;
  share: number;
};
