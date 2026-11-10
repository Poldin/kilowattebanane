import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CerMemberProfile } from "@/components/cer/CerMemberProfile";
import { SignupProvider } from "@/components/SignupForm";

// Private preview. Do not add this route to the header, footer, or sitemap.
export const metadata: Metadata = {
  title: "La tua adesione CER",
  description:
    "Area riservata dell’iscritto a una comunità energetica rinnovabile: utenza, CER, beneficiario e mandato.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function CerProfilePage() {
  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 pb-16 pt-8 sm:px-6 sm:pt-10">
          <CerMemberProfile />
        </main>
        <Footer />
      </div>
    </SignupProvider>
  );
}
