import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SignupProvider } from "@/components/SignupForm";

export default function CampagneLayout({ children }: LayoutProps<"/campagne">) {
  return (
    <SignupProvider>
      <div className="flex min-h-full flex-1 flex-col bg-background font-sans text-foreground">
        <Header />
        {children}
        <Footer />
      </div>
    </SignupProvider>
  );
}
