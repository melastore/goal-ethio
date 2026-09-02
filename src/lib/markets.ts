// Every market the goal data actually supports, read off one score matrix.
//
// Corners, cards and shots are not in this feed, so they are not modelled. A
// number here is only ever a sum over scorelines the model already assigns.

import { poisson, scoreMatrix } from "@/lib/model";
import type { TeamForm, Venue } from "@/lib/types";

export type Line = { line: number; over: number; under: number };

export type Market = {
  key: string;
  home: number;
  draw?: number;
  away: number;
};

// Share of a match's goals scored before the break, pooled across the top
// leagues. Used as the prior when a team's own half-time record is thin.
const FIRST_HALF_SHARE = 0.44;
const HALF_PRIOR_MATCHES = 6;

const sumWhere = (matrix: number[][], keep: (home: number, away: number) => boolean) => {
  let total = 0;
  matrix.forEach((row, h) => row.forEach((p, a) => { if (keep(h, a)) total += p; }));
  return total;
};

/** Over and under for each line, from the same matrix the result comes from. */
export function totals(matrix: number[][], lines = [0.5, 1.5, 2.5, 3.5, 4.5]): Line[] {
  return lines.map((line) => {
    const over = sumWhere(matrix, (h, a) => h + a > line);
    return { line, over, under: 1 - over };
  });
}

/** Over and under on one side's goals alone, straight off the Poisson marginal. */
export function teamTotals(lambda: number, lines = [0.5, 1.5, 2.5]): Line[] {
  return lines.map((line) => {
    // P(goals > line) for a half-integer line is 1 - P(goals <= floor(line)).
    let under = 0;
    for (let k = 0; k <= Math.floor(line); k += 1) under += poisson(k, lambda);
    return { line, over: 1 - under, under };
  });
}

export function doubleChance(matrix: number[][]) {
  return {
    homeOrDraw: sumWhere(matrix, (h, a) => h >= a),
    homeOrAway: sumWhere(matrix, (h, a) => h !== a),
    drawOrAway: sumWhere(matrix, (h, a) => h <= a),
  };
}

/** A handicap of -1 on the home side means it has to win by two or more. */
export function handicaps(matrix: number[][], steps = [1, 2]) {
  return steps.map((goals) => ({
    goals,
    homeGives: sumWhere(matrix, (h, a) => h - goals > a),
    awayGives: sumWhere(matrix, (h, a) => a - goals > h),
  }));
}

export function cleanSheets(matrix: number[][]) {
  return {
    home: sumWhere(matrix, (_h, a) => a === 0),
    away: sumWhere(matrix, (h) => h === 0),
    homeWinToNil: sumWhere(matrix, (h, a) => h > 0 && a === 0),
    awayWinToNil: sumWhere(matrix, (h, a) => a > 0 && h === 0),
  };
}

export type Btts = { yes: number; no: number };

export function btts(matrix: number[][]): Btts {
  const yes = sumWhere(matrix, (h, a) => h > 0 && a > 0);
  return { yes, no: Math.max(0, 1 - yes) };
}

export type DrawNoBet = { home: number; away: number };

export function drawNoBet(matrix: number[][]): DrawNoBet {
  const home = sumWhere(matrix, (h, a) => h > a);
  const away = sumWhere(matrix, (h, a) => h < a);
  const sum = home + away;
  return {
    home: sum > 0 ? home / sum : 0.5,
    away: sum > 0 ? away / sum : 0.5,
  };
}

export type ExactScore = { score: string; home: number; away: number; probability: number };

export function likeliestExactScores(matrix: number[][], count = 5): ExactScore[] {
  const all: ExactScore[] = [];
  matrix.forEach((row, h) =>
    row.forEach((p, a) => {
      all.push({ score: `${h}-${a}`, home: h, away: a, probability: p });
    })
  );
  return all.sort((a, b) => b.probability - a.probability).slice(0, count);
}

export function oddEven(matrix: number[][]) {
  const odd = sumWhere(matrix, (h, a) => (h + a) % 2 === 1);
  return { odd, even: 1 - odd };
}

/* -------------------------------------------------------------------------- */
/* First half                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What share of this team's goals arrive before the break, pulled toward the
 * league norm by how few half-time scores are on record. Teams differ here less
 * than people assume, so the prior carries most of the weight.
 */
export function firstHalfShare(form: TeamForm, venue?: Venue) {
  const matches = (venue ? form.matches.filter((m) => m.venue === venue) : form.matches)
    .filter((match) => match.halfFor !== null && match.halfAgainst !== null);

  const full = matches.reduce((sum, m) => sum + m.goalsFor + m.goalsAgainst, 0);
  const half = matches.reduce((sum, m) => sum + (m.halfFor ?? 0) + (m.halfAgainst ?? 0), 0);

  const shrunk =
    (half + HALF_PRIOR_MATCHES * FIRST_HALF_SHARE * 2.6) /
    (full + HALF_PRIOR_MATCHES * 2.6);

  return { share: Math.min(Math.max(shrunk, 0.25), 0.6), matches: matches.length };
}

export type HalfTime = {
  result: { home: number; draw: number; away: number };
  totals: Line[];
  share: number;
};

/** The first half as a match of its own, scaled down from the full-match rates. */
export function firstHalf(
  lambdaHome: number,
  lambdaAway: number,
  share: number
): HalfTime {
  const matrix = scoreMatrix(lambdaHome * share, lambdaAway * share);

  return {
    result: {
      home: sumWhere(matrix, (h, a) => h > a),
      draw: sumWhere(matrix, (h, a) => h === a),
      away: sumWhere(matrix, (h, a) => h < a),
    },
    totals: totals(matrix, [0.5, 1.5]),
    share,
  };
}

export type HighestScoringHalf = {
  first: number;
  draw: number;
  second: number;
};

export function highestScoringHalf(
  lambdaHome: number,
  lambdaAway: number,
  share: number
): HighestScoringHalf {
  const m1 = scoreMatrix(lambdaHome * share, lambdaAway * share);
  const m2 = scoreMatrix(lambdaHome * (1 - share), lambdaAway * (1 - share));

  let first = 0;
  let draw = 0;
  let second = 0;

  m1.forEach((row1, h1) => {
    row1.forEach((p1, a1) => {
      const g1 = h1 + a1;
      m2.forEach((row2, h2) => {
        row2.forEach((p2, a2) => {
          const g2 = h2 + a2;
          const p = p1 * p2;
          if (g1 > g2) first += p;
          else if (g1 === g2) draw += p;
          else second += p;
        });
      });
    });
  });

  return { first, draw, second };
}

/* -------------------------------------------------------------------------- */
/* The whole board                                                            */
/* -------------------------------------------------------------------------- */

export type Board = {
  totals: Line[];
  homeGoals: Line[];
  awayGoals: Line[];
  btts: Btts;
  drawNoBet: DrawNoBet;
  exactScores: ExactScore[];
  doubleChance: ReturnType<typeof doubleChance>;
  handicaps: ReturnType<typeof handicaps>;
  cleanSheets: ReturnType<typeof cleanSheets>;
  oddEven: ReturnType<typeof oddEven>;
  halfTime: HalfTime;
  highestScoringHalf: HighestScoringHalf;
};

export function board(
  matrix: number[][],
  lambdaHome: number,
  lambdaAway: number,
  homeForm: TeamForm,
  awayForm: TeamForm
): Board {
  // Both sides' half-time records inform one share; they are two readings of
  // the same thing rather than two separate rates.
  const home = firstHalfShare(homeForm);
  const away = firstHalfShare(awayForm);
  const share = (home.share * home.matches + away.share * away.matches) /
    Math.max(home.matches + away.matches, 1) || FIRST_HALF_SHARE;

  return {
    totals: totals(matrix),
    homeGoals: teamTotals(lambdaHome),
    awayGoals: teamTotals(lambdaAway),
    btts: btts(matrix),
    drawNoBet: drawNoBet(matrix),
    exactScores: likeliestExactScores(matrix, 6),
    doubleChance: doubleChance(matrix),
    handicaps: handicaps(matrix),
    cleanSheets: cleanSheets(matrix),
    oddEven: oddEven(matrix),
    halfTime: firstHalf(lambdaHome, lambdaAway, share),
    highestScoringHalf: highestScoringHalf(lambdaHome, lambdaAway, share),
  };
}

/** Markets ranked by how far they sit from a coin flip, strongest first. */
export function strongestEdges(board: Board, limit = 4) {
  const candidates: { key: string; probability: number }[] = [
    ...board.totals.map((t) => ({ key: `over${t.line}`, probability: t.over })),
    ...board.totals.map((t) => ({ key: `under${t.line}`, probability: t.under })),
    { key: "bttsYes", probability: board.btts.yes },
    { key: "bttsNo", probability: board.btts.no },
    { key: "dnbHome", probability: board.drawNoBet.home },
    { key: "dnbAway", probability: board.drawNoBet.away },
    { key: "homeOrDraw", probability: board.doubleChance.homeOrDraw },
    { key: "drawOrAway", probability: board.doubleChance.drawOrAway },
    { key: "homeOrAway", probability: board.doubleChance.homeOrAway },
    { key: "homeCleanSheet", probability: board.cleanSheets.home },
    { key: "awayCleanSheet", probability: board.cleanSheets.away },
    { key: "htOver0.5", probability: board.halfTime.totals[0].over },
  ];

  return candidates
    .filter((entry) => entry.probability >= 0.6 && entry.probability <= 0.95)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit);
}
