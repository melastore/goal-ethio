// Every market the goal data actually supports, read off one score matrix.
//
// Corners, cards and shots are not in this feed, so they are not modelled. A
// number here is only ever a sum over scorelines the model already assigns.

import { poisson, scoreMatrix } from "@/lib/model";
import type { TeamForm, Venue } from "@/lib/types";

export type Line = { line: number; over: number; under: number };

// Share of a match's goals scored before the break, pooled across the top
// leagues. Used as the prior when a team's own half-time record is thin.
const FIRST_HALF_SHARE = 0.45;
const HALF_PRIOR_MATCHES = 6;

// A half is low scoring, so the grid can be small. Past five in a half is a
// rounding error and the joint sums below are quadratic in this.
const HALF_GOALS = 6;

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
/* Goal difference, and everything priced off it                               */
/* -------------------------------------------------------------------------- */

// Home goals minus away goals. Handicaps, margins and Asian lines are all
// questions about this one curve, so the matrix is collapsed to it once.
export function goalDifference(matrix: number[][]): Map<number, number> {
  const spread = new Map<number, number>();
  matrix.forEach((row, h) =>
    row.forEach((p, a) => {
      const d = h - a;
      spread.set(d, (spread.get(d) ?? 0) + p);
    })
  );
  return spread;
}

export type AsianSide = { win: number; push: number; lose: number; price: number };
export type AsianLine = { line: number; home: AsianSide; away: AsianSide };

// Asian handicap, quarter lines included. A quarter line is two half-stake bets
// on the half-lines either side, so part of the stake can come back on a push.
// `price` counts a push as half a win, which is the number to set a bookmaker's
// price against.
export function asianHandicap(
  matrix: number[][],
  lines = [-1.5, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.5]
): AsianLine[] {
  const spread = goalDifference(matrix);

  const at = (line: number, forHome: boolean): AsianSide => {
    // Quarter lines split across the two neighbours; everything else is itself.
    const legs =
      Math.abs(line * 2) % 1 === 0 ? [line] : [line - 0.25, line + 0.25];

    let win = 0;
    let push = 0;
    let lose = 0;

    for (const leg of legs) {
      for (const [d, p] of spread) {
        const margin = (forHome ? d : -d) + leg;
        const share = p / legs.length;
        if (margin > 0) win += share;
        else if (margin === 0) push += share;
        else lose += share;
      }
    }

    return { win, push, lose, price: win + push / 2 };
  };

  return lines.map((line) => ({ line, home: at(line, true), away: at(-line, false) }));
}

export type Margin = { side: "home" | "draw" | "away"; by: number; probability: number };

// Winning margin, everything past three collapsed into a three-or-more.
export function winningMargin(matrix: number[][], cap = 3): Margin[] {
  const spread = goalDifference(matrix);
  const out = new Map<string, Margin>();

  const bump = (side: Margin["side"], by: number, p: number) => {
    const key = `${side}${by}`;
    const existing = out.get(key);
    if (existing) existing.probability += p;
    else out.set(key, { side, by, probability: p });
  };

  for (const [d, p] of spread) {
    if (d === 0) bump("draw", 0, p);
    else if (d > 0) bump("home", Math.min(d, cap), p);
    else bump("away", Math.min(-d, cap), p);
  }

  return [...out.values()].sort((a, b) => b.probability - a.probability);
}

export type Combo = { key: string; probability: number };

// Result and both-to-score on one ticket, the way a coupon sells it.
export function resultAndBtts(matrix: number[][]): Combo[] {
  const both = (h: number, a: number) => h > 0 && a > 0;
  return [
    { key: "homeYes", probability: sumWhere(matrix, (h, a) => h > a && both(h, a)) },
    { key: "homeNo", probability: sumWhere(matrix, (h, a) => h > a && !both(h, a)) },
    { key: "drawYes", probability: sumWhere(matrix, (h, a) => h === a && both(h, a)) },
    { key: "drawNo", probability: sumWhere(matrix, (h, a) => h === a && !both(h, a)) },
    { key: "awayYes", probability: sumWhere(matrix, (h, a) => h < a && both(h, a)) },
    { key: "awayNo", probability: sumWhere(matrix, (h, a) => h < a && !both(h, a)) },
  ];
}

// Result and over or under 2.5, the other coupon staple.
export function resultAndTotal(matrix: number[][], line = 2.5): Combo[] {
  const over = (h: number, a: number) => h + a > line;
  return [
    { key: "homeOver", probability: sumWhere(matrix, (h, a) => h > a && over(h, a)) },
    { key: "homeUnder", probability: sumWhere(matrix, (h, a) => h > a && !over(h, a)) },
    { key: "drawOver", probability: sumWhere(matrix, (h, a) => h === a && over(h, a)) },
    { key: "drawUnder", probability: sumWhere(matrix, (h, a) => h === a && !over(h, a)) },
    { key: "awayOver", probability: sumWhere(matrix, (h, a) => h < a && over(h, a)) },
    { key: "awayUnder", probability: sumWhere(matrix, (h, a) => h < a && !over(h, a)) },
  ];
}

/* -------------------------------------------------------------------------- */
/* The two halves                                                              */
/* -------------------------------------------------------------------------- */

// Share of a team's goals arriving before the break, pulled toward the league
// norm by how few half-time scores are on record. Teams differ here less than
// people assume, so the prior carries most of the weight.
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

// A half is not a short match: the low-score correction is fitted against ninety
// minutes, so it is off here.
function halfMatrix(lambdaHome: number, lambdaAway: number): number[][] {
  const cut = scoreMatrix(lambdaHome, lambdaAway, false)
    .slice(0, HALF_GOALS)
    .map((row) => row.slice(0, HALF_GOALS));

  // Cutting the grid down drops a little tail mass, and the joint sums below
  // multiply two of these together, so it has to go back before they do.
  const total = cut.reduce((sum, row) => sum + row.reduce((a, p) => a + p, 0), 0);
  return total > 0 ? cut.map((row) => row.map((p) => p / total)) : cut;
}

export type HalfTime = {
  result: { home: number; draw: number; away: number };
  totals: Line[];
  share: number;
};

// The first half as a match of its own, scaled down from the full-match rates.
export function firstHalf(
  lambdaHome: number,
  lambdaAway: number,
  share: number
): HalfTime {
  const matrix = halfMatrix(lambdaHome * share, lambdaAway * share);

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

export type HalfToFull = {
  // Nine cells keyed half-then-full, so "homeaway" is a lead thrown away.
  htft: Combo[];
  highestScoringHalf: HighestScoringHalf;
  // Each side scoring in both halves.
  bothHalves: { home: number; away: number };
  // A goal in each half, either side.
  goalEachHalf: number;
};

const side = (h: number, a: number) => (h > a ? "home" : h === a ? "draw" : "away");

// Everything needing the two halves jointly. Half-time/full-time, which half
// carries the goals and scoring in both are the same double sum, and it is the
// most expensive thing the board does, so it is walked once.
export function halfToFull(
  lambdaHome: number,
  lambdaAway: number,
  share: number
): HalfToFull {
  const first = halfMatrix(lambdaHome * share, lambdaAway * share);
  const second = halfMatrix(lambdaHome * (1 - share), lambdaAway * (1 - share));

  const htft = new Map<string, number>();
  const highest = { first: 0, draw: 0, second: 0 };
  let homeBoth = 0;
  let awayBoth = 0;
  let eachHalf = 0;

  first.forEach((row1, h1) => {
    row1.forEach((p1, a1) => {
      if (p1 < 1e-9) return;
      const goals1 = h1 + a1;
      const half = side(h1, a1);

      second.forEach((row2, h2) => {
        row2.forEach((p2, a2) => {
          const p = p1 * p2;
          if (p < 1e-12) return;
          const goals2 = h2 + a2;

          const key = `${half}${side(h1 + h2, a1 + a2)}`;
          htft.set(key, (htft.get(key) ?? 0) + p);

          if (goals1 > goals2) highest.first += p;
          else if (goals1 === goals2) highest.draw += p;
          else highest.second += p;

          if (h1 > 0 && h2 > 0) homeBoth += p;
          if (a1 > 0 && a2 > 0) awayBoth += p;
          if (goals1 > 0 && goals2 > 0) eachHalf += p;
        });
      });
    });
  });

  const order = [
    "homehome", "homedraw", "homeaway",
    "drawhome", "drawdraw", "drawaway",
    "awayhome", "awaydraw", "awayaway",
  ];

  return {
    htft: order.map((key) => ({ key, probability: htft.get(key) ?? 0 })),
    highestScoringHalf: highest,
    bothHalves: { home: homeBoth, away: awayBoth },
    goalEachHalf: eachHalf,
  };
}

// Kept separate for callers that want only this.
export function highestScoringHalf(
  lambdaHome: number,
  lambdaAway: number,
  share: number
): HighestScoringHalf {
  return halfToFull(lambdaHome, lambdaAway, share).highestScoringHalf;
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
  asian: AsianLine[];
  margins: Margin[];
  resultAndBtts: Combo[];
  resultAndTotal: Combo[];
  cleanSheets: ReturnType<typeof cleanSheets>;
  oddEven: ReturnType<typeof oddEven>;
  halfTime: HalfTime;
  htft: Combo[];
  bothHalves: { home: number; away: number };
  goalEachHalf: number;
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

  const halves = halfToFull(lambdaHome, lambdaAway, share);

  return {
    totals: totals(matrix),
    homeGoals: teamTotals(lambdaHome),
    awayGoals: teamTotals(lambdaAway),
    btts: btts(matrix),
    drawNoBet: drawNoBet(matrix),
    exactScores: likeliestExactScores(matrix, 6),
    doubleChance: doubleChance(matrix),
    handicaps: handicaps(matrix),
    asian: asianHandicap(matrix),
    margins: winningMargin(matrix),
    resultAndBtts: resultAndBtts(matrix),
    resultAndTotal: resultAndTotal(matrix),
    cleanSheets: cleanSheets(matrix),
    oddEven: oddEven(matrix),
    halfTime: firstHalf(lambdaHome, lambdaAway, share),
    htft: halves.htft,
    bothHalves: halves.bothHalves,
    goalEachHalf: halves.goalEachHalf,
    highestScoringHalf: halves.highestScoringHalf,
  };
}

/* -------------------------------------------------------------------------- */
/* What stands out                                                             */
/* -------------------------------------------------------------------------- */

export type Quote = {
  key: string;
  // Filled into the market's phrase: a short name, a line.
  values: (string | number)[];
  probability: number;
};

// Every selection on the board in one shape. Ranking by raw probability only
// surfaces the near-certain ones (over 0.5, a double chance on the favourite),
// which tells nobody anything; what is worth showing is a market that departs
// from what a match normally looks like, and that comparison needs this list.
export function quotes(board: Board, outcome: { home: number; draw: number; away: number }): Quote[] {
  const out: Quote[] = [
    { key: "home", values: [], probability: outcome.home },
    { key: "draw", values: [], probability: outcome.draw },
    { key: "away", values: [], probability: outcome.away },
    { key: "bttsYes", values: [], probability: board.btts.yes },
    { key: "bttsNo", values: [], probability: board.btts.no },
    { key: "dnbHome", values: [], probability: board.drawNoBet.home },
    { key: "dnbAway", values: [], probability: board.drawNoBet.away },
    { key: "homeOrDraw", values: [], probability: board.doubleChance.homeOrDraw },
    { key: "drawOrAway", values: [], probability: board.doubleChance.drawOrAway },
    { key: "homeOrAway", values: [], probability: board.doubleChance.homeOrAway },
    { key: "homeCleanSheet", values: [], probability: board.cleanSheets.home },
    { key: "awayCleanSheet", values: [], probability: board.cleanSheets.away },
    { key: "homeBothHalves", values: [], probability: board.bothHalves.home },
    { key: "awayBothHalves", values: [], probability: board.bothHalves.away },
    { key: "goalEachHalf", values: [], probability: board.goalEachHalf },
    { key: "htOver", values: [0.5], probability: board.halfTime.totals[0].over },
    { key: "htUnder", values: [0.5], probability: board.halfTime.totals[0].under },
  ];

  for (const line of board.totals) {
    out.push({ key: "over", values: [line.line], probability: line.over });
    out.push({ key: "under", values: [line.line], probability: line.under });
  }

  for (const combo of board.resultAndBtts) {
    out.push({ key: `rb.${combo.key}`, values: [], probability: combo.probability });
  }

  return out;
}

// The yardstick: what a selection usually comes to across this week's fixtures.
export function typicalRates(all: Quote[][]): Map<string, number> {
  const sums = new Map<string, { total: number; n: number }>();

  for (const list of all) {
    for (const quote of list) {
      const key = `${quote.key}|${quote.values.join(",")}`;
      let entry = sums.get(key);
      if (!entry) sums.set(key, (entry = { total: 0, n: 0 }));
      entry.total += quote.probability;
      entry.n += 1;
    }
  }

  const typical = new Map<string, number>();
  for (const [key, entry] of sums) {
    if (entry.n > 0) typical.set(key, entry.total / entry.n);
  }
  return typical;
}

export type Standout = Quote & {
  // The week's typical rate for this selection.
  typical: number;
  // Clear of typical, in probability. Negative means unusually unlikely.
  edge: number;
};

// Selections furthest from a typical match, strongest first. The floor keeps the
// list to things worth backing rather than avoiding; the ceiling keeps out the
// ones so short that beating typical means nothing.
export function standouts(
  list: Quote[],
  typical: Map<string, number>,
  limit = 4,
  floor = 0.5,
  ceiling = 0.93
): Standout[] {
  return list
    .map((quote) => {
      const reference = typical.get(`${quote.key}|${quote.values.join(",")}`) ?? 0.5;
      return { ...quote, typical: reference, edge: quote.probability - reference };
    })
    .filter((entry) => entry.probability >= floor && entry.probability <= ceiling)
    .sort((a, b) => b.edge - a.edge)
    .slice(0, limit);
}
