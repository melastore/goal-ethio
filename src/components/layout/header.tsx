"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useLanguage } from "@/components/providers/language-provider";

const LINKS = [
  { href: "/", key: "nav.fixtures" as const },
  { href: "/results/", key: "nav.results" as const },
];

export function Header() {
  const { t, language } = useLanguage();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Mark />
          <span className="hidden text-[15px] font-bold tracking-tight sm:inline">
            {t("site.name")}
          </span>
        </Link>

        {/* One row: the nav sits beside the wordmark rather than under it. */}
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full px-2.5 py-1.5 text-sm transition ${
                  active
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                } ${language === "am" ? "amharic" : ""}`}
              >
                {t(link.key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

// A ball on the pitch: enough of a mark to anchor the wordmark without art.
function Mark() {
  return (
    <span
      className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7.5l4 2.9-1.5 4.6h-5L8 10.4z" fill="currentColor" />
      </svg>
    </span>
  );
}
