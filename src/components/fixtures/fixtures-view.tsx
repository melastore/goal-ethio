"use client";

import { useMemo, useState } from "react";

import { DayRail, type Day } from "@/components/fixtures/day-rail";
import { LeagueRail } from "@/components/fixtures/filter-rail";
import { MatchCard } from "@/components/fixtures/match-card";
import { SampleNotice } from "@/components/layout/sample-notice";
import { useLanguage } from "@/components/providers/language-provider";
import { readKickoff } from "@/lib/ethiopian-date";
import type { MatchView } from "@/lib/view";

// How many of the soonest fixtures lead the page.
const NEXT_UP = 3;

type Props = {
  upcoming: MatchView[];
  sample: boolean;
};

export function FixturesView({ upcoming, sample }: Props) {
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

      {/* One line, not a hero: the counts live on the chips below anyway. */}
      <div className="mb-3 flex items-baseline gap-2.5">
        <h1 className={`text-xl font-bold tracking-tight ${amharic ? "amharic" : ""}`}>
          {t("week.heading")}
        </h1>
        <span className="font-mono text-xs tnum text-subtle">{shown.length}</span>
        <span className={`ml-auto text-xs text-subtle ${amharic ? "amharic" : ""}`}>
          {t("site.tagline")}
        </span>
      </div>

      <div className="sticky top-[49px] z-10 -mx-4 mb-5 space-y-1.5 border-b border-hairline bg-background/92 px-4 py-2 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-3">
        <LeagueRail
          counts={leagueCounts}
          active={league}
          onSelect={setLeague}
          total={upcoming.length}
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

