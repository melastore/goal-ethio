"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { LEAGUES } from "@/lib/leagues";

export function HowView() {
  const { t, language } = useLanguage();
  const amharic = language === "am";
  const body = amharic ? "amharic" : undefined;

  return (
    <article className="space-y-6">
      <h1
        className={`text-[26px] font-bold leading-tight tracking-tight sm:text-3xl ${body ?? ""}`}
      >
        {t("how.heading")}
      </h1>

      <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground">
        <p className={body}>{t("how.body")}</p>
        <p className={body}>{t("how.shrink")}</p>
        <p className={body}>{t("how.firstGoal")}</p>
      </div>

      <section className="rounded-[16px] border border-hairline bg-card p-4 shadow-[var(--shadow-card)]">
        <h2 className={`text-sm font-bold ${body ?? ""}`}>
          {LEAGUES.length} {amharic ? "ውድድሮች" : "competitions"}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {LEAGUES.map((league) => (
            <li key={league.id} className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] font-bold text-subtle">{league.short}</span>
              <span className={amharic ? "amharic" : undefined}>
                {amharic ? league.amharic : league.name}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p
        className={`rounded-[16px] border border-draw/30 bg-draw/10 p-4 text-sm leading-relaxed ${body ?? ""}`}
      >
        {t("how.disclaimer")}
      </p>
    </article>
  );
}
