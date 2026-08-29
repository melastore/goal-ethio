"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { useLanguage } from "@/components/providers/language-provider";

const LINKS = [
  { href: "/", key: "nav.fixtures" as const },
  { href: "/results/", key: "nav.results" as const },
  { href: "/how/", key: "nav.how" as const },
];

export function Header() {
  const { t } = useLanguage();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-base font-bold tracking-tight">{t("site.name")}</span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>

        <LanguageToggle />
      </div>
    </header>
  );
}
