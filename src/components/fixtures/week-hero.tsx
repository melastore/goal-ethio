"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { readKickoff } from "@/lib/ethiopian-date";
import { LEAGUES } from "@/lib/leagues";
import type { Projected } from "@/lib/week-data";

type Props = {
  upcoming: Projected[];
  playedCount: number;
};

// The week at a glance: which Ethiopian days it spans, and how much is left.
export function WeekHero({ upcoming, playedCount }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  const first = upcoming[0] ? readKickoff(upcoming[0].fixture.kickoff) : null;
  const last = upcoming.at(-1) ? readKickoff(upcoming.at(-1)!.fixture.kickoff) : null;

  const span =
    first && last
      ? amharic
        ? `${first.ethiopianDateAmharic} - ${last.ethiopianDateAmharic}`
        : `${first.ethiopianDate} - ${last.ethiopianDate}`
      : null;

  return (
    <section className="mb-7">
      <h1
        className={`text-[26px] font-bold leading-tight tracking-tight sm:text-3xl ${
          amharic ? "amharic" : ""
        }`}
      >
        {t("week.heading")}
      </h1>
      <p className={`mt-1 text-sm text-muted-foreground ${amharic ? "amharic" : ""}`}>
        {t("site.tagline")}
      </p>

      {span && (
        <p className={`mt-3 text-xs text-subtle ${amharic ? "amharic" : ""}`}>{span}</p>
      )}

      <dl className="mt-4 flex gap-6 border-t border-hairline pt-4">
        <Figure value={upcoming.length} label={t("nav.fixtures")} amharic={amharic} />
        <Figure value={playedCount} label={t("nav.results")} amharic={amharic} />
        <Figure
          value={LEAGUES.length}
          label={amharic ? "ውድድሮች" : "competitions"}
          amharic={amharic}
        />
      </dl>
    </section>
  );
}

function Figure({
  value,
  label,
  amharic,
}: {
  value: number;
  label: string;
  amharic: boolean;
}) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-mono text-xl font-bold tnum">{value}</dd>
      <div
        className={`text-[11px] uppercase tracking-wide text-subtle ${
          amharic ? "amharic normal-case tracking-normal" : ""
        }`}
      >
        {label}
      </div>
    </div>
  );
}
