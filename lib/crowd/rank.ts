import type { CrowdDonor, RankedDonor } from "@/lib/crowd/types";

export const MIN_GIFT_EURO = 10;

export function raisedEuro(donors: CrowdDonor[]) {
  return donors.reduce((sum, donor) => sum + donor.amountEuro, 0);
}

export function mergePreview(
  donors: CrowdDonor[],
  preview: { name: string; amountEuro: number } | null,
): RankedDonor[] {
  const rows: Array<CrowdDonor & { preview: boolean }> = donors.map((donor) => ({
    ...donor,
    preview: false,
  }));

  const name = preview?.name.trim() ?? "";
  if (preview && name && preview.amountEuro > 0) {
    rows.push({
      id: "preview",
      name,
      subtitle: "Anteprima · non ancora versato",
      amountEuro: preview.amountEuro,
      preview: true,
    });
  }

  rows.sort(
    (a, b) => b.amountEuro - a.amountEuro || a.name.localeCompare(b.name, "it"),
  );

  const total = rows.reduce((sum, row) => sum + row.amountEuro, 0);

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    share: total > 0 ? row.amountEuro / total : 0,
  }));
}
