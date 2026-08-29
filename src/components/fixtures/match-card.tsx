"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { FormStrip } from "@/components/fixtures/form-strip";
import { GoalsBoard, HalvesBoard } from "@/components/fixtures/market-board";
import { OutcomeBar } from "@/components/fixtures/outcome-bar";
import { useLanguage } from "@/components/providers/language-provider";
import { goals, minute, odds, percent, rate } from "@/lib/format";
import { readKickoff } from "@/lib/ethiopian-date";
import { leagueById } from "@/lib/leagues";
import { noteText } from "@/lib/note-text";
import type { MatchView } from "@/lib/view";
import { leanOf } from "@/lib/view";

const CONFIDENCE = {
  solid: { key: "confidence.solid" as const, dot: "var(--home)" },
  fair: { key: "confidence.fair" as const, dot: "var(--draw)" },
  thin: { key: "confidence.thin" as const, dot: "var(--subtle)" },
};

const TABS = ["read", "goals", "halves", "form"] as const;
type Tab = (typeof TABS)[number];

const NOTE_TONE = {
  home: "var(--home)",
  away: "var(--away)",
  neutral: "var(--draw)",
  caution: "var(--subtle)",
} as const;

export function MatchCard({ match, rank }: { match: MatchView; rank?: number }) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("read");

  const amharic = language === "am";
  const kickoff = readKickoff(match.kickoff);
  const league = leagueById(match.leagueId);
  const p = match.p;
  const pick = leanOf(match);
  const confidence = CONFIDENCE[p.confidence];

  const leanLabel =
    pick === "draw" ? t("card.draw") : pick === "home" ? match.home.short : match.away.short;
  const leanValue = p.outcome[pick];
  const firstSide = p.firstGoal.home >= p.firstGoal.away ? match.home : match.away;

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-[18px] border bg-card transition-all duration-300 ${
        open
          ? "border-primary/30 shadow-[var(--shadow-lift)]"
          : "border-hairline shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-lift)]"
      }`}
    >
      <div className="flex items-center gap-2 px-4 pt-3.5">
        {rank !== undefined && (
          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-primary font-mono text-[11px] font-bold text-primary-foreground">
            {rank}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${
            amharic ? "amharic normal-case tracking-normal" : ""
          }`}
        >
          {amharic ? league?.amharic : league?.name}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: confidence.dot }} />
          <span className={`text-[11px] text-muted-foreground ${amharic ? "amharic" : ""}`}>
            {t(confidence.key)}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-4 px-4 py-3.5">
        <div className="min-w-0 flex-1 space-y-2.5">
          <TeamRow team={match.home} chance={p.outcome.home} winning={pick === "home"} />
          <TeamRow team={match.away} chance={p.outcome.away} winning={pick === "away"} />
        </div>

        <div className="shrink-0 border-l border-hairline pl-4 text-right leading-none">
          <div className="font-mono text-[22px] font-bold tnum">{kickoff.ethiopianClock}</div>
          <div className="amharic mt-1 text-[11px] text-muted-foreground">
            {kickoff.periodAmharic}
          </div>
          <div className="mt-2 font-mono text-[11px] tnum text-subtle">{kickoff.eatTime}</div>
          <div className={`mt-1 text-[10px] text-subtle ${amharic ? "amharic" : ""}`}>
            {amharic ? kickoff.weekday.amharic : kickoff.weekday.label.slice(0, 3)}{" "}
            {kickoff.ethiopian.day}
          </div>
        </div>
      </div>

      <div className="px-4 pb-3.5">
        <OutcomeBar
          outcome={p.outcome}
          homeLabel={match.home.short}
          awayLabel={match.away.short}
          drawLabel={t("card.draw")}
        />
      </div>

      <div className="grid grid-cols-2 divide-x divide-hairline border-t border-hairline">
        <Headline label={t("card.lean")} value={leanLabel} detail={odds(leanValue)} amharic={amharic} />
        <Headline
          label={t("card.firstGoal")}
          value={firstSide.short}
          detail={percent(Math.max(p.firstGoal.home, p.firstGoal.away))}
          amharic={amharic}
        />
      </div>

      {/* The leading note is the card's one-line case, visible without opening. */}
      {match.notes[0] && !open && (
        <div className="flex items-start gap-2 border-t border-hairline px-4 py-2.5">
          <span
            className="mt-1.5 size-1.5 shrink-0 rounded-full"
            style={{ background: NOTE_TONE[match.notes[0].tone] }}
          />
          <p className={`text-xs leading-relaxed text-muted-foreground ${amharic ? "amharic" : ""}`}>
            {noteText(match.notes[0], language)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`mt-auto flex w-full items-center justify-center gap-1.5 border-t border-hairline py-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground ${
          amharic ? "amharic" : ""
        }`}
      >
        {open ? t("filter.clear") : t("tab.read")}
        <ChevronDown
          className={`size-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-hairline bg-elevated">
          <div className="flex gap-1 border-b border-hairline px-3 py-2">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                  tab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                } ${amharic ? "amharic" : ""}`}
              >
                {t(`tab.${id}` as const)}
              </button>
            ))}
          </div>

          <div className="px-4 py-4">
            {tab === "read" && <ReadPanel match={match} />}
            {tab === "goals" && <GoalsBoard match={match} />}
            {tab === "halves" && <HalvesBoard match={match} />}
            {tab === "form" && <FormPanel match={match} />}
          </div>
        </div>
      )}
    </article>
  );
}

function ReadPanel({ match }: { match: MatchView }) {
  const { t, language } = useLanguage();
  const amharic = language === "am";
  const p = match.p;

  return (
    <div className="space-y-4">
      <ul className="space-y-2.5">
        {match.notes.map((note, index) => (
          <li key={index} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full"
              style={{ background: NOTE_TONE[note.tone] }}
            />
            <span className={`text-[13px] leading-relaxed ${amharic ? "amharic" : ""}`}>
              {noteText(note, language)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-2 border-t border-hairline pt-3.5 text-xs">
        <Stat label={t("card.expected")} amharic={amharic}>
          {goals(p.lambdaHome)} - {goals(p.lambdaAway)}
        </Stat>
        <Stat label={t("card.openingGoal")} amharic={amharic}>
          {minute(p.firstGoal.expectedMinute)}
        </Stat>
        <Stat label={t("card.btts")} amharic={amharic}>
          {percent(1 - p.board.cleanSheets.home - p.board.cleanSheets.away + p.board.totals[0].under)}
        </Stat>
        <Stat label={`${t("market.over")} 2.5`} amharic={amharic}>
          {percent(p.board.totals[2].over)}
        </Stat>
      </dl>

      <div className="border-t border-hairline pt-3.5">
        <div className={`mb-2 text-xs text-muted-foreground ${amharic ? "amharic" : ""}`}>
          {t("card.scorelines")}
        </div>
        <div className="flex gap-2">
          {p.scorelines.map((line) => (
            <div
              key={`${line.home}-${line.away}`}
              className="flex-1 rounded-xl bg-muted py-2.5 text-center transition hover:bg-muted/70"
            >
              <div className="font-mono text-base font-bold tnum">
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
  );
}

function FormPanel({ match }: { match: MatchView }) {
  const { t } = useLanguage();
  const p = match.p;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FormStrip label={match.home.short} summary={p.homeForm.overall} />
        <FormStrip label={t("card.homeForm")} summary={p.homeForm.venue} emphasis />
        <div className="h-1.5" />
        <FormStrip label={match.away.short} summary={p.awayForm.overall} />
        <FormStrip label={t("card.awayForm")} summary={p.awayForm.venue} emphasis />
      </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-2 border-t border-hairline pt-3.5 text-xs">
        <Stat label={`${match.home.short} · ${t("card.scoredFirstRate")}`} amharic={false}>
          {rate(p.homeForm.venue.scoredFirst, p.homeForm.venue.decided)}
        </Stat>
        <Stat label={`${match.away.short} · ${t("card.scoredFirstRate")}`} amharic={false}>
          {rate(p.awayForm.venue.scoredFirst, p.awayForm.venue.decided)}
        </Stat>
      </dl>
    </div>
  );
}

function TeamRow({
  team,
  chance,
  winning,
}: {
  team: { name: string; short: string; logo: string };
  chance: number;
  winning: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted">
        {/* Remote crests, and the export is unoptimised, so a plain img is right. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={team.logo} alt="" width={20} height={20} className="size-5 object-contain" />
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-[15px] ${winning ? "font-bold" : "font-semibold"}`}
      >
        {team.name}
      </span>
      <span
        className={`shrink-0 font-mono text-sm tnum ${
          winning ? "font-bold text-foreground" : "text-muted-foreground"
        }`}
      >
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
        className={`text-[10px] font-semibold uppercase tracking-wider text-subtle ${
          amharic ? "amharic normal-case tracking-normal" : ""
        }`}
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="truncate text-sm font-bold">{value}</span>
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
