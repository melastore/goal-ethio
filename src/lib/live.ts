"use client";

// Polls for scores while matches are on.
//
// Two sources, in order of how fresh they are. The worker (worker/index.js) is
// a real feed and answers in seconds; without one configured this falls back to
// live.json, which only changes when the refresh workflow redeploys. Both carry
// the same shape, so the page does not care which it got.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MatchView } from "@/lib/view";

export type LiveScore = {
  id: number;
  status: "scheduled" | "live" | "finished";
  minute: number | null;
  period: string | null;
  goalsHome: number;
  goalsAway: number;
  halfHome: number | null;
  halfAway: number | null;
};

export type LiveState = {
  scores: Map<number, LiveScore>;
  // Null until the first answer comes back.
  checkedAt: Date | null;
  loading: boolean;
  failed: boolean;
  // True when a real feed is wired up rather than the redeploy fallback.
  direct: boolean;
  refresh: () => void;
};

const basePath = () => process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const liveUrl = () => process.env.NEXT_PUBLIC_LIVE_URL?.trim() || "";

// While something is in play. A worker answers from cache, so this costs the
// upstream nothing.
const LIVE_INTERVAL = 25_000;

// While a kickoff is near but nothing has started.
const IDLE_INTERVAL = 120_000;

// A match can be on the page before its feed entry appears, and can run past
// ninety. This window decides when polling is worth doing at all.
const BEFORE_KICKOFF_MS = 10 * 60 * 1000;
const AFTER_KICKOFF_MS = 165 * 60 * 1000;

function parseWorker(payload: unknown): LiveScore[] {
  const matches = (payload as { matches?: unknown })?.matches;
  if (!Array.isArray(matches)) return [];

  return matches.flatMap((row): LiveScore[] => {
    const m = row as Partial<LiveScore>;
    if (typeof m.id !== "number") return [];
    return [
      {
        id: m.id,
        status: m.status === "live" || m.status === "finished" ? m.status : "scheduled",
        minute: typeof m.minute === "number" ? m.minute : null,
        period: typeof m.period === "string" ? m.period : null,
        goalsHome: m.goalsHome ?? 0,
        goalsAway: m.goalsAway ?? 0,
        halfHome: m.halfHome ?? null,
        halfAway: m.halfAway ?? null,
      },
    ];
  });
}

// Whether any match on the page is close enough to kickoff to be worth asking
// about. Polling a page of next Saturday's fixtures helps nobody.
function windowOpen(matches: MatchView[], now: number): boolean {
  return matches.some((match) => {
    if (match.isLive) return true;
    if (match.finished) return false;
    const kickoff = new Date(match.kickoff).getTime();
    if (!Number.isFinite(kickoff)) return false;
    return now >= kickoff - BEFORE_KICKOFF_MS && now <= kickoff + AFTER_KICKOFF_MS;
  });
}

export function useLive(matches: MatchView[]): LiveState {
  const [scores, setScores] = useState<Map<number, LiveScore>>(new Map());
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const direct = liveUrl() !== "";
  // A poll in flight when the next tick comes round would stack requests.
  const inFlight = useRef(false);

  const anyLive = useMemo(
    () => matches.some((match) => match.isLive) || [...scores.values()].some((s) => s.status === "live"),
    [matches, scores]
  );

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);

    const url = direct ? liveUrl() : `${basePath()}/live.json`;

    try {
      const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(String(response.status));

      const payload: unknown = await response.json();
      const rows = parseWorker(payload);

      setScores(new Map(rows.map((row) => [row.id, row])));
      setFailed(false);
      setCheckedAt(new Date());
    } catch {
      // Keep whatever was on screen: a dropped poll is not a reason to blank
      // the scores.
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [direct]);

  useEffect(() => {
    if (!windowOpen(matches, Date.now())) return;

    refresh();
    const interval = setInterval(() => {
      // Nothing changes in a background tab that the next foreground poll will
      // not pick up, and phones throttle timers there anyway.
      if (document.visibilityState !== "visible") return;
      if (!windowOpen(matches, Date.now())) return;
      refresh();
    }, anyLive ? LIVE_INTERVAL : IDLE_INTERVAL);

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [matches, anyLive, refresh]);

  return { scores, checkedAt, loading, failed, direct, refresh };
}

// The match as it now stands, or the match unchanged when nothing has come in.
export function applyScore(match: MatchView, score: LiveScore | undefined): MatchView {
  if (!score) return match;

  return {
    ...match,
    status: score.status,
    isLive: score.status === "live",
    finished: score.status === "finished",
    result: {
      goalsHome: score.goalsHome,
      goalsAway: score.goalsAway,
      halfHome: score.halfHome,
      halfAway: score.halfAway,
      firstGoal: match.result?.firstGoal ?? null,
      firstGoalMinute: match.result?.firstGoalMinute ?? null,
      firstScorer: match.result?.firstScorer ?? null,
      minute: score.minute,
      period: score.period,
    },
  };
}
