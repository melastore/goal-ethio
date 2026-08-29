"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { LEAGUES } from "@/lib/leagues";

export function HowView() {
  const { t, language } = useLanguage();
  const amharic = language === "am";
  const body = amharic ? "amharic" : undefined;

  return (
    <article className="space-y-6">
      <h1 className={`text-2xl font-bold tracking-tight ${body ?? ""}`}>
        {t("how.heading")}
      </h1>

      <div className="space-y-4 text-sm leading-relaxed">
        <p className={body}>{t("how.body")}</p>
        <p className={body}>{t("how.shrink")}</p>
        <p className={body}>{t("how.firstGoal")}</p>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">
          {LEAGUES.length} {amharic ? "ውድድሮች" : "competitions"}
        </h2>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {LEAGUES.map((league) => (
            <li key={league.id} className={amharic ? "amharic" : undefined}>
              {amharic ? league.amharic : league.name}
            </li>
          ))}
        </ul>
      </section>

      <p className={`rounded-lg border border-[var(--draw)]/40 bg-[var(--draw)]/10 p-4 text-sm ${body ?? ""}`}>
        {t("how.disclaimer")}
      </p>
    </article>
  );
}
