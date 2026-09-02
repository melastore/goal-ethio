// The compact shape the pages hand to the browser.
//
// A projection carries a few hundred numbers and there are four hundred
// fixtures, so the raw objects would be megabytes of RSC payload. Probabilities
// are rounded to four places, which is three more than anything on screen uses,
// and the raw form matches and head-to-head meetings are dropped: the
// summaries say everything a closed card shows, and an opened one fetches the
// rows it needs from public/detail.

import { readMatch, type Note } from "@/lib/read";
import type { Board, Line, Standout } from "@/lib/markets";
import type { FormSummary, H2HSummary, Projection, SideRating } from "@/lib/model";
import type { Fixture, Result, Team } from "@/lib/types";

const r = (value: number) => Math.round(value * 1e4) / 1e4;
const line = (l: Line): Line => ({ line: l.line, over: r(l.over), under: r(l.under) });

export type MatchView = {
  id: number;
  leagueId: number;
  kickoff: string;
  status: "scheduled" | "live" | "finished";
  finished: boolean;
  isLive: boolean;
  home: Team;
  away: Team;
  result: Result | null;
  notes: Note[];
  standouts: Standout[];
  p: {
    lambdaHome: number;
    lambdaAway: number;
    outcome: { home: number; draw: number; away: number };
    firstGoal: {
      home: number;
      away: number;
      none: number;
      expectedMinute: number;
      byMinute: { minute: number; scored: number }[];
    };
    scorelines: { home: number; away: number; probability: number }[];
    confidence: "thin" | "fair" | "solid";
    homeRating: SideRating;
    awayRating: SideRating;
    homeForm: { overall: FormSummary; venue: FormSummary };
    awayForm: { overall: FormSummary; venue: FormSummary };
    // The record only; the meetings behind it are fetched when a card is opened.
    h2h: H2HSummary;
    board: Board;
  };
};

const rating = (side: SideRating): SideRating => ({
  attack: r(side.attack),
  defence: r(side.defence),
  homeEdge: r(side.homeEdge),
  sample: r(side.sample),
  overall: side.overall,
});

const compactBoard = (board: Board): Board => ({
  totals: board.totals.map(line),
  homeGoals: board.homeGoals.map(line),
  awayGoals: board.awayGoals.map(line),
  btts: {
    yes: r(board.btts.yes),
    no: r(board.btts.no),
  },
  drawNoBet: {
    home: r(board.drawNoBet.home),
    away: r(board.drawNoBet.away),
  },
  exactScores: board.exactScores.map((s) => ({
    score: s.score,
    home: s.home,
    away: s.away,
    probability: r(s.probability),
  })),
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
  asian: board.asian.map((a) => ({
    line: a.line,
    home: { win: r(a.home.win), push: r(a.home.push), lose: r(a.home.lose), price: r(a.home.price) },
    away: { win: r(a.away.win), push: r(a.away.push), lose: r(a.away.lose), price: r(a.away.price) },
  })),
  margins: board.margins.map((m) => ({ side: m.side, by: m.by, probability: r(m.probability) })),
  resultAndBtts: board.resultAndBtts.map((c) => ({ key: c.key, probability: r(c.probability) })),
  resultAndTotal: board.resultAndTotal.map((c) => ({ key: c.key, probability: r(c.probability) })),
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
  htft: board.htft.map((c) => ({ key: c.key, probability: r(c.probability) })),
  bothHalves: { home: r(board.bothHalves.home), away: r(board.bothHalves.away) },
  goalEachHalf: r(board.goalEachHalf),
  highestScoringHalf: {
    first: r(board.highestScoringHalf.first),
    draw: r(board.highestScoringHalf.draw),
    second: r(board.highestScoringHalf.second),
  },
});

export function toView(
  fixture: Fixture,
  projection: Projection,
  standouts: Standout[] = []
): MatchView {
  return {
    id: fixture.id,
    leagueId: fixture.leagueId,
    kickoff: fixture.kickoff,
    status: fixture.status,
    finished: fixture.status === "finished",
    isLive: fixture.status === "live",
    home: fixture.home.team,
    away: fixture.away.team,
    result: fixture.result,
    notes: readMatch({
      projection,
      homeName: fixture.home.team.short,
      awayName: fixture.away.team.short,
    }),
    standouts: standouts.map((s) => ({
      ...s,
      probability: r(s.probability),
      typical: r(s.typical),
      edge: r(s.edge),
    })),
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
        byMinute: projection.firstGoal.byMinute.map((w) => ({
          minute: w.minute,
          scored: r(w.scored),
        })),
      },
      scorelines: projection.scorelines.map((s) => ({
        home: s.home,
        away: s.away,
        probability: r(s.probability),
      })),
      confidence: projection.confidence,
      homeRating: rating(projection.homeRating),
      awayRating: rating(projection.awayRating),
      homeForm: projection.homeForm,
      awayForm: projection.awayForm,
      h2h: projection.h2h,
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
