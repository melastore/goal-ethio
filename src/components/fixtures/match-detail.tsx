"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import {
  FormList,
  MeetingList,
  RowSkeleton,
  useFixtureDetail,
} from "@/components/fixtures/form-detail";
import { FormStrip } from "@/components/fixtures/form-strip";
import { GoalsBoard, HalvesBoard } from "@/components/fixtures/market-board";
import { OutcomeBar } from "@/components/fixtures/outcome-bar";
import { ValuePanel } from "@/components/fixtures/value-panel";
import { useLanguage } from "@/components/providers/language-provider";
import { readKickoff } from "@/lib/ethiopian-date";
import { goals, minute, percent, rate } from "@/lib/format";
import { leagueById } from "@/lib/leagues";
import { projectLive } from "@/lib/live-model";
import type { FormSummary } from "@/lib/model";
import { noteText } from "@/lib/note-text";
import { quoteText } from "@/lib/quote-text";
import type { H2HMatch, PastMatch, Venue } from "@/lib/types";
import type { MatchView } from "@/lib/view";

const TABS = ["read", "value", "goals", "halves", "form"] as const;
type Tab = (typeof TABS)[number];

const NOTE_TONE = {
  home: "var(--home)",
  away: "var(--away)",
  neutral: "var(--draw)",
  caution: "var(--subtle)",
} as const;

export function MatchDetail({ match, onClose }: { match: MatchView; onClose?: () => void }) {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>("read");
  const amharic = language === "am";

  const kickoff = readKickoff(match.kickoff);
  const league = leagueById(match.leagueId);
  const live = match.isLive && match.result;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[14px] border border-hairline bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3 border-b border-hairline px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-[10px] font-semibold uppercase tracking-wider text-subtle ${
              amharic ? "amharic normal-case tracking-normal" : ""
            }`}
          >
            {amharic ? league?.amharic : league?.name}
          </div>

          <div className="mt-2 space-y-1.5">
            <Team team={match.home} score={live ? match.result!.goalsHome : null} />
            <Team team={match.away} score={live ? match.result!.goalsAway : null} />
          </div>
        </div>

        <div className="shrink-0 text-right leading-none">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-live/12 px-2 py-1 font-mono text-[11px] font-bold text-live">
              <span className="size-1.5 rounded-full bg-live live-dot" />
              {match.result!.period === "HT"
                ? "HT"
                : match.result!.minute != null
                  ? `${match.result!.minute}'`
                  : "LIVE"}
            </span>
          ) : (
            <>
              <div className="font-mono text-[19px] font-bold tnum">{kickoff.ethiopianClock}</div>
              <div className="amharic mt-1 text-[10px] text-muted-foreground">
                {kickoff.periodAmharic}
              </div>
              <div className="mt-1.5 font-mono text-[10px] tnum text-subtle">{kickoff.eatTime}</div>
              <div className={`mt-0.5 text-[10px] text-subtle ${amharic ? "amharic" : ""}`}>
                {amharic ? kickoff.weekday.amharic : kickoff.weekday.label.slice(0, 3)}{" "}
                {kickoff.ethiopian.day}
              </div>
            </>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("detail.close")}
              className="mt-2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-hairline px-4 py-3">
        <OutcomeBar
          outcome={match.p.outcome}
          homeLabel={match.home.short}
          awayLabel={match.away.short}
          drawLabel={t("card.draw")}
        />
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-hairline px-3 py-2">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            } ${amharic ? "amharic" : ""}`}
          >
            {t(`tab.${id}` as const)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "read" && <ReadPanel match={match} />}
        {tab === "value" && <ValuePanel match={match} />}
        {tab === "goals" && <GoalsBoard match={match} />}
        {tab === "halves" && <HalvesBoard match={match} />}
        {tab === "form" && <FormPanel match={match} />}
      </div>
    </div>
  );
}

function Team({
  team,
  score,
}: {
  team: { name: string; short: string; logo: string };
  score: number | null;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={team.logo} alt="" width={22} height={22} className="size-[22px] shrink-0 object-contain" />
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{team.name}</span>
      {score !== null && (
        <span className="shrink-0 font-mono text-[20px] font-bold leading-none tnum">{score}</span>
      )}
    </div>
  );
}

function ReadPanel({ match }: { match: MatchView }) {
  const { t, language } = useLanguage();
  const amharic = language === "am";
  const p = match.p;

  const live = useMemo(() => {
    if (!match.isLive || !match.result) return null;
    return projectLive(
      p.lambdaHome,
      p.lambdaAway,
      {
        minute: match.result.minute ?? 0,
        goalsHome: match.result.goalsHome,
        goalsAway: match.result.goalsAway,
        period: match.result.period,
      },
      p.board.halfTime.share
    );
  }, [match.isLive, match.result, p]);

  return (
    <div className="space-y-4">
      {live && (
        <section className="rounded-xl border border-live/25 bg-live/[0.06] p-3">
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <h4 className={`text-[11px] font-bold uppercase tracking-wider text-live ${amharic ? "amharic normal-case tracking-normal" : ""}`}>
              {t("live.now")}
            </h4>
            <span className="font-mono text-[10px] tnum text-muted-foreground">
              {live.minutesLeft}′ {t("live.left")}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Live label={match.home.short} value={live.outcome.home} tone="var(--home)" />
            <Live label={t("card.draw")} value={live.outcome.draw} tone="var(--draw)" />
            <Live label={match.away.short} value={live.outcome.away} tone="var(--away)" />
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5 border-t border-live/15 pt-2.5 text-xs">
            <Stat label={t("live.nextGoal")} amharic={amharic}>
              {live.nextGoal.home >= live.nextGoal.away ? match.home.short : match.away.short}{" "}
              {percent(Math.max(live.nextGoal.home, live.nextGoal.away))}
            </Stat>
            <Stat label={t("live.stillExpected")} amharic={amharic}>
              {goals(live.remainingHome)} - {goals(live.remainingAway)}
            </Stat>
          </dl>
        </section>
      )}

      {match.standouts.length > 0 && (
        <section>
          <h4
            className={`mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle ${
              amharic ? "amharic normal-case tracking-normal" : ""
            }`}
          >
            {t("standout.title")}
          </h4>
          <div className="space-y-1.5">
            {match.standouts.map((entry) => (
              <div
                key={`${entry.key}${entry.values.join()}`}
                className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-2.5 py-1.5"
              >
                <span className={`min-w-0 truncate text-[12.5px] ${amharic ? "amharic" : ""}`}>
                  {quoteText(entry, language, match.home.short, match.away.short)}
                </span>
                <span className="shrink-0 font-mono text-[12px] font-bold tnum">
                  {percent(entry.probability)}
                  <span className="ml-1.5 font-normal text-value">
                    +{Math.round(entry.edge * 100)}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className={`mt-1.5 text-[10.5px] text-subtle ${amharic ? "amharic" : ""}`}>
            {t("standout.note")}
          </p>
        </section>
      )}

      <ul className="space-y-2.5 border-t border-hairline pt-3.5">
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
          {percent(p.board.btts.yes)}
        </Stat>
        <Stat label={`${t("market.over")} 2.5`} amharic={amharic}>
          {percent(p.board.totals[2].over)}
        </Stat>
        <Stat label={`${match.home.short} ${t("detail.rating")}`} amharic={amharic}>
          {p.homeRating.overall}
        </Stat>
        <Stat label={`${match.away.short} ${t("detail.rating")}`} amharic={amharic}>
          {p.awayRating.overall}
        </Stat>
      </dl>

      <FirstGoalCurve match={match} />

      <div className="border-t border-hairline pt-3.5">
        <div className={`mb-2 text-xs text-muted-foreground ${amharic ? "amharic" : ""}`}>
          {t("card.scorelines")}
        </div>
        <div className="flex gap-2">
          {p.scorelines.map((line) => (
            <div key={`${line.home}-${line.away}`} className="flex-1 rounded-xl bg-muted py-2.5 text-center">
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

function Live({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="font-mono text-lg font-bold leading-none tnum" style={{ color: tone }}>
        {percent(value)}
      </div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// The chance a goal has arrived by each quarter of an hour. Drawn rather than
// listed: the shape is the point, and it is not a straight line.
function FirstGoalCurve({ match }: { match: MatchView }) {
  const { t, language } = useLanguage();
  const points = match.p.firstGoal.byMinute;
  if (points.length === 0) return null;

  const width = 260;
  const height = 54;
  const all = [{ minute: 0, scored: 0 }, ...points, { minute: 90, scored: 1 - match.p.firstGoal.none }];
  const top = Math.max(...all.map((p) => p.scored), 0.05);

  const path = all
    .map((point, index) => {
      const x = (point.minute / 90) * width;
      const y = height - (point.scored / top) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="border-t border-hairline pt-3.5">
      <div className={`mb-2 text-xs text-muted-foreground ${language === "am" ? "amharic" : ""}`}>
        {t("detail.firstGoalBy")}
      </div>
      <svg viewBox={`0 0 ${width} ${height + 14}`} className="w-full" role="img" aria-label={t("detail.firstGoalBy")}>
        <path d={`${path} L${width} ${height} L0 ${height} Z`} fill="var(--draw)" opacity="0.12" />
        <path d={path} fill="none" stroke="var(--draw)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((point) => (
          <g key={point.minute}>
            <circle
              cx={(point.minute / 90) * width}
              cy={height - (point.scored / top) * height}
              r="2.5"
              fill="var(--draw)"
            />
            <text
              x={(point.minute / 90) * width}
              y={height + 11}
              textAnchor="middle"
              className="fill-[var(--subtle)] font-mono"
              fontSize="8.5"
            >
              {point.minute}′
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] tnum text-subtle">
        {points.map((point) => (
          <span key={point.minute}>{percent(point.scored)}</span>
        ))}
      </div>
    </div>
  );
}

function FormPanel({ match }: { match: MatchView }) {
  const { t, language } = useLanguage();
  const amharic = language === "am";
  const p = match.p;
  // Only the record is baked into the page; the rows behind it arrive here.
  const { detail, failed } = useFixtureDetail(match.id);

  return (
    <div className="space-y-5">
      <HeadToHead match={match} detail={detail} failed={failed} />

      <TeamForm
        heading={match.home.name}
        venueLabel={t("card.homeForm")}
        overall={p.homeForm.overall}
        venue={p.homeForm.venue}
        matches={detail?.home ?? null}
        at="home"
        reference={match.kickoff}
        failed={failed}
        amharic={amharic}
      />

      <TeamForm
        heading={match.away.name}
        venueLabel={t("card.awayForm")}
        overall={p.awayForm.overall}
        venue={p.awayForm.venue}
        matches={detail?.away ?? null}
        at="away"
        reference={match.kickoff}
        failed={failed}
        amharic={amharic}
      />

      <dl className="grid grid-cols-2 gap-x-5 gap-y-2 border-t border-hairline pt-3.5 text-xs">
        <Stat label={`${match.home.short} · ${t("card.scoredFirstRate")}`} amharic={amharic}>
          {rate(p.homeForm.venue.scoredFirst, p.homeForm.venue.decided)}
        </Stat>
        <Stat label={`${match.away.short} · ${t("card.scoredFirstRate")}`} amharic={amharic}>
          {rate(p.awayForm.venue.scoredFirst, p.awayForm.venue.decided)}
        </Stat>
        <Stat label={`${match.home.short} · ${t("detail.matchesBehind")}`} amharic={amharic}>
          {p.homeRating.sample.toFixed(1)}
        </Stat>
        <Stat label={`${match.away.short} · ${t("detail.matchesBehind")}`} amharic={amharic}>
          {p.awayRating.sample.toFixed(1)}
        </Stat>
      </dl>
    </div>
  );
}

function PanelHeading({ children, amharic }: { children: React.ReactNode; amharic: boolean }) {
  return (
    <h4
      className={`text-[10px] font-semibold uppercase tracking-wider text-subtle ${
        amharic ? "amharic normal-case tracking-normal" : ""
      }`}
    >
      {children}
    </h4>
  );
}

function HeadToHead({
  match,
  detail,
  failed,
}: {
  match: MatchView;
  detail: { homeId: number; h2h: H2HMatch[] } | null;
  failed: boolean;
}) {
  const { t, language } = useLanguage();
  const amharic = language === "am";
  const h2h = match.p.h2h;

  if (h2h.played === 0) {
    return (
      <section className="space-y-2">
        <PanelHeading amharic={amharic}>{t("card.h2h")}</PanelHeading>
        <p className={`text-xs text-muted-foreground ${amharic ? "amharic" : ""}`}>
          {t("card.h2hNone")}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <PanelHeading amharic={amharic}>{t("card.h2h")}</PanelHeading>
        <span className={`text-[11px] text-subtle ${amharic ? "amharic" : ""}`}>
          {h2h.played} {t("count.matches")}
        </span>
      </div>

      {/* Wins, draws, wins, in the same left-to-right order as the outcome bar. */}
      <div className="grid grid-cols-3 overflow-hidden rounded-xl bg-muted text-center">
        <Tally value={h2h.homeWins} label={match.home.short} tone="var(--home)" />
        <Tally value={h2h.draws} label={t("card.draw")} tone="var(--draw)" amharic={amharic} />
        <Tally value={h2h.awayWins} label={match.away.short} tone="var(--away)" />
      </div>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
        <Stat label={t("card.h2hGoals")} amharic={amharic}>
          {h2h.goalsHome}-{h2h.goalsAway}
        </Stat>
        <Stat label={t("card.h2hAtGround")} amharic={amharic}>
          {h2h.atThisVenue === 0 ? "-" : `${h2h.homeWinsAtThisVenue}/${h2h.atThisVenue}`}
        </Stat>
      </dl>

      {failed ? null : detail ? (
        <MeetingList meetings={detail.h2h} homeTeamId={detail.homeId} reference={match.kickoff} />
      ) : (
        <RowSkeleton rows={Math.min(h2h.played, 4)} />
      )}
    </section>
  );
}

function Tally({
  value,
  label,
  tone,
  amharic = false,
}: {
  value: number;
  label: string;
  tone: string;
  amharic?: boolean;
}) {
  return (
    <div className="py-2">
      <div className="font-mono text-lg font-bold tnum" style={{ color: tone }}>
        {value}
      </div>
      <div className={`truncate px-1 text-[10px] text-muted-foreground ${amharic ? "amharic" : ""}`}>
        {label}
      </div>
    </div>
  );
}

function TeamForm({
  heading,
  venueLabel,
  overall,
  venue,
  matches,
  at,
  reference,
  failed,
  amharic,
}: {
  heading: string;
  venueLabel: string;
  overall: FormSummary;
  venue: FormSummary;
  matches: PastMatch[] | null;
  at: Venue;
  reference: string;
  failed: boolean;
  amharic: boolean;
}) {
  const { t } = useLanguage();

  return (
    <section className="space-y-2 border-t border-hairline pt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <PanelHeading amharic={amharic}>{heading}</PanelHeading>
        <span className={`text-[11px] text-subtle ${amharic ? "amharic" : ""}`}>
          {venueLabel} · {venue.won}
          {t("card.w")} {venue.drawn}
          {t("card.d")} {venue.lost}
          {t("card.l")}
        </span>
      </div>

      {/* The last five outright, for a side that has only just come home. */}
      <FormStrip label={t("card.form")} summary={overall} />

      {failed ? (
        <p className={`text-xs text-muted-foreground ${amharic ? "amharic" : ""}`}>
          {t("card.detailFailed")}
        </p>
      ) : matches ? (
        <FormList matches={matches} venue={at} reference={reference} />
      ) : (
        <RowSkeleton rows={Math.max(venue.played, 1)} />
      )}
    </section>
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
