"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { FormStrip } from "@/components/fixtures/form-strip";
import { OutcomeBar } from "@/components/fixtures/outcome-bar";
import { useLanguage } from "@/components/providers/language-provider";
import { goals, minute, odds, percent, rate } from "@/lib/format";
import { readKickoff } from "@/lib/ethiopian-date";
import { leagueById } from "@/lib/leagues";
import { lean, type Projection } from "@/lib/model";
import type { Fixture } from "@/lib/types";

const CONFIDENCE = {
  solid: { key: "confidence.solid", tone: "text-home" },
  fair: { key: "confidence.fair", tone: "text-draw" },
  thin: { key: "confidence.thin", tone: "text-subtle" },
} as const;

type Props = {
  fixture: Fixture;
  projection: Projection;
  /** Position in the week's picks, shown as a rank on the featured cards. */
  rank?: number;
};

export function MatchCard({ fixture, projection, rank }: Props) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);

  const amharic = language === "am";
  const kickoff = readKickoff(fixture.kickoff);
  const league = leagueById(fixture.leagueId);
  const picked = lean(projection.outcome);
  const first = projection.firstGoal;
  const confidence = CONFIDENCE[projection.confidence];

  const home = fixture.home.team;
  const away = fixture.away.team;

  const leanLabel =
    picked.pick === "draw" ? t("card.draw") : picked.pick === "home" ? home.short : away.short;

  return (
    <article className="overflow-hidden rounded-[16px] border border-hairline bg-card shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-2 px-4 pt-3">
        {rank !== undefined && (
          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-primary font-mono text-[11px] font-bold text-primary-foreground">
            {rank}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${
            amharic ? "amharic normal-case tracking-normal" : ""
          }`}
        >
          {amharic ? league?.amharic : league?.name}
        </span>
        <span className={`shrink-0 text-[11px] font-medium ${confidence.tone} ${amharic ? "amharic" : ""}`}>
          {t(confidence.key)}
        </span>
      </div>

      <div className="flex items-center gap-4 px-4 py-3.5">
        <div className="min-w-0 flex-1 space-y-2.5">
          <TeamRow team={home} chance={projection.outcome.home} />
          <TeamRow team={away} chance={projection.outcome.away} />
        </div>

        <div className="shrink-0 border-l border-hairline pl-4 text-right leading-none">
          <div className="font-mono text-[22px] font-bold tnum">{kickoff.ethiopianClock}</div>
          <div className="amharic mt-1 text-[11px] text-muted-foreground">
            {kickoff.periodAmharic}
          </div>
          <div className="mt-2 font-mono text-[11px] tnum text-subtle">{kickoff.eatTime}</div>
        </div>
      </div>

      <div className="px-4 pb-3.5">
        <OutcomeBar
          outcome={projection.outcome}
          homeLabel={home.short}
          awayLabel={away.short}
          drawLabel={t("card.draw")}
        />
      </div>

      <div className="grid grid-cols-2 divide-x divide-hairline border-t border-hairline">
        <Headline label={t("card.lean")} value={leanLabel} detail={odds(picked.probability)} amharic={amharic} />
        <Headline
          label={t("card.firstGoal")}
          value={first.home >= first.away ? home.short : away.short}
          detail={percent(Math.max(first.home, first.away))}
          amharic={amharic}
        />
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex w-full items-center justify-center gap-1.5 border-t border-hairline py-2.5 text-xs text-muted-foreground transition hover:bg-muted/50 hover:text-foreground ${
          amharic ? "amharic" : ""
        }`}
      >
        {t("card.form")}
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-hairline bg-elevated px-4 py-4">
          <div className="space-y-2">
            <FormStrip label={home.short} summary={projection.homeForm.overall} />
            <FormStrip label={t("card.homeForm")} summary={projection.homeForm.venue} emphasis />
            <div className="h-1" />
            <FormStrip label={away.short} summary={projection.awayForm.overall} />
            <FormStrip label={t("card.awayForm")} summary={projection.awayForm.venue} emphasis />
          </div>

          <dl className="grid grid-cols-2 gap-x-5 gap-y-2 border-t border-hairline pt-3.5 text-xs">
            <Stat label={t("card.expected")} amharic={amharic}>
              {goals(projection.lambdaHome)} - {goals(projection.lambdaAway)}
            </Stat>
            <Stat label={t("card.openingGoal")} amharic={amharic}>
              {minute(first.expectedMinute)}
            </Stat>
            <Stat label={t("card.btts")} amharic={amharic}>
              {percent(projection.markets.btts)}
            </Stat>
            <Stat label={t("card.over")} amharic={amharic}>
              {percent(projection.markets.overTwoFive)}
            </Stat>
            <Stat label={`${home.short} · ${t("card.scoredFirstRate")}`} amharic={amharic}>
              {rate(projection.homeForm.venue.scoredFirst, projection.homeForm.venue.decided)}
            </Stat>
            <Stat label={`${away.short} · ${t("card.scoredFirstRate")}`} amharic={amharic}>
              {rate(projection.awayForm.venue.scoredFirst, projection.awayForm.venue.decided)}
            </Stat>
          </dl>

          <div className="border-t border-hairline pt-3.5">
            <div className={`mb-2 text-xs text-muted-foreground ${amharic ? "amharic" : ""}`}>
              {t("card.scorelines")}
            </div>
            <div className="flex gap-2">
              {projection.scorelines.map((line) => (
                <div
                  key={`${line.home}-${line.away}`}
                  className="flex-1 rounded-[10px] bg-muted py-2 text-center"
                >
                  <div className="font-mono text-sm font-bold tnum">
                    {line.home}-{line.away}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] tnum text-muted-foreground">
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

function TeamRow({
  team,
  chance,
}: {
  team: { name: string; logo: string };
  chance: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted">
        {/* Remote crests, and the export is unoptimised, so a plain img is right. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={team.logo} alt="" width={20} height={20} className="size-5 object-contain" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{team.name}</span>
      <span className="shrink-0 font-mono text-sm tnum text-muted-foreground">
        {percent(chance)}
      </span>
    </div>
  );
}

function Headline({
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
    <div className="px-4 py-2.5">
      <div
        className={`text-[10px] font-medium uppercase tracking-wider text-subtle ${
          amharic ? "amharic normal-case tracking-normal" : ""
        }`}
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="truncate text-sm font-semibold">{value}</span>
        <span className="shrink-0 font-mono text-xs tnum text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  amharic,
  children,
}: {
  label: string;
  amharic: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className={`truncate text-muted-foreground ${amharic ? "amharic" : ""}`}>{label}</dt>
      <dd className="shrink-0 font-mono font-semibold tnum">{children}</dd>
    </div>
  );
}
