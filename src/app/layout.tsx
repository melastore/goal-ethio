import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Ethiopic } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { LanguageProvider } from "@/components/providers/language-provider";
import { themeBootstrap } from "@/lib/theme";
import { loadWeek } from "@/lib/week-data";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

// Only the weights the site uses: the fidel subset is large.
const ethiopic = Noto_Sans_Ethiopic({
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ethiopic",
  display: "swap",
});

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
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} ${ethiopic.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </head>
      <body className="flex min-h-screen flex-col">
        <LanguageProvider>
          <Header />
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-6 sm:px-6">
            {children}
          </main>
          <Footer generatedAt={generatedAt} />
        </LanguageProvider>
      </body>
    </html>
  );
}
