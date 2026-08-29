"use client";

import { Check, X } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { percent } from "@/lib/format";
import { readKickoff } from "@/lib/ethiopian-date";
import { leagueById } from "@/lib/leagues";
import type { Graded } from "@/lib/scoring";

export function ResultCard({ graded }: { graded: Graded }) {
  const { t, language } = useLanguage();
  const { fixture, result, projection, actual, predicted } = graded;

  const kickoff = readKickoff(fixture.kickoff);
  const league = leagueById(fixture.leagueId);
  const home = fixture.home.team;
  const away = fixture.away.team;

  const name = (pick: typeof actual) =>
    pick === "draw" ? t("card.draw") : pick === "home" ? home.short : away.short;

  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs">
        <span className="truncate text-muted-foreground">
          {language === "am" ? league?.amharic : league?.name}
        </span>
        <span className="shrink-0 text-muted-foreground/70">
          {language === "am" ? kickoff.ethiopianDateAmharic : kickoff.ethiopianDate}
        </span>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <ScoreRow name={home.name} logo={home.logo} goals={result.goalsHome} won={actual === "home"} />
          <ScoreRow name={away.name} logo={away.logo} goals={result.goalsAway} won={actual === "away"} />
        </div>
      </div>

      {result.firstGoal && (
        <div className="border-t px-4 py-2 text-xs">
          <span className="text-muted-foreground">{t("results.firstScorer")}: </span>
          <span className="font-medium">
            {result.firstGoal === "home" ? home.short : away.short}
          </span>
          {result.firstScorer && (
            <span className="text-muted-foreground"> · {result.firstScorer}</span>
          )}
          {result.firstGoalMinute !== null && (
            <span className="font-mono text-muted-foreground"> {result.firstGoalMinute}&apos;</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-px border-t bg-border text-xs">
        <Verdict
          label={t("results.predicted")}
          value={`${name(predicted)} ${percent(projection.outcome[predicted])}`}
          hit={graded.outcomeHit}
        />
        <Verdict
          label={t("results.firstGoalHits")}
          value={
            graded.firstGoalHit === null
              ? t("card.neither")
              : projection.firstGoal.home >= projection.firstGoal.away
                ? home.short
                : away.short
          }
          hit={graded.firstGoalHit}
        />
      </div>
    </article>
  );
}

function ScoreRow({
  name,
  logo,
  goals,
  won,
}: {
  name: string;
  logo: string;
  goals: number;
  won: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="" width={20} height={20} className="size-5 object-contain" />
      <span className={`flex-1 truncate text-sm ${won ? "font-semibold" : "font-medium"}`}>
        {name}
      </span>
      <span className="font-mono text-lg font-semibold tabular-nums">{goals}</span>
    </div>
  );
}

function Verdict({
  label,
  value,
  hit,
}: {
  label: string;
  value: string;
  // Null means there was nothing to grade, such as a goalless match.
  hit: boolean | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-card px-4 py-2">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="truncate font-medium">{value}</div>
      </div>
      {hit !== null &&
        (hit ? (
          <Check className="size-4 shrink-0 text-[var(--home)]" />
        ) : (
          <X className="size-4 shrink-0 text-[var(--away)]" />
        ))}
    </div>
  );
}
