// Reads the JSON the fetch script committed and hangs a projection off every
// fixture. Runs at build time only, so nothing here costs an API call.

import { baselineFor, project, type Baseline, type Projection } from "@/lib/model";
import { grade, tally, type Graded } from "@/lib/scoring";
import type { Fixture, WeekData } from "@/lib/types";
import week from "@/data/week.json";

export type Projected = { fixture: Fixture; projection: Projection };

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

  const projected: Projected[] = data.fixtures.map((fixture) => ({
    fixture,
    projection: project(fixture, byLeague.get(fixture.leagueId)!),
  }));

  const byKickoff = [...projected].sort(
    (a, b) =>
      new Date(a.fixture.kickoff).getTime() - new Date(b.fixture.kickoff).getTime()
  );

  const upcoming = byKickoff.filter(({ fixture }) => fixture.status === "scheduled");
  const played = byKickoff.filter(({ fixture }) => fixture.status === "finished");

  const graded = played
    .map(({ fixture, projection }) => grade(fixture, projection))
    .filter((entry): entry is Graded => entry !== null)
    // Newest result first, which is what anyone checking a score wants.
    .reverse();

  return {
    sample: data.sample === true,
    generatedAt: data.generatedAt,
    weekStart: data.weekStart,
    upcoming,
    graded,
    record: tally(graded),
  };
}
