"use client";

import { useMemo, useState } from "react";
import { RotateCw } from "lucide-react";

import { LeagueRail } from "@/components/fixtures/filter-rail";
import { LiveBar } from "@/components/fixtures/live-bar";
import { MatchDetail } from "@/components/fixtures/match-detail";
import { ResultCard } from "@/components/fixtures/result-card";
import { SampleNotice } from "@/components/layout/sample-notice";
import { useLanguage } from "@/components/providers/language-provider";
import { percent, rate } from "@/lib/format";
import { applyScore, useLive } from "@/lib/live";
import type { Tally } from "@/lib/scoring";
import { leanOf, type MatchView } from "@/lib/view";
import type { ResultView } from "@/lib/week-data";

type Props = {
  results: ResultView[];
  record: Tally;
  sample: boolean;
  live?: MatchView[];
  // Everything not played at build time, so a match that finishes while the
  // page is open can be graded here rather than waiting for the next deploy.
  upcoming?: MatchView[];
};

// The same grading the build does, for a score that arrived after it. Who
// scored first is not in the live feed, so that stays ungraded.
function gradeLive(match: MatchView): ResultView | null {
  const result = match.result;
  if (!result) return null;

  const actual =
    result.goalsHome > result.goalsAway
      ? "home"
      : result.goalsHome === result.goalsAway
        ? "draw"
        : "away";

  const predicted = leanOf(match);

  return {
    view: match,
    outcomeHit: predicted === actual,
    firstGoalHit: null,
    predicted,
    actual,
  };
}

export function ResultsView({ results, record, sample, live = [], upcoming = [] }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  const [openId, setOpenId] = useState<number | null>(null);
  const [league, setLeague] = useState<number | null>(null);

  const all = useMemo(() => [...live, ...upcoming], [live, upcoming]);
  const feed = useLive(all);

  const scored = useMemo(
    () =>
      all
        .map((match) => applyScore(match, feed.scores.get(match.id)))
        .filter((match) => feed.scores.has(match.id)),
    [all, feed.scores]
  );

  const scoreboard = useMemo(() => scored.filter((match) => match.isLive), [scored]);

  const open = useMemo(
    () => scored.find((match) => match.id === openId) ?? null,
    [scored, openId]
  );

  // Anything that finished since the build, graded here and put in front of the
  // results the build already had.
  const merged = useMemo(() => {
    const known = new Set(results.map((entry) => entry.view.id));
    const fresh = scored
      .filter((match) => match.finished && !known.has(match.id))
      .map(gradeLive)
      .filter((entry): entry is ResultView => entry !== null)
      .sort((a, b) => (a.view.kickoff < b.view.kickoff ? 1 : -1));

    return [...fresh, ...results];
  }, [scored, results]);

  // Counted over everything, so a league with results is still offered when
  // another one is the current filter.
  const counts = useMemo(() => {
    const byLeague = new Map<number, number>();
    for (const entry of merged) {
      byLeague.set(entry.view.leagueId, (byLeague.get(entry.view.leagueId) ?? 0) + 1);
    }
    return byLeague;
  }, [merged]);

  const shown = useMemo(
    () => (league === null ? merged : merged.filter((entry) => entry.view.leagueId === league)),
    [merged, league]
  );

  return (
    <>
      {sample && <SampleNotice />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1
          className={`text-[26px] font-bold leading-tight tracking-tight sm:text-3xl ${
            amharic ? "amharic" : ""
          }`}
        >
          {t("results.heading")}
        </h1>

        <button
          type="button"
          onClick={feed.refresh}
          disabled={feed.loading}
          className="flex items-center gap-1.5 rounded-lg border border-hairline bg-card px-2.5 py-1 text-xs font-medium transition hover:bg-muted active:scale-95 disabled:opacity-50"
        >
          <RotateCw
            className={`size-3 text-muted-foreground ${feed.loading ? "animate-spin" : ""}`}
          />
          <span className={amharic ? "amharic" : ""}>{t("market.refresh")}</span>
        </button>
      </div>

      <LiveBar
        matches={scoreboard}
        liveCount={scoreboard.length}
        scores={feed.scores}
        checkedAt={feed.checkedAt}
        loading={feed.loading}
        direct={feed.direct}
        onRefresh={feed.refresh}
        onOpen={setOpenId}
      />

      {merged.length === 0 && scoreboard.length === 0 ? (
        <p
          className={`rounded-[14px] border border-hairline bg-card px-6 py-10 text-center text-sm text-muted-foreground ${
            amharic ? "amharic" : ""
          }`}
        >
          {t("results.empty")}
        </p>
      ) : (
        <div className="space-y-6">
          <Record record={record} amharic={amharic} />

          {merged.length > 0 && (
            <div className="rounded-xl border border-hairline bg-card px-3 py-2">
              <LeagueRail
                counts={counts}
                active={league}
                onSelect={setLeague}
                total={merged.length}
              />
            </div>
          )}

          {shown.length === 0 ? (
            <p
              className={`rounded-[14px] border border-hairline bg-card px-6 py-10 text-center text-sm text-muted-foreground ${
                amharic ? "amharic" : ""
              }`}
            >
              {t("filter.noMatches")}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((entry) => (
                <ResultCard key={entry.view.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label={t("detail.close")}
            onClick={() => setOpenId(null)}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <div className="panel-in absolute inset-x-0 bottom-0 top-10 sm:inset-x-6 sm:top-16 lg:inset-x-[22%]">
            <MatchDetail match={open} onClose={() => setOpenId(null)} />
          </div>
        </div>
      )}
    </>
  );
}

// A three-way coin flip, for the two scores that need something to sit against.
const COIN_BRIER = 2 / 3;
const COIN_LOG_LOSS = Math.log(3);

function Record({ record, amharic }: { record: Tally; amharic: boolean }) {
  const { t } = useLanguage();

  return (
    <section className="rounded-[14px] border border-hairline bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`text-sm font-bold ${amharic ? "amharic" : ""}`}>{t("results.record")}</h2>
        <span className="font-mono text-[11px] tnum text-subtle">
          {record.played} {t("count.matches")}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Score
          label={t("results.outcomeHits")}
          value={rate(record.outcomeHits, record.played)}
          detail={`${record.outcomeHits}/${record.played}`}
          amharic={amharic}
        />
        <Score
          label={t("results.firstGoalHits")}
          value={rate(record.firstGoalHits, record.firstGoalGraded)}
          detail={`${record.firstGoalHits}/${record.firstGoalGraded}`}
          amharic={amharic}
        />
        <Score
          label={t("results.bttsHits")}
          value={rate(record.bttsHits, record.played)}
          detail={`${record.bttsHits}/${record.played}`}
          amharic={amharic}
        />
        <Score
          label={t("results.scorelineHits")}
          value={rate(record.scorelineHits, record.played)}
          detail={`${record.scorelineHits}/${record.played}`}
          amharic={amharic}
        />
      </dl>

      {/* Hit rate says the ordering is right; these say the numbers are. */}
      <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-hairline pt-3.5">
        <Small
          label={t("results.calibration")}
          value={percent(record.meanProbabilityOfActual, 1)}
          note={t("results.vsCoin33")}
          amharic={amharic}
        />
        <Small
          label={t("results.brier")}
          value={record.brier.toFixed(3)}
          note={`${t("results.coin")} ${COIN_BRIER.toFixed(3)}`}
          amharic={amharic}
          good={record.played > 0 && record.brier < COIN_BRIER}
        />
        <Small
          label={t("results.logLoss")}
          value={record.logLoss.toFixed(3)}
          note={`${t("results.coin")} ${COIN_LOG_LOSS.toFixed(3)}`}
          amharic={amharic}
          good={record.played > 0 && record.logLoss < COIN_LOG_LOSS}
        />
      </dl>

      {record.bands.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={`text-[11px] font-semibold uppercase tracking-wider text-subtle ${amharic ? "amharic normal-case tracking-normal" : ""}`}>
              {t("results.reliability")}
            </h3>
            <span className={`text-[10px] text-subtle ${amharic ? "amharic" : ""}`}>
              {t("results.reliabilityNote")}
            </span>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {record.bands.map((band) => (
              <div key={band.from} className="flex items-center gap-2.5">
                <span className="w-[62px] shrink-0 font-mono text-[11px] tnum text-muted-foreground">
                  {Math.round(band.from * 100)}-{Math.round(Math.min(band.to, 1) * 100)}%
                </span>
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary/70"
                    style={{ width: `${Math.min(band.hits / band.n, 1) * 100}%` }}
                  />
                  {/* Where the model said it would land. */}
                  <span
                    className="absolute top-0 h-full w-[2px] bg-foreground/70"
                    style={{ left: `${Math.min(band.claimed, 1) * 100}%` }}
                    aria-hidden
                  />
                </div>
                <span className="w-[64px] shrink-0 text-right font-mono text-[11px] tnum">
                  {rate(band.hits, band.n)}
                  <span className="ml-1 text-subtle">/{band.n}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Score({
  label,
  value,
  detail,
  amharic,
}: {
  label: string;
  value: string;
  detail: string;
  amharic: boolean;
}) {
  return (
    <div>
      <dt className={`truncate text-[11px] text-muted-foreground ${amharic ? "amharic" : ""}`}>
        {label}
      </dt>
      <dd className="mt-1 font-mono text-2xl font-bold leading-none tnum">{value}</dd>
      <div className="mt-1 font-mono text-[11px] tnum text-subtle">{detail}</div>
    </div>
  );
}

function Small({
  label,
  value,
  note,
  amharic,
  good,
}: {
  label: string;
  value: string;
  note: string;
  amharic: boolean;
  good?: boolean;
}) {
  return (
    <div>
      <dt className={`truncate text-[11px] text-muted-foreground ${amharic ? "amharic" : ""}`}>
        {label}
      </dt>
      <dd
        className={`mt-1 font-mono text-base font-bold leading-none tnum ${
          good === undefined ? "" : good ? "text-home" : "text-live"
        }`}
      >
        {value}
      </dd>
      <div className={`mt-1 text-[10px] text-subtle ${amharic ? "amharic" : ""}`}>{note}</div>
    </div>
  );
}
