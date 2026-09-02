"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

import { LiveResultCard, ResultCard } from "@/components/fixtures/result-card";
import { SampleNotice } from "@/components/layout/sample-notice";
import { useLanguage } from "@/components/providers/language-provider";
import { percent, rate } from "@/lib/format";
import type { Tally } from "@/lib/scoring";
import type { MatchView } from "@/lib/view";
import type { ResultView } from "@/lib/week-data";

type Props = {
  results: ResultView[];
  record: Tally;
  sample: boolean;
  live?: MatchView[];
};

type FeedFixture = MatchView & {
  projection?: MatchView["p"];
};

export function ResultsView({ results, record, sample, live = [] }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  const [liveMatches, setLiveMatches] = useState<MatchView[]>(live);
  const [currentResults] = useState<ResultView[]>(results);
  const [currentRecord, setCurrentRecord] = useState<Tally>(record);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const fetchLiveFeed = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const res = await fetch(`${basePath}/feed.json?_t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { fixtures?: FeedFixture[]; record?: Tally };
      if (data && Array.isArray(data.fixtures)) {
        const activeLive: MatchView[] = data.fixtures
          .filter((f) => f.status === "live")
          .map((f) => ({
            ...f,
            p: f.projection ?? f.p,
            finished: false,
            isLive: true,
          }));
        setLiveMatches(activeLive);
        if (data.record) setCurrentRecord(data.record);
      }
    } catch {
      // Retain existing state on transient network failure
    } finally {
      setIsRefreshing(false);
      const now = new Date();
      setLastChecked(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    }
  }, []);

  useEffect(() => {
    const now = new Date();
    setLastChecked(
      now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    );

    // Auto-poll live feed every 30 seconds
    const timer = setInterval(fetchLiveFeed, 30_000);
    return () => clearInterval(timer);
  }, [fetchLiveFeed]);

  return (
    <>
      {sample && <SampleNotice />}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1
          className={`text-[26px] font-bold leading-tight tracking-tight sm:text-3xl ${
            amharic ? "amharic" : ""
          }`}
        >
          {t("results.heading")}
        </h1>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className={amharic ? "amharic" : ""}>{t("market.liveActive")}</span>
            {lastChecked && (
              <span className="font-mono text-[11px] text-subtle tnum">· {lastChecked}</span>
            )}
          </span>

          <button
            type="button"
            onClick={fetchLiveFeed}
            disabled={isRefreshing}
            className="flex items-center gap-1 rounded-lg border border-hairline bg-card px-2.5 py-1 text-xs font-medium transition hover:bg-muted active:scale-95 disabled:opacity-50"
            title={t("market.refresh")}
          >
            <RotateCw className={`size-3 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
            <span className={amharic ? "amharic" : ""}>{t("market.refresh")}</span>
          </button>
        </div>
      </div>

      {liveMatches.length > 0 && (
        <section className="mb-8 space-y-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-500 animate-ping" />
            <h2 className={`text-sm font-bold text-red-500 uppercase tracking-wide ${amharic ? "amharic tracking-normal" : ""}`}>
              {t("results.liveMatches")} ({liveMatches.length})
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liveMatches.map((match) => (
              <LiveResultCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {currentResults.length === 0 && liveMatches.length === 0 ? (
        <p
          className={`rounded-[16px] border border-hairline bg-card px-6 py-10 text-center text-sm text-muted-foreground ${
            amharic ? "amharic" : ""
          }`}
        >
          {t("results.empty")}
        </p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[16px] border border-hairline bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className={`text-sm font-bold ${amharic ? "amharic" : ""}`}>{t("results.record")}</h2>

            <dl className="mt-4 grid grid-cols-3 gap-4">
              <Score
                label={t("results.outcomeHits")}
                value={rate(currentRecord.outcomeHits, currentRecord.played)}
                detail={`${currentRecord.outcomeHits}/${currentRecord.played}`}
                amharic={amharic}
              />
              <Score
                label={t("results.firstGoalHits")}
                value={rate(currentRecord.firstGoalHits, currentRecord.firstGoalGraded)}
                detail={`${currentRecord.firstGoalHits}/${currentRecord.firstGoalGraded}`}
                amharic={amharic}
              />
              <Score
                label={t("results.scorelineHits")}
                value={rate(currentRecord.scorelineHits, currentRecord.played)}
                detail={`${currentRecord.scorelineHits}/${currentRecord.played}`}
                amharic={amharic}
              />
            </dl>

            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
              <span className={`text-xs text-muted-foreground ${amharic ? "amharic" : ""}`}>
                {t("results.calibration")}
              </span>
              <span className="font-mono text-xs font-semibold tnum">
                {percent(currentRecord.meanProbabilityOfActual, 1)}
              </span>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {currentResults.map((entry) => (
              <ResultCard key={entry.view.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </>
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
      <dd className="mt-1 font-mono text-2xl font-bold tnum leading-none">{value}</dd>
      <div className="mt-1 font-mono text-[11px] tnum text-subtle">{detail}</div>
    </div>
  );
}
