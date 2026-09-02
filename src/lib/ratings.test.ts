import assert from "node:assert/strict";
import test from "node:test";

import { fromArchived, merge, toArchived } from "@/lib/history";
import { fitRatings, keyOf, poolMatches, ratingOf, weightOf } from "@/lib/ratings";
import type { Fixture, PastMatch, Team, TeamForm } from "@/lib/types";

const NOW = "2026-08-29T12:00:00Z";

let nextId = 1;

const team = (id: number, short: string): Team => ({
  id,
  name: short,
  short,
  logo: `https://crests.football-data.org/${id}.png`,
});

const past = (
  venue: "home" | "away",
  goalsFor: number,
  goalsAgainst: number,
  opponent: Team,
  kickoff = NOW,
  fixtureId = nextId++
): PastMatch => ({
  fixtureId,
  kickoff,
  competition: "PL",
  venue,
  opponent: opponent.short,
  opponentName: opponent.name,
  opponentLogo: opponent.logo,
  goalsFor,
  goalsAgainst,
  halfFor: null,
  halfAgainst: null,
  firstGoal: null,
  firstGoalMinute: null,
});

const fixture = (home: TeamForm, away: TeamForm): Fixture => ({
  id: nextId++,
  leagueId: 39,
  round: "R",
  kickoff: NOW,
  status: "scheduled",
  home,
  away,
  h2h: [],
  result: null,
});

test("a crest URL gives the same key as the team id it belongs to", () => {
  assert.equal(keyOf(5890, "https://crests.football-data.org/5890.png", "USL"), "t5890");
  assert.equal(keyOf(null, "https://crests.football-data.org/5890.png", "USL"), "t5890");
  // No id anywhere leaves the name, which is still better than merging two
  // clubs into one rating.
  assert.equal(keyOf(null, "", "USL"), "nUSL");
});

test("a match in both teams' form is pooled once, told from the home side", () => {
  const a = team(1, "AAA");
  const b = team(2, "BBB");
  const shared = 500;

  const formA: TeamForm = { team: a, matches: [past("home", 3, 1, b, NOW, shared)] };
  const formB: TeamForm = { team: b, matches: [past("away", 1, 3, a, NOW, shared)] };

  const pool = poolMatches([fixture(formA, formB)], NOW);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].home, "t1");
  assert.equal(pool[0].away, "t2");
  assert.equal(pool[0].goalsHome, 3);
  assert.equal(pool[0].goalsAway, 1);
});

test("a finished fixture is folded in as evidence of its own", () => {
  const a = team(1, "AAA");
  const b = team(2, "BBB");
  const played: Fixture = {
    ...fixture({ team: a, matches: [] }, { team: b, matches: [] }),
    status: "finished",
    result: {
      goalsHome: 2,
      goalsAway: 0,
      halfHome: null,
      halfAway: null,
      firstGoal: null,
      firstGoalMinute: null,
      firstScorer: null,
    },
  };

  const pool = poolMatches([played], NOW);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].goalsHome, 2);
});

test("a stale match counts for less than a fresh one", () => {
  assert.equal(weightOf(NOW, NOW), 1);
  // Two half-lives back.
  assert.ok(Math.abs(weightOf("2026-04-30T12:00:00Z", NOW) - 0.25) < 0.02);
  // Never above one, even dated ahead.
  assert.equal(weightOf("2027-01-01T00:00:00Z", NOW), 1);
});

// A handful of ordinary sides, so there is a league average for a team to
// stand out from. With one match in the pool that match is the average, and no
// team can be above it.
function ordinaryLeague(): Fixture[] {
  const teams = [3, 4, 5, 6].map((id) => team(id, `T${id}`));
  const rows = new Map(teams.map((t) => [t.id, [] as PastMatch[]]));

  for (const home of teams) {
    for (const away of teams) {
      if (home === away) continue;
      const id = nextId++;
      rows.get(home.id)!.push(past("home", 2, 1, away, NOW, id));
      rows.get(away.id)!.push(past("away", 1, 2, home, NOW, id));
    }
  }

  const forms = teams.map((t) => ({ team: t, matches: rows.get(t.id)! }));
  return [fixture(forms[0], forms[1]), fixture(forms[2], forms[3])];
}

test("one big win moves a rating, nowhere near as far as the scoreline", () => {
  const league = ordinaryLeague();
  const star = team(1, "AAA");
  const victim = team(4, "T4");

  const once = fitRatings(
    [...league, fixture({ team: star, matches: [past("home", 6, 0, victim)] }, league[0].away)],
    NOW
  );
  const rating = ratingOf(once, "t1");

  // Above the league, because six past a mid-table defence is something.
  assert.ok(rating.attack > 1, `attack was ${rating.attack}`);
  // Nowhere near six goals a game, because it happened once.
  assert.ok(rating.attack < 2, `attack was ${rating.attack}`);
});

test("the same result repeated is believed more than one of it", () => {
  const league = ordinaryLeague();
  const star = team(1, "AAA");
  const victim = team(4, "T4");

  const rate = (times: number) => {
    const matches = Array.from({ length: times }, () => past("home", 5, 0, victim));
    const ratings = fitRatings(
      [...league, fixture({ team: star, matches }, league[0].away)],
      NOW
    );
    return ratingOf(ratings, "t1").attack;
  };

  assert.ok(rate(4) > rate(1), "four of them says more than one");
});

test("a team nobody has played reads as exactly average", () => {
  const ratings = fitRatings([], NOW);
  const rating = ratingOf(ratings, "t999");
  assert.equal(rating.attack, 1);
  assert.equal(rating.defence, 1);
  assert.equal(rating.sample, 0);
});

/* -------------------------------------------------------------------------- */
/* The archive                                                                 */
/* -------------------------------------------------------------------------- */

const archived = (id: number, kickoff: string, goalsHome = 1, goalsAway = 0) =>
  toArchived({
    id,
    kickoff,
    competition: "PL",
    home: "t1",
    away: "t2",
    goalsHome,
    goalsAway,
    weight: 1,
  });

test("archiving and reading back keeps the match", () => {
  const row = archived(7, NOW, 3, 2);
  const back = fromArchived(row);
  assert.equal(back.id, 7);
  assert.equal(back.goalsHome, 3);
  assert.equal(back.goalsAway, 2);
  assert.equal(back.competition, "PL");
});

test("merging keeps one row per match and prefers the newer read", () => {
  // The same fixture, archived mid-play and then finished.
  const merged = merge([archived(7, NOW, 1, 0)], [archived(7, NOW, 2, 1)], NOW);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].gh, 2);
  assert.equal(merged[0].ga, 1);
});

test("merging drops what is too old to say anything", () => {
  const merged = merge(
    [archived(1, "2024-01-01T00:00:00Z"), archived(2, "2026-08-01T00:00:00Z")],
    [],
    NOW
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].i, 2);
});

test("the archive comes back in date order", () => {
  const merged = merge(
    [archived(3, "2026-08-20T00:00:00Z"), archived(1, "2026-06-01T00:00:00Z")],
    [archived(2, "2026-07-01T00:00:00Z")],
    NOW
  );
  assert.deepEqual(merged.map((row) => row.i), [1, 2, 3]);
});

test("history lifts the evidence behind a rating", () => {
  const a = team(1, "AAA");
  const b = team(2, "BBB");
  const only = fixture({ team: a, matches: [past("home", 1, 0, b)] }, { team: b, matches: [] });

  const thin = fitRatings([only], NOW);
  const withPast = fitRatings([only], NOW, {
    history: [1, 2, 3, 4, 5].map((n) =>
      fromArchived(archived(900 + n, "2026-08-2 0:00:00Z".replace(" ", `${n}T`)))
    ),
  });

  assert.ok(
    ratingOf(withPast, "t1").sample > ratingOf(thin, "t1").sample,
    "the archived matches count toward the rating"
  );
});
