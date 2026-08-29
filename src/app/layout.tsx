import type { Metadata } from "next";
import "./globals.css";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { LanguageProvider } from "@/components/providers/language-provider";
import { loadWeek } from "@/lib/week-data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://goalethio.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GoalEthio",
    template: "%s | GoalEthio",
  },
  description:
    "Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and Champions League fixtures in Ethiopian date and time, with form-based projections.",
  applicationName: "GoalEthio",
  keywords: [
    "Ethiopian time football",
    "Premier League Ethiopia",
    "Champions League Ethiopian time",
    "football predictions Ethiopia",
  ],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "GoalEthio", url: siteUrl },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { generatedAt } = loadWeek();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <LanguageProvider>
          <Header />
          <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
          <Footer generatedAt={generatedAt} />
        </LanguageProvider>
      </body>
    </html>
  );
}
