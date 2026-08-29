"use client";

import { useMemo, useState } from "react";

import { DayRail, type Day } from "@/components/fixtures/day-rail";
import { LeagueRail } from "@/components/fixtures/filter-rail";
import { MatchCard } from "@/components/fixtures/match-card";
import { SampleNotice } from "@/components/layout/sample-notice";
import { useLanguage } from "@/components/providers/language-provider";
import { readKickoff } from "@/lib/ethiopian-date";
import { LEAGUES } from "@/lib/leagues";
import type { MatchView } from "@/lib/view";
import { margin } from "@/lib/view";

// How many of the soonest fixtures lead the page.
const NEXT_UP = 3;

type Props = {
  upcoming: MatchView[];
  playedCount: number;
  sample: boolean;
};

export function FixturesView({ upcoming, playedCount, sample }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  const [league, setLeague] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);

  // Kickoffs are parsed once: readKickoff runs Intl and Kenat, and doing it per
  // render over four hundred fixtures is felt.
  const dated = useMemo(
    () =>
      upcoming.map((match) => {
        const kickoff = readKickoff(match.kickoff);
        return {
          match,
          key: `${kickoff.ethiopian.year}-${kickoff.ethiopian.month}-${kickoff.ethiopian.day}`,
          kickoff,
        };
      }),
    [upcoming]
  );

  const byDay = useMemo(() => {
    const inLeague = league === null ? dated : dated.filter((d) => d.match.leagueId === league);
    const days = new Map<string, Day>();

    for (const entry of inLeague) {
      const existing = days.get(entry.key);
      if (existing) existing.count += 1;
      else days.set(entry.key, { key: entry.key, kickoff: entry.kickoff, count: 1 });
    }

    return [...days.values()].sort(
      (a, b) => a.kickoff.date.getTime() - b.kickoff.date.getTime()
    );
  }, [dated, league]);

  const leagueCounts = useMemo(() => {
    const inDay = day === null ? dated : dated.filter((d) => d.key === day);
    const counts = new Map<number, number>();
    for (const entry of inDay) {
      counts.set(entry.match.leagueId, (counts.get(entry.match.leagueId) ?? 0) + 1);
    }
    return counts;
  }, [dated, day]);

  const shown = useMemo(
    () =>
      dated
        .filter((entry) => league === null || entry.match.leagueId === league)
        .filter((entry) => day === null || entry.key === day)
        .map((entry) => entry.match),
    [dated, league, day]
  );

  // Soonest first, and the very next few get their own row at the top.
  const nextUp = shown.slice(0, NEXT_UP);
  const rest = shown.slice(NEXT_UP);

  const clear = () => {
    setLeague(null);
    setDay(null);
  };

  return (
    <>
      {sample && <SampleNotice />}

      <header className="mb-6">
        <h1
          className={`text-[28px] font-bold leading-tight tracking-tight sm:text-4xl ${
            amharic ? "amharic" : ""
          }`}
        >
          {t("week.heading")}
        </h1>
        <p className={`mt-1.5 text-sm text-muted-foreground ${amharic ? "amharic" : ""}`}>
          {t("site.tagline")}
        </p>

        <dl className="mt-5 flex gap-7 border-t border-hairline pt-4">
          <Figure value={upcoming.length} label={t("nav.fixtures")} amharic={amharic} />
          <Figure value={playedCount} label={t("nav.results")} amharic={amharic} />
          <Figure
            value={LEAGUES.filter((l) => leagueCounts.has(l.id) || league === l.id).length}
            label={amharic ? "ውድድሮች" : "competitions"}
            amharic={amharic}
          />
        </dl>
      </header>

      <div className="sticky top-[92px] z-10 -mx-4 mb-6 space-y-2.5 border-b border-hairline bg-background/92 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <LeagueRail
          counts={leagueCounts}
          active={league}
          onSelect={setLeague}
          total={day === null ? upcoming.length : leagueCounts.size > 0 ? [...leagueCounts.values()].reduce((a, b) => a + b, 0) : 0}
        />
        <DayRail days={byDay} active={day} onSelect={setDay} total={shown.length} />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-card px-6 py-14 text-center">
          <p className={`text-sm text-muted-foreground ${amharic ? "amharic" : ""}`}>
            {t("filter.noMatches")}
          </p>
          <button
            type="button"
            onClick={clear}
            className={`mt-3 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 ${
              amharic ? "amharic" : ""
            }`}
          >
            {t("filter.clear")}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <SectionHeading title={t("week.picks")} note={t("week.picksNote")} amharic={amharic} />
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {nextUp.map((match, index) => (
                <MatchCard key={match.id} match={match} rank={index + 1} />
              ))}
            </div>
          </section>

          {rest.length > 0 && (
            <section>
              <SectionHeading
                title={t("week.all")}
                note={`${rest.length} ${t("count.matches")}`}
                amharic={amharic}
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rest.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function SectionHeading({
  title,
  note,
  amharic,
}: {
  title: string;
  note?: string;
  amharic: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className={`text-lg font-bold tracking-tight ${amharic ? "amharic" : ""}`}>{title}</h2>
      {note && (
        <span className={`shrink-0 text-xs text-subtle ${amharic ? "amharic" : ""}`}>{note}</span>
      )}
    </div>
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
      <dd className="font-mono text-2xl font-bold tnum leading-none">{value}</dd>
      <div
        className={`mt-1.5 text-[11px] uppercase tracking-wide text-subtle ${
          amharic ? "amharic normal-case tracking-normal" : ""
        }`}
      >
        {label}
      </div>
    </div>
  );
}
