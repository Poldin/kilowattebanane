import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CerBeneficiaryFaq } from "@/components/cer/CerBeneficiaryFaq";
import { CerBeneficiaryForm } from "@/components/cer/CerBeneficiaryForm";
import { SignupProvider } from "@/components/SignupForm";
import { publicSiteUrl } from "@/lib/app-url";

const PAGE_TITLE = "Sostieni l'Amico del Popolo, iscriviti a una CER!";
const PAGE_HEADING = "Sostieni l'Amico del Popolo!";
const PAGE_SUBTITLE =
  "Entra in una comunità energetica rinnovabile: l'energia che condividi dà una spinta concreta anche a chi racconta il territorio.";
const SHORT_ID = "pU1fRZE07xo";

export async function generateMetadata({
  params,
}: PageProps<"/cer/iscriviti/[idbeneficiario]">): Promise<Metadata> {
  const { idbeneficiario } = await params;

  return {
    title: PAGE_TITLE,
    description: PAGE_SUBTITLE,
    alternates: {
      canonical: `${publicSiteUrl()}/cer/iscriviti/${idbeneficiario}`,
    },
  };
}

export default async function CerIscrivitiPage({
  params,
}: PageProps<"/cer/iscriviti/[idbeneficiario]">) {
  await params;

  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header
          partner={{
            name: "L'Amico del Popolo",
            logoSrc: "/cer/amico-del-popolo-logo.png",
            href: "https://www.amicodelpopolo.it/",
          }}
        />
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-1 pb-16 pt-8 sm:px-6 sm:pt-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
            <div className="mx-auto w-[min(100%,20rem)] shrink-0 md:mx-0 md:w-80">
              <YoutubeShort id={SHORT_ID} title="Short YouTube" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {PAGE_HEADING}
              </h1>
              <p className="mt-4 text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg dark:text-neutral-400">
                {PAGE_SUBTITLE}
              </p>
              <CerBeneficiaryForm />
            </div>
          </div>
          <CerBeneficiaryFaq />
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}

function YoutubeShort({ id, title }: { id: string; title: string }) {
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
