"use client";

import { useEffect, useState } from "react";

import { useLanguage } from "@/components/providers/language-provider";
import { pastDate } from "@/lib/ethiopian-date";
import type { H2HMatch, PastMatch, Venue } from "@/lib/types";

export type FixtureDetail = {
  id: number;
  homeId: number;
  awayId: number;
  home: PastMatch[];
  away: PastMatch[];
  h2h: H2HMatch[];
};

// The base path Pages serves the site from, baked in at build time the same way
// the rest of the export is.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// One fixture's rows are fetched at most once per page load, however many times
// its tab is opened and closed.
const cache = new Map<number, FixtureDetail>();

export function useFixtureDetail(id: number) {
  const [detail, setDetail] = useState<FixtureDetail | null>(() => cache.get(id) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const known = cache.get(id);
    if (known) {
      setDetail(known);
      return;
    }

    let live = true;
    setFailed(false);

    fetch(`${BASE}/detail/${id}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((body: FixtureDetail) => {
        cache.set(id, body);
        if (live) setDetail(body);
      })
      .catch(() => {
        if (live) setFailed(true);
      });

    return () => {
      live = false;
    };
  }, [id]);

  return { detail, failed };
}

const RESULT_TONE = {
  W: "bg-home text-white",
  D: "bg-muted text-muted-foreground",
  L: "bg-away text-white",
} as const;

type Outcome = keyof typeof RESULT_TONE;

const outcomeOf = (forGoals: number, againstGoals: number): Outcome =>
  forGoals > againstGoals ? "W" : forGoals === againstGoals ? "D" : "L";

function Pill({ outcome }: { outcome: Outcome }) {
  return (
    <span
      className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] text-[10px] font-bold ${RESULT_TONE[outcome]}`}
    >
      {outcome}
    </span>
  );
}

/** A team's own match: opponent, where it was played, and how it went. */
function FormRow({ match, reference }: { match: PastMatch; reference: string }) {
  const { language } = useLanguage();
  const amharic = language === "am";
  const date = pastDate(match.kickoff, reference);
  const half =
    match.halfFor === null || match.halfAgainst === null
      ? null
      : `${match.halfFor}-${match.halfAgainst}`;

  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <Pill outcome={outcomeOf(match.goalsFor, match.goalsAgainst)} />

      <span
        className={`w-[62px] shrink-0 truncate text-[11px] text-subtle ${amharic ? "amharic" : ""}`}
        title={date.gregorian}
      >
        {amharic ? date.amharic : date.label}
      </span>

      <span className="grid size-[18px] shrink-0 place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={match.opponentLogo} alt="" width={16} height={16} className="size-4 object-contain" />
      </span>

      <span className="min-w-0 flex-1 truncate text-[12px]">{match.opponentName}</span>

      {match.competition && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {match.competition}
        </span>
      )}

      <span className="shrink-0 font-mono text-[12px] font-semibold tnum">
        {match.goalsFor}-{match.goalsAgainst}
      </span>

      <span className="w-[34px] shrink-0 text-right font-mono text-[10px] tnum text-subtle">
        {half ? `(${half})` : ""}
      </span>
    </li>
  );
}

/** A past meeting, told from the coming fixture's home side. */
function MeetingRow({
  meeting,
  homeTeamId,
  reference,
}: {
  meeting: H2HMatch;
  homeTeamId: number;
  reference: string;
}) {
  const { language } = useLanguage();
  const amharic = language === "am";
  const date = pastDate(meeting.kickoff, reference);
  // Either side can have been at home that day, and which one is the point.
  const wasHome = meeting.homeId === homeTeamId;
  const forHome = wasHome ? meeting.goalsHome : meeting.goalsAway;
  const forAway = wasHome ? meeting.goalsAway : meeting.goalsHome;

  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <Pill outcome={outcomeOf(forHome, forAway)} />

      <span
        className={`w-[62px] shrink-0 truncate text-[11px] text-subtle ${amharic ? "amharic" : ""}`}
        title={date.gregorian}
      >
        {amharic ? date.amharic : date.label}
      </span>

      <span className="min-w-0 flex-1 truncate text-[12px]">
        <span className={wasHome ? "font-semibold" : ""}>{meeting.home}</span>
        <span className="px-1 text-subtle">v</span>
        <span className={wasHome ? "" : "font-semibold"}>{meeting.away}</span>
      </span>

      {meeting.competition && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {meeting.competition}
        </span>
      )}

      <span className="shrink-0 font-mono text-[12px] font-semibold tnum">
        {meeting.goalsHome}-{meeting.goalsAway}
      </span>

      <span className="w-[34px] shrink-0 text-right font-mono text-[10px] tnum text-subtle">
        {meeting.halfHome === null || meeting.halfAway === null
          ? ""
          : `(${meeting.halfHome}-${meeting.halfAway})`}
      </span>
    </li>
  );
}

export function MeetingList({
  meetings,
  homeTeamId,
  reference,
}: {
  meetings: H2HMatch[];
  homeTeamId: number;
  reference: string;
}) {
  return (
    <ul className="divide-y divide-hairline/60">
      {meetings.map((meeting) => (
        <MeetingRow
          key={meeting.fixtureId}
          meeting={meeting}
          homeTeamId={homeTeamId}
          reference={reference}
        />
      ))}
    </ul>
  );
}

export function FormList({
  matches,
  venue,
  reference,
}: {
  matches: PastMatch[];
  venue: Venue;
  reference: string;
}) {
  const at = matches.filter((match) => match.venue === venue);

  return (
    <ul className="divide-y divide-hairline/60">
      {at.map((match) => (
        <FormRow key={match.fixtureId} match={match} reference={reference} />
      ))}
    </ul>
  );
}

/** Placeholder rows, so opening the tab does not shift the card's height. */
export function RowSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="divide-y divide-hairline/60">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-2.5 py-1.5">
          <span className="size-[18px] shrink-0 animate-pulse rounded-[5px] bg-muted" />
          <span className="h-3 flex-1 animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}
