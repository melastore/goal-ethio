// What a price is worth, once the bookmaker's margin is taken out of it.
//
// The model on its own is not enough to bet on. A closing line is the sharpest
// forecast available and a fit on ten matches will not beat it often, so a
// probability here is pulled toward the market before any edge is claimed. What
// survives that is worth showing.

export type Method = "power" | "proportional";

export const impliedFrom = (odds: number) => (odds > 1 ? 1 / odds : 0);

// How much over 100% a set of prices adds to. 0.05 is a five percent book.
export function overround(odds: number[]): number {
  const total = odds.reduce((sum, price) => sum + impliedFrom(price), 0);
  return total - 1;
}

// Proportional removal shortens every price by the same factor, which takes too
// much off the longshots. The power method solves for k in sum(p^k) = 1
// instead, which shortens the favourite more and matches how books are built.
function powerExponent(implied: number[]): number {
  const total = implied.reduce((sum, p) => sum + p, 0);
  if (total <= 1 || implied.length < 2) return 1;

  let low = 0.5;
  let high = 1;
  for (let i = 0; i < 40; i += 1) {
    const k = (low + high) / 2;
    const sum = implied.reduce((acc, p) => acc + p ** k, 0);
    if (sum > 1) low = k;
    else high = k;
  }
  return (low + high) / 2;
}

// The prices with the margin taken out, in the order they came in.
export function fairProbabilities(odds: number[], method: Method = "power"): number[] {
  const implied = odds.map(impliedFrom);
  const total = implied.reduce((sum, p) => sum + p, 0);
  if (total <= 0) return implied;

  if (method === "proportional" || implied.length < 2) {
    return implied.map((p) => p / total);
  }

  const k = powerExponent(implied);
  const powered = implied.map((p) => p ** k);
  const sum = powered.reduce((acc, p) => acc + p, 0);
  return powered.map((p) => p / sum);
}

// How much of the model to keep when a market price is available. Thin evidence
// means the market knows more, so less of the model survives the blend.
const TRUST = { solid: 0.45, fair: 0.3, thin: 0.18 } as const;

export type Confidence = keyof typeof TRUST;

export const blend = (model: number, market: number, confidence: Confidence) => {
  const trust = TRUST[confidence];
  return trust * model + (1 - trust) * market;
};

export type Value = {
  odds: number;
  // Straight off the price, margin included.
  implied: number;
  // The price with the margin removed, when the rest of the book is known.
  fair: number | null;
  // What the bet is actually priced at after the market is folded in.
  probability: number;
  // Probability points clear of the price. Positive is value.
  edge: number;
  // Return per unit staked. 0.05 is five percent on turnover.
  expected: number;
  // Full Kelly, before any fraction is applied.
  kelly: number;
  // Quarter Kelly, capped. What a stake should actually be.
  stake: number;
  verdict: "value" | "fair" | "poor";
};

// Full Kelly ruins people. A quarter of it keeps most of the growth at a
// fraction of the swing, and the cap stops one thin call taking the bankroll.
const KELLY_FRACTION = 0.25;
const MAX_STAKE = 0.05;

// Below this an edge is inside the model's own error and is not worth calling.
const VALUE_THRESHOLD = 0.02;

export function valueOf(
  modelProbability: number,
  odds: number,
  options: { confidence?: Confidence; fair?: number | null } = {}
): Value | null {
  if (!Number.isFinite(odds) || odds <= 1) return null;

  const implied = impliedFrom(odds);
  const fair = options.fair ?? null;
  const confidence = options.confidence ?? "fair";

  // With the rest of the book, blend against a margin-free price. Without it,
  // the raw price is the only market signal there is and it is already short,
  // so the blend uses it as-is and the edge comes out conservative.
  const probability = blend(modelProbability, fair ?? implied, confidence);

  const edge = probability - implied;
  const expected = probability * odds - 1;
  const kelly = (probability * odds - 1) / (odds - 1);

  const verdict =
    edge >= VALUE_THRESHOLD ? "value" : edge >= -VALUE_THRESHOLD ? "fair" : "poor";

  return {
    odds,
    implied,
    fair,
    probability,
    edge,
    expected,
    kelly,
    // Only a bet worth calling gets a stake. Below the threshold the edge is
    // inside the model's own error, and a stake on that reads as advice.
    stake: verdict === "value" ? Math.max(0, Math.min(MAX_STAKE, kelly * KELLY_FRACTION)) : 0,
    verdict,
  };
}

// A whole market at once, so the margin can be removed before anything is
// priced. Odds of zero or blank mean that leg was not entered.
export function valueOfBook(
  model: number[],
  odds: number[],
  confidence: Confidence = "fair"
): (Value | null)[] {
  const complete = odds.length >= 2 && odds.every((price) => price > 1);
  const fair = complete ? fairProbabilities(odds) : null;

  return odds.map((price, index) =>
    valueOf(model[index] ?? 0, price, {
      confidence,
      fair: fair ? fair[index] : null,
    })
  );
}
