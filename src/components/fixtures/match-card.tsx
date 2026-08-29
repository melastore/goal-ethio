"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { FormStrip } from "@/components/fixtures/form-strip";
import { KickoffTime } from "@/components/fixtures/kickoff-time";
import { OutcomeBar } from "@/components/fixtures/outcome-bar";
import { useLanguage } from "@/components/providers/language-provider";
import { goals, minute, odds, percent, rate } from "@/lib/format";
import { readKickoff } from "@/lib/ethiopian-date";
import { leagueById } from "@/lib/leagues";
import { lean, type Projection } from "@/lib/model";
import type { Fixture } from "@/lib/types";

const CONFIDENCE_KEY = {
  thin: "confidence.thin",
  fair: "confidence.fair",
  solid: "confidence.solid",
} as const;

const CONFIDENCE_TONE = {
  thin: "bg-muted text-muted-foreground",
  fair: "bg-[var(--draw)]/20 text-foreground",
  solid: "bg-[var(--home)]/15 text-foreground",
} as const;

type Props = {
  fixture: Fixture;
  projection: Projection;
};

export function MatchCard({ fixture, projection }: Props) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);

  const kickoff = readKickoff(fixture.kickoff);
  const league = leagueById(fixture.leagueId);
  const picked = lean(projection.outcome);
  const first = projection.firstGoal;

  const home = fixture.home.team;
  const away = fixture.away.team;

  const leanLabel =
    picked.pick === "draw"
      ? t("card.draw")
      : picked.pick === "home"
        ? home.short
        : away.short;

  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-muted-foreground">
            {language === "am" ? league?.amharic : league?.name}
          </div>
          <div className="truncate text-[11px] text-muted-foreground/70">
            {language === "am" ? kickoff.ethiopianDateAmharic : kickoff.ethiopianDate}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_TONE[projection.confidence]}`}
        >
          {t(CONFIDENCE_KEY[projection.confidence])}
        </span>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <TeamRow name={home.name} logo={home.logo} />
          <TeamRow name={away.name} logo={away.logo} />
        </div>
        <KickoffTime kickoff={kickoff} />
      </div>

      <div className="px-4 pb-3">
        <OutcomeBar
          outcome={projection.outcome}
          homeLabel={home.short}
          awayLabel={away.short}
          drawLabel={t("card.draw")}
        />
      </div>

      <div className="grid grid-cols-2 gap-px border-t bg-border text-xs">
        <Cell label={t("card.lean")}>
          <span className="font-semibold">{leanLabel}</span>
          <span className="ml-1.5 font-mono text-muted-foreground">
            {odds(picked.probability)}
          </span>
        </Cell>
        <Cell label={t("card.firstGoal")}>
          <span className="font-semibold">
            {first.home >= first.away ? home.short : away.short}
          </span>
          <span className="ml-1.5 font-mono text-muted-foreground">
            {percent(Math.max(first.home, first.away))}
          </span>
        </Cell>
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1 border-t py-2 text-xs text-muted-foreground transition hover:text-foreground"
      >
        {t("card.form")}
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-3">
          <div className="space-y-1.5">
            <FormStrip label={home.short} summary={projection.homeForm.overall} />
            <FormStrip label={t("card.homeForm")} summary={projection.homeForm.venue} />
            <FormStrip label={away.short} summary={projection.awayForm.overall} />
            <FormStrip label={t("card.awayForm")} summary={projection.awayForm.venue} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3 text-xs">
            <Stat label={t("card.expected")}>
              {goals(projection.lambdaHome)} - {goals(projection.lambdaAway)}
            </Stat>
            <Stat label={t("card.openingGoal")}>{minute(first.expectedMinute)}</Stat>
            <Stat label={t("card.btts")}>{percent(projection.markets.btts)}</Stat>
            <Stat label={t("card.over")}>{percent(projection.markets.overTwoFive)}</Stat>
            <Stat label={`${home.short} ${t("card.scoredFirstRate")}`}>
              {rate(projection.homeForm.venue.scoredFirst, projection.homeForm.venue.decided)}
            </Stat>
            <Stat label={`${away.short} ${t("card.scoredFirstRate")}`}>
              {rate(projection.awayForm.venue.scoredFirst, projection.awayForm.venue.decided)}
            </Stat>
          </dl>

          <div className="border-t pt-3">
            <div className="mb-1.5 text-xs text-muted-foreground">
              {t("card.scorelines")}
            </div>
            <div className="flex gap-2">
              {projection.scorelines.map((line) => (
                <div
                  key={`${line.home}-${line.away}`}
                  className="flex-1 rounded-md bg-muted px-2 py-1.5 text-center"
                >
                  <div className="font-mono text-sm font-semibold">
                    {line.home}-{line.away}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {percent(line.probability)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function TeamRow({ name, logo }: { name: string; logo: string }) {
  return (
    <div className="flex items-center gap-2">
      {/* Remote crests, and the export is unoptimised, so a plain img is right. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="" width={20} height={20} className="size-5 object-contain" />
      <span className="truncate text-sm font-medium">{name}</span>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className="shrink-0 font-mono font-medium tabular-nums">{children}</dd>
    </div>
  );
}
