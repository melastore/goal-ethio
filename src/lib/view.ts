// The compact shape the pages hand to the browser.
//
// A projection carries a few hundred numbers and there are four hundred
// fixtures, so the raw objects would be megabytes of RSC payload. Probabilities
// are rounded to four places, which is three more than anything on screen uses,
// and the eight raw form matches are dropped: the summaries the projection
// already holds say everything the cards show.

import { readMatch, type Note } from "@/lib/read";
import type { Board, Line } from "@/lib/markets";
import type { FormSummary, Projection } from "@/lib/model";
import type { Fixture, Result, Team } from "@/lib/types";

const r = (value: number) => Math.round(value * 1e4) / 1e4;
const line = (l: Line): Line => ({ line: l.line, over: r(l.over), under: r(l.under) });

export type MatchView = {
  id: number;
  leagueId: number;
  kickoff: string;
  finished: boolean;
  home: Team;
  away: Team;
  result: Result | null;
  notes: Note[];
  p: {
    lambdaHome: number;
    lambdaAway: number;
    outcome: { home: number; draw: number; away: number };
    firstGoal: { home: number; away: number; none: number; expectedMinute: number };
    scorelines: { home: number; away: number; probability: number }[];
    confidence: "thin" | "fair" | "solid";
    homeForm: { overall: FormSummary; venue: FormSummary };
    awayForm: { overall: FormSummary; venue: FormSummary };
    board: Board;
  };
};

const compactBoard = (board: Board): Board => ({
  totals: board.totals.map(line),
  homeGoals: board.homeGoals.map(line),
  awayGoals: board.awayGoals.map(line),
  doubleChance: {
    homeOrDraw: r(board.doubleChance.homeOrDraw),
    homeOrAway: r(board.doubleChance.homeOrAway),
    drawOrAway: r(board.doubleChance.drawOrAway),
  },
  handicaps: board.handicaps.map((h) => ({
    goals: h.goals,
    homeGives: r(h.homeGives),
    awayGives: r(h.awayGives),
  })),
  cleanSheets: {
    home: r(board.cleanSheets.home),
    away: r(board.cleanSheets.away),
    homeWinToNil: r(board.cleanSheets.homeWinToNil),
    awayWinToNil: r(board.cleanSheets.awayWinToNil),
  },
  oddEven: { odd: r(board.oddEven.odd), even: r(board.oddEven.even) },
  halfTime: {
    result: {
      home: r(board.halfTime.result.home),
      draw: r(board.halfTime.result.draw),
      away: r(board.halfTime.result.away),
    },
    totals: board.halfTime.totals.map(line),
    share: r(board.halfTime.share),
  },
});

export function toView(fixture: Fixture, projection: Projection): MatchView {
  return {
    id: fixture.id,
    leagueId: fixture.leagueId,
    kickoff: fixture.kickoff,
    finished: fixture.status === "finished",
    home: fixture.home.team,
    away: fixture.away.team,
    result: fixture.result,
    notes: readMatch({
      projection,
      homeName: fixture.home.team.short,
      awayName: fixture.away.team.short,
    }),
    p: {
      lambdaHome: r(projection.lambdaHome),
      lambdaAway: r(projection.lambdaAway),
      outcome: {
        home: r(projection.outcome.home),
        draw: r(projection.outcome.draw),
        away: r(projection.outcome.away),
      },
      firstGoal: {
        home: r(projection.firstGoal.home),
        away: r(projection.firstGoal.away),
        none: r(projection.firstGoal.none),
        expectedMinute: Math.round(projection.firstGoal.expectedMinute),
      },
      scorelines: projection.scorelines.map((s) => ({
        home: s.home,
        away: s.away,
        probability: r(s.probability),
      })),
      confidence: projection.confidence,
      homeForm: projection.homeForm,
      awayForm: projection.awayForm,
      board: compactBoard(projection.board),
    },
  };
}

// The clearest read is the one whose top outcome clears the next by most.
export const margin = (match: MatchView) => {
  const { home, draw, away } = match.p.outcome;
  const sorted = [home, draw, away].sort((a, b) => b - a);
  return sorted[0] - sorted[1];
};

export const leanOf = (match: MatchView): "home" | "draw" | "away" => {
  const { home, draw, away } = match.p.outcome;
  const top = Math.max(home, draw, away);
  return top === home ? "home" : top === draw ? "draw" : "away";
};
