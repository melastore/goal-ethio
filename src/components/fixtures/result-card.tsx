"use client";

import { Check, X } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { odds, percent } from "@/lib/format";
import { readKickoff } from "@/lib/ethiopian-date";
import { leagueById } from "@/lib/leagues";
import type { MatchView } from "@/lib/view";
import { leanOf } from "@/lib/view";
import type { ResultView } from "@/lib/week-data";

export function LiveResultCard({ match }: { match: MatchView }) {
  const { t, language } = useLanguage();
  const amharic = language === "am";
  const league = leagueById(match.leagueId);
  const result = match.result;
  const pick = leanOf(match);
  const pickName =
    pick === "draw" ? t("card.draw") : pick === "home" ? match.home.short : match.away.short;

  const periodLabel = result?.period ?? "LIVE";
  const minuteLabel = result?.minute ? `${result.minute}'` : "";

  return (
    <article className="overflow-hidden rounded-[18px] border-2 border-red-500/40 bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
        <span
          className={`min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${
            amharic ? "amharic normal-case tracking-normal" : ""
          }`}
        >
          {amharic ? league?.amharic : league?.name}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-500">
          <span className="size-2 rounded-full bg-red-500 animate-ping" />
          <span>{periodLabel} {minuteLabel}</span>
        </span>
      </div>

      <div className="space-y-2.5 px-4 py-3.5">
        <ScoreRow
          team={match.home}
          goals={result?.goalsHome ?? 0}
          won={(result?.goalsHome ?? 0) > (result?.goalsAway ?? 0)}
        />
        <ScoreRow
          team={match.away}
          goals={result?.goalsAway ?? 0}
          won={(result?.goalsAway ?? 0) > (result?.goalsHome ?? 0)}
        />
      </div>

      <div className="flex items-center justify-between border-t border-hairline bg-muted/30 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">{t("results.predicted")}</span>
        <span className="font-semibold">
          {pickName} {percent(match.p.outcome[pick])} (@{odds(match.p.outcome[pick])})
        </span>
      </div>
    </article>
  );
}

export function ResultCard({ entry }: { entry: ResultView }) {
  const { t, language } = useLanguage();
  const { view, actual, predicted, outcomeHit, firstGoalHit } = entry;
  const result = view.result;
  if (!result) return null;

  const amharic = language === "am";
  const kickoff = readKickoff(view.kickoff);
  const league = leagueById(view.leagueId);

  const name = (pick: typeof actual) =>
    pick === "draw" ? t("card.draw") : pick === "home" ? view.home.short : view.away.short;

  return (
    <article className="overflow-hidden rounded-[18px] border border-hairline bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <span
          className={`min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${
            amharic ? "amharic normal-case tracking-normal" : ""
          }`}
        >
          {amharic ? league?.amharic : league?.name}
        </span>
        <span className={`shrink-0 text-[11px] text-subtle ${amharic ? "amharic" : ""}`}>
          {amharic ? kickoff.ethiopianDateAmharic : kickoff.ethiopianDate}
        </span>
      </div>

      <div className="space-y-2.5 px-4 py-3.5">
        <ScoreRow team={view.home} goals={result.goalsHome} won={actual === "home"} />
        <ScoreRow team={view.away} goals={result.goalsAway} won={actual === "away"} />
      </div>

      {(result.halfHome !== null || result.firstGoal) && (
        <div className="flex items-center gap-3 border-t border-hairline px-4 py-2.5 text-xs">
          {result.halfHome !== null && (
            <span className="text-muted-foreground">
              HT{" "}
              <span className="font-mono tnum text-foreground">
                {result.halfHome}-{result.halfAway}
              </span>
            </span>
          )}
          {result.firstGoal && (
            <span className="ml-auto truncate">
              <span className={`text-muted-foreground ${amharic ? "amharic" : ""}`}>
                {t("results.firstScorer")}{" "}
              </span>
              <span className="font-semibold">
                {result.firstGoal === "home" ? view.home.short : view.away.short}
              </span>
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 divide-x divide-hairline border-t border-hairline">
        <Verdict
          label={t("results.predicted")}
          value={`${name(predicted)} ${percent(view.p.outcome[predicted])}`}
          hit={outcomeHit}
          amharic={amharic}
        />
        <Verdict
          label={t("results.firstGoalHits")}
          value={
            firstGoalHit === null
              ? t("card.neither")
              : view.p.firstGoal.home >= view.p.firstGoal.away
                ? view.home.short
                : view.away.short
          }
          hit={firstGoalHit}
          amharic={amharic}
        />
      </div>
    </article>
  );
}

function ScoreRow({
  team,
  goals,
  won,
}: {
  team: { name: string; logo: string };
  goals: number;
  won: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={team.logo} alt="" width={20} height={20} className="size-5 object-contain" />
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-[15px] ${
          won ? "font-bold" : "font-medium text-muted-foreground"
        }`}
      >
        {team.name}
      </span>
      <span
        className={`shrink-0 font-mono text-xl tnum ${
          won ? "font-bold" : "font-semibold text-muted-foreground"
        }`}
      >
        {goals}
      </span>
    </div>
  );
}

function Verdict({
  label,
  value,
  hit,
  amharic,
}: {
  label: string;
  value: string;
  // Null means there was nothing to grade, such as a goalless match.
  hit: boolean | null;
  amharic: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div
          className={`text-[10px] font-semibold uppercase tracking-wider text-subtle ${
            amharic ? "amharic normal-case tracking-normal" : ""
          }`}
        >
          {label}
        </div>
        <div className="mt-1 truncate text-sm font-bold">{value}</div>
      </div>

      {hit !== null && (
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full ${
            hit ? "bg-home/15 text-home" : "bg-away/15 text-away"
          }`}
        >
          {hit ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
        </span>
      )}
    </div>
  );
}
