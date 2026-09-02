import assert from "node:assert/strict";
import test from "node:test";

import { blend, fairProbabilities, overround, valueOf, valueOfBook } from "@/lib/edge";

test("overround is what the book adds over a hundred", () => {
  // A perfectly fair three-way book.
  assert.ok(Math.abs(overround([3, 3, 3])) < 1e-9);
  // 1/2 + 1/4 + 1/4 is exactly one, so still no margin.
  assert.ok(Math.abs(overround([2, 4, 4])) < 1e-9);
  assert.ok(overround([1.9, 3.6, 4.2]) > 0);
});

test("removing the margin gives a distribution", () => {
  const fair = fairProbabilities([1.9, 3.6, 4.2]);
  assert.ok(Math.abs(fair.reduce((sum, p) => sum + p, 0) - 1) < 1e-9);
  fair.forEach((p) => assert.ok(p > 0 && p < 1));
});

test("the power method takes less off the longshot than proportional does", () => {
  // Needs a real margin in it: a book that already adds to one is untouched by
  // either method.
  const odds = [1.45, 4.2, 8];
  const power = fairProbabilities(odds, "power");
  const flat = fairProbabilities(odds, "proportional");

  // The longshot keeps more of its price, the favourite less.
  assert.ok(power[2] > flat[2]);
  assert.ok(power[0] < flat[0]);
});

test("a fair book comes back unchanged", () => {
  const fair = fairProbabilities([2, 4, 4]);
  assert.ok(Math.abs(fair[0] - 0.5) < 1e-6);
  assert.ok(Math.abs(fair[1] - 0.25) < 1e-6);
});

test("thin evidence leaves more of the market in the blend", () => {
  const solid = blend(0.6, 0.4, "solid");
  const thin = blend(0.6, 0.4, "thin");
  assert.ok(solid > thin, "a confident model moves further from the price");
  assert.ok(thin > 0.4 && solid < 0.6);
});

test("a price shorter than the model is still not free money", () => {
  // The model says 60%, the book pays 1.67, which is exactly 60%.
  const value = valueOf(0.6, 1 / 0.6, { confidence: "solid" });
  assert.ok(value);
  assert.ok(Math.abs(value.edge) < 1e-9);
  assert.equal(value.verdict, "fair");
  assert.equal(value.stake, 0);
});

test("a generous price shows an edge and a stake", () => {
  const value = valueOf(0.6, 2.5, { confidence: "solid" });
  assert.ok(value);
  assert.ok(value.edge > 0);
  assert.equal(value.verdict, "value");
  assert.ok(value.stake > 0);
  // Quarter Kelly, and never more than a twentieth of a bankroll.
  assert.ok(value.stake <= 0.05);
  assert.ok(value.stake < value.kelly);
});

test("a short price reads as poor", () => {
  const value = valueOf(0.4, 1.5, { confidence: "solid" });
  assert.ok(value);
  assert.ok(value.edge < 0);
  assert.equal(value.verdict, "poor");
  assert.equal(value.stake, 0);
});

test("odds that are not odds give nothing rather than Infinity", () => {
  assert.equal(valueOf(0.5, 0), null);
  assert.equal(valueOf(0.5, 1), null);
  assert.equal(valueOf(0.5, Number.NaN), null);
});

test("a whole book prices against the margin-free line", () => {
  const model = [0.5, 0.27, 0.23];
  const values = valueOfBook(model, [1.9, 3.6, 4.2], "solid");

  assert.equal(values.length, 3);
  values.forEach((value) => {
    assert.ok(value);
    assert.ok(value.fair !== null, "the whole book was entered, so the margin comes out");
  });

  // Every fair price is longer than the one offered, because the margin is gone.
  values.forEach((value) => assert.ok(value!.fair! < value!.implied));
});

test("a half-filled book falls back to the raw prices", () => {
  const values = valueOfBook([0.5, 0.27, 0.23], [1.9, 0, 0], "fair");
  assert.equal(values[0]?.fair, null);
  assert.equal(values[1], null);
});
