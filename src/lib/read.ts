// The model's case for a match, in the terms a person would argue it.
//
// Every note points at a number the page already shows, so nothing here is a
// claim the rest of the projection does not make. Notes are keys plus values,
// not sentences, so they translate.

import type { Board } from "@/lib/markets";
import type { FormSummary, Projection } from "@/lib/model";
import { lean } from "@/lib/model";

export type NoteKey =
  | "strongFavourite"
  | "tightMatch"
  | "homeFortress"
  | "awayTravellers"
  | "leakyDefence"
  | "meanDefence"
  | "goalsExpected"
  | "goalsScarce"
  | "scoresFirst"
  | "slowStarters"
  | "fastStarters"
  | "formSwing"
  | "thinEvidence";

export type Note = {
  key: NoteKey;
  // Filled into the phrase: team names, percentages, counts.
  values: (string | number)[];
  // Which way it cuts, for the accent colour on the row.
  tone: "home" | "away" | "neutral" | "caution";
};

const pct = (value: number) => Math.round(value * 100);

const goalsPerMatch = (form: FormSummary, side: "for" | "against") =>
  form.played === 0 ? 0 : (side === "for" ? form.goalsFor : form.goalsAgainst) / form.played;

type Input = {
  projection: Projection;
  homeName: string;
  awayName: string;
};

/**
 * At most five notes, strongest first. The thresholds are deliberately blunt:
 * a note that fires on every match tells nobody anything.
 */
export function readMatch({ projection, homeName, awayName }: Input): Note[] {
  const notes: Note[] = [];
  const picked = lean(projection.outcome);
  const board: Board = projection.board;

  const homeVenue = projection.homeForm.venue;
  const awayVenue = projection.awayForm.venue;

  if (picked.pick !== "draw" && picked.probability >= 0.55) {
    notes.push({
      key: "strongFavourite",
      values: [picked.pick === "home" ? homeName : awayName, pct(picked.probability)],
      tone: picked.pick,
    });
  }

  if (picked.margin < 0.08) {
    notes.push({ key: "tightMatch", values: [pct(picked.probability)], tone: "neutral" });
  }

  // A venue record only says something once there are matches behind it.
  if (homeVenue.played >= 3 && homeVenue.won / homeVenue.played >= 0.66) {
    notes.push({
      key: "homeFortress",
      values: [homeName, homeVenue.won, homeVenue.played],
      tone: "home",
    });
  }

  if (awayVenue.played >= 3 && (awayVenue.won + awayVenue.drawn) / awayVenue.played >= 0.66) {
    notes.push({
      key: "awayTravellers",
      values: [awayName, awayVenue.won + awayVenue.drawn, awayVenue.played],
      tone: "away",
    });
  }

  const homeConceded = goalsPerMatch(homeVenue, "against");
  const awayConceded = goalsPerMatch(awayVenue, "against");

  if (homeVenue.played >= 3 && homeConceded >= 1.75) {
    notes.push({
      key: "leakyDefence",
      values: [homeName, homeConceded.toFixed(1)],
      tone: "away",
    });
  } else if (awayVenue.played >= 3 && awayConceded >= 2) {
    notes.push({
      key: "leakyDefence",
      values: [awayName, awayConceded.toFixed(1)],
      tone: "home",
    });
  }

  if (homeVenue.played >= 3 && awayVenue.played >= 3 && homeConceded + awayConceded <= 1.6) {
    notes.push({ key: "meanDefence", values: [], tone: "neutral" });
  }

  const overTwoFive = board.totals.find((line) => line.line === 2.5);
  if (overTwoFive && overTwoFive.over >= 0.62) {
    notes.push({ key: "goalsExpected", values: [pct(overTwoFive.over)], tone: "neutral" });
  } else if (overTwoFive && overTwoFive.under >= 0.62) {
    notes.push({ key: "goalsScarce", values: [pct(overTwoFive.under)], tone: "neutral" });
  }

  // The observed record, not the model's own first-goal number: the point is to
  // show where the projection agrees with what has actually happened.
  const firstSide =
    homeVenue.decided >= 3 && homeVenue.scoredFirst / homeVenue.decided >= 0.66
      ? { name: homeName, hit: homeVenue.scoredFirst, of: homeVenue.decided, tone: "home" as const }
      : awayVenue.decided >= 3 && awayVenue.scoredFirst / awayVenue.decided >= 0.66
        ? { name: awayName, hit: awayVenue.scoredFirst, of: awayVenue.decided, tone: "away" as const }
        : null;

  if (firstSide) {
    notes.push({
      key: "scoresFirst",
      values: [firstSide.name, firstSide.hit, firstSide.of],
      tone: firstSide.tone,
    });
  }

  const half = board.halfTime.totals[0];
  if (half.under >= 0.42) {
    notes.push({ key: "slowStarters", values: [pct(half.under)], tone: "neutral" });
  } else if (half.over >= 0.72) {
    notes.push({ key: "fastStarters", values: [pct(half.over)], tone: "neutral" });
  }

  // A side whose venue form contradicts its overall form is worth flagging.
  const swing = (overall: FormSummary, venue: FormSummary) =>
    overall.played >= 5 && venue.played >= 3
      ? venue.won / venue.played - overall.won / overall.played
      : 0;

  const homeSwing = swing(projection.homeForm.overall, homeVenue);
  const awaySwing = swing(projection.awayForm.overall, awayVenue);

  if (Math.abs(homeSwing) >= 0.3) {
    notes.push({
      key: "formSwing",
      values: [homeName, homeSwing > 0 ? "better" : "worse"],
      tone: homeSwing > 0 ? "home" : "away",
    });
  } else if (Math.abs(awaySwing) >= 0.3) {
    notes.push({
      key: "formSwing",
      values: [awayName, awaySwing > 0 ? "better" : "worse"],
      tone: awaySwing > 0 ? "away" : "home",
    });
  }

  if (projection.confidence === "thin") {
    notes.push({
      key: "thinEvidence",
      values: [Math.min(homeVenue.played, awayVenue.played)],
      tone: "caution",
    });
  }

  return notes.slice(0, 5);
}
