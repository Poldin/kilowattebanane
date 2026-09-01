import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "kilowatt e banane🍌🍌🍌",
  description:
    "Ricevi ogni giorno una mail con il costo dell'energia nella tua zona. Sai già al mattino quando consumare per risparmiare sulla bolletta. Gratis.",
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
