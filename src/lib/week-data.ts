// Reads the JSON the fetch script committed, projects every fixture, and hands
// the pages a compact view. Runs at build time only, so nothing here costs a
// network call.

import { baselineFor, project, type Baseline } from "@/lib/model";
import { grade, tally, type Graded } from "@/lib/scoring";
import { toView, type MatchView } from "@/lib/view";
import type { Fixture, WeekData } from "@/lib/types";
import week from "@/data/week.json";

const data = week as WeekData;

// One baseline per competition, computed once and shared by its fixtures.
function baselines(fixtures: Fixture[]): Map<number, Baseline> {
  const byLeague = new Map<number, Baseline>();
  for (const fixture of fixtures) {
    if (!byLeague.has(fixture.leagueId)) {
      byLeague.set(fixture.leagueId, baselineFor(fixtures, fixture.leagueId));
    }
  }
  return byLeague;
}

export function loadWeek() {
  const byLeague = baselines(data.fixtures);

  const projected = data.fixtures.map((fixture) => ({
    fixture,
    projection: project(fixture, byLeague.get(fixture.leagueId)!),
  }));

  const byKickoff = [...projected].sort(
    (a, b) =>
      new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime()
  );

  const upcoming: MatchView[] = byKickoff
    .filter(({ fixture }) => fixture.status === "scheduled")
    .map(({ fixture, projection }) => toView(fixture, projection));

  const played = byKickoff.filter(({ fixture }) => fixture.status === "finished");

  const graded = played
    .map(({ fixture, projection }) => grade(fixture, projection))
    .filter((entry): entry is Graded => entry !== null)
    // Newest result first, which is what anyone checking a score wants.
    .reverse();

  // The results page needs the same compact shape, keyed by fixture.
  const results = graded.map((entry) => ({
    view: toView(entry.fixture, entry.projection),
    outcomeHit: entry.outcomeHit,
    firstGoalHit: entry.firstGoalHit,
    predicted: entry.predicted,
    actual: entry.actual,
  }));

  return {
    sample: data.sample === true,
    generatedAt: data.generatedAt,
    weekStart: data.weekStart,
    upcoming,
    results,
    record: tally(graded),
  };
}

export type ResultView = ReturnType<typeof loadWeek>["results"][number];
