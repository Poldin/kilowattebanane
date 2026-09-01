import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DayArchiveView } from "@/components/DayArchiveView";
import { JsonLd } from "@/components/JsonLd";
import {
  archiveDayJsonUrl,
  archiveDayUrl,
  archiveJsonLd,
  listArchiveDates,
  loadArchiveDay,
} from "@/lib/day-archive";
import { formatEurocent } from "@/lib/insights";
import { dateFromParam } from "@/lib/market-zones";

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const dates = await listArchiveDates();
    return dates.map((giorno) => ({ giorno }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/prezzi/[giorno]">): Promise<Metadata> {
  const { giorno } = await params;
  const day = await loadArchiveDay(giorno);
  if (!day) {
    return { title: "Giornata non trovata" };
  }

  const title = `Quando consumare energia il ${day.dateLabel}`;
  const description =
    `🍌 ${day.italy.cheapestZoneName} ${day.italy.cheapestHours || ""} a ${formatEurocent(day.italy.min)} c€/kWh. ` +
    `🐵 ${day.italy.priciestZoneName} ${day.italy.priciestHours || ""} a ${formatEurocent(day.italy.max)} c€/kWh. ` +
    `Prezzi all'ingrosso ENTSO-E, non bolletta.`;

  return {
    title,
    description,
    alternates: {
      canonical: archiveDayUrl(day.date),
      types: {
        "application/json": archiveDayJsonUrl(day.date),
      },
    },
    openGraph: {
      title,
      description,
      url: archiveDayUrl(day.date),
      locale: "it_IT",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PrezziGiornoPage({
  params,
}: PageProps<"/prezzi/[giorno]">) {
  const { giorno } = await params;
  if (!dateFromParam(giorno)) notFound();

  const day = await loadArchiveDay(giorno);
  if (!day) notFound();

  return (
    <>
      <JsonLd data={archiveJsonLd(day)} />
      <DayArchiveView day={day} />
    </>
  );
}
