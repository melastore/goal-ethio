// Reads the JSON the fetch script committed, projects every fixture, and hands
// the pages a compact view. Runs at build time only, so nothing here costs a
// network call.

import { fromArchived, type History } from "@/lib/history";
import { quotes, standouts, typicalRates } from "@/lib/markets";
import { project } from "@/lib/model";
import { fitRatings } from "@/lib/ratings";
import { grade, tally, type Graded } from "@/lib/scoring";
import { toView, type MatchView } from "@/lib/view";
import type { WeekData } from "@/lib/types";
import week from "@/data/week.json";
import archive from "@/data/history.json";

const data = week as WeekData;
const history = (archive as History).matches.map(fromArchived);

export function loadWeek() {
  // One fit over everything: a team's rating comes from every match on record,
  // not from the fixture it happens to be listed under.
  const ratings = fitRatings(data.fixtures, undefined, { history });

  const projected = data.fixtures.map((fixture) => ({
    fixture,
    projection: project(fixture, ratings),
  }));

  // What each selection usually comes to this week, so a match can be measured
  // against it rather than against its own raw probability.
  const boards = projected.map(({ projection }) => quotes(projection.board, projection.outcome));
  const typical = typicalRates(boards);

  const view = (index: number) =>
    toView(
      projected[index].fixture,
      projected[index].projection,
      standouts(boards[index], typical)
    );

  const order = projected
    .map((entry, index) => ({ ...entry, index }))
    .sort(
      (a, b) =>
        new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime()
    );

  const upcoming: MatchView[] = order
    .filter(({ fixture }) => fixture.status === "scheduled")
    .map(({ index }) => view(index));

  const live: MatchView[] = order
    .filter(({ fixture }) => fixture.status === "live")
    .map(({ index }) => view(index));

  const played = order
    .filter(({ fixture }) => fixture.status === "finished")
    .map(({ fixture, projection, index }) => ({
      index,
      graded: grade(fixture, projection),
    }))
    .filter((entry): entry is { index: number; graded: Graded } => entry.graded !== null);

  const results = played
    .map(({ index, graded }) => ({
      view: view(index),
      outcomeHit: graded.outcomeHit,
      firstGoalHit: graded.firstGoalHit,
      predicted: graded.predicted,
      actual: graded.actual,
    }))
    // Newest result first, which is what anyone checking a score wants.
    .reverse();

  return {
    sample: data.sample === true,
    generatedAt: data.generatedAt,
    weekStart: data.weekStart,
    upcoming,
    live,
    results,
    record: tally(played.map((entry) => entry.graded)),
  };
}

export type ResultView = ReturnType<typeof loadWeek>["results"][number];
