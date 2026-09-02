import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { publicSiteUrl } from "@/lib/app-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  title: {
    default: "kilowatt e banane🍌🍌🍌",
    template: "%s · kilowatt e banane",
  },
  description:
    "Ti mostriamo ogni giorno il costo dell'energia all'ingrosso nella tua zona. Così sai come risparmiare sulla bolletta. Gratis.",
  openGraph: {
    locale: "it_IT",
    type: "website",
    siteName: "kilowatt e banane",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col px-1 font-sans sm:px-0">{children}</body>
    </html>
  );
}
