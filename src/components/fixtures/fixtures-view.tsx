"use client";

import { useEffect, useMemo, useState } from "react";

import { DayRail, type Day } from "@/components/fixtures/day-rail";
import { LeagueRail } from "@/components/fixtures/filter-rail";
import { LiveBar } from "@/components/fixtures/live-bar";
import { MatchDetail } from "@/components/fixtures/match-detail";
import { MatchRow } from "@/components/fixtures/match-row";
import { SampleNotice } from "@/components/layout/sample-notice";
import { useLanguage } from "@/components/providers/language-provider";
import { readKickoff } from "@/lib/ethiopian-date";
import { applyScore, useLive } from "@/lib/live";
import type { MatchView } from "@/lib/view";

type Props = {
  upcoming: MatchView[];
  sample: boolean;
  live?: MatchView[];
};

export function FixturesView({ upcoming, sample, live = [] }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  const [league, setLeague] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  // One list for the poller: a match that kicked off since the build sits in
  // `upcoming`, and only the feed knows it is on.
  const all = useMemo(() => [...live, ...upcoming], [live, upcoming]);
  const feed = useLive(all);

  // Kickoffs are parsed off the build's list and never again. readKickoff runs
  // Intl and Kenat, and redoing four hundred of them on every poll is felt.
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

  // Anything the feed has moved off scheduled leaves the fixture list, either
  // up into the live bar or off the page.
  const started = useMemo(() => {
    const ids = new Set<number>();
    for (const [id, score] of feed.scores) {
      if (score.status !== "scheduled") ids.add(id);
    }
    return ids;
  }, [feed.scores]);

  const liveNow = useMemo(
    () =>
      all
        .filter((match) => match.isLive || feed.scores.get(match.id)?.status === "live")
        .map((match) => applyScore(match, feed.scores.get(match.id)))
        .filter((match) => match.isLive),
    [all, feed.scores]
  );

  const pending = useMemo(
    () => dated.filter((entry) => !started.has(entry.match.id)),
    [dated, started]
  );

  const byDay = useMemo(() => {
    const inLeague = league === null ? pending : pending.filter((d) => d.match.leagueId === league);
    const days = new Map<string, Day>();

    for (const entry of inLeague) {
      const existing = days.get(entry.key);
      if (existing) existing.count += 1;
      else days.set(entry.key, { key: entry.key, kickoff: entry.kickoff, count: 1 });
    }

    return [...days.values()].sort((a, b) => a.kickoff.date.getTime() - b.kickoff.date.getTime());
  }, [pending, league]);

  const leagueCounts = useMemo(() => {
    const inDay = day === null ? pending : pending.filter((d) => d.key === day);
    const counts = new Map<number, number>();
    for (const entry of inDay) {
      counts.set(entry.match.leagueId, (counts.get(entry.match.leagueId) ?? 0) + 1);
    }
    return counts;
  }, [pending, day]);

  const shown = useMemo(
    () =>
      pending
        .filter((entry) => league === null || entry.match.leagueId === league)
        .filter((entry) => day === null || entry.key === day),
    [pending, league, day]
  );

  // Days become headings in the list rather than a second grid.
  const sections = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; matches: MatchView[] }>();
    for (const entry of shown) {
      const label = amharic
        ? `${entry.kickoff.weekday.amharic} ${entry.kickoff.ethiopian.day}`
        : `${entry.kickoff.weekday.label} ${entry.kickoff.ethiopian.day}`;
      const group = groups.get(entry.key);
      if (group) group.matches.push(entry.match);
      else groups.set(entry.key, { key: entry.key, label, matches: [entry.match] });
    }
    return [...groups.values()];
  }, [shown, amharic]);

  const open = useMemo(() => {
    const found = all.find((match) => match.id === openId);
    return found ? applyScore(found, feed.scores.get(found.id)) : null;
  }, [all, openId, feed.scores]);

  // A filter that hides the open match should close it, not leave a panel
  // describing something no longer in the list.
  useEffect(() => {
    if (openId === null) return;
    const visible =
      liveNow.some((match) => match.id === openId) ||
      shown.some((entry) => entry.match.id === openId);
    if (!visible) setOpenId(null);
  }, [openId, liveNow, shown]);

  // The overlay takes the whole screen on a phone, so the page behind it should
  // not scroll under it.
  useEffect(() => {
    if (openId === null) return;
    const wide = window.matchMedia("(min-width: 1280px)").matches;
    if (wide) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [openId]);

  const clear = () => {
    setLeague(null);
    setDay(null);
  };

  const total = shown.length;

  return (
    <>
      {sample && <SampleNotice />}

      <div className="mb-3 flex items-baseline gap-2.5">
        <h1 className={`text-xl font-bold tracking-tight ${amharic ? "amharic" : ""}`}>
          {t("week.heading")}
        </h1>
        <span className="font-mono text-xs tnum text-subtle">{total}</span>
        <span className={`ml-auto text-xs text-subtle ${amharic ? "amharic" : ""}`}>
          {t("site.tagline")}
        </span>
      </div>

      <LiveBar
        matches={liveNow}
        scores={feed.scores}
        checkedAt={feed.checkedAt}
        loading={feed.loading}
        direct={feed.direct}
        onRefresh={feed.refresh}
        onOpen={setOpenId}
      />

      <div className="sticky top-[49px] z-10 -mx-4 mb-4 space-y-1.5 border-b border-hairline bg-background/92 px-4 py-2 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-3">
        <LeagueRail
          counts={leagueCounts}
          active={league}
          onSelect={setLeague}
          total={pending.length}
        />
        <DayRail days={byDay} active={day} onSelect={setDay} total={total} />
      </div>

      {total === 0 ? (
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
        <div className="flex gap-5">
          <div className="min-w-0 flex-1 space-y-5">
            {sections.map((section) => (
              <section key={section.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
                  <h2
                    className={`text-[12px] font-bold uppercase tracking-wider text-muted-foreground ${
                      amharic ? "amharic normal-case tracking-normal" : ""
                    }`}
                  >
                    {section.label}
                  </h2>
                  <span className="font-mono text-[11px] tnum text-subtle">
                    {section.matches.length}
                  </span>
                </div>

                <div className="overflow-hidden rounded-[14px] border border-hairline bg-card shadow-[var(--shadow-card)]">
                  {section.matches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      active={match.id === openId}
                      onOpen={setOpenId}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Wide enough and the detail sits beside the list; narrower and it
              comes up over it. */}
          <aside className="hidden w-[400px] shrink-0 xl:block">
            <div className="sticky top-[110px] max-h-[calc(100vh-130px)]">
              {open ? (
                <MatchDetail match={open} onClose={() => setOpenId(null)} />
              ) : (
                <div className="rounded-[14px] border border-dashed border-hairline px-6 py-14 text-center">
                  <p className={`text-sm text-muted-foreground ${amharic ? "amharic" : ""}`}>
                    {t("detail.pick")}
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            aria-label={t("detail.close")}
            onClick={() => setOpenId(null)}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <div className="panel-in absolute inset-x-0 bottom-0 top-10 sm:inset-x-6 sm:top-16">
            <MatchDetail match={open} onClose={() => setOpenId(null)} />
          </div>
        </div>
      )}
    </>
  );
}
