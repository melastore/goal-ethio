// Attack and defence per team, solved over every match in the file at once.
//
// Reading a rate off a team's own goals treats five wins over the bottom of the
// table as five over the top. Here each past match is one equation in the
// scorer's attack and the conceder's defence, and the set is solved together.
//
// Leagues that never meet cannot be compared from results alone, so each league
// carries an anchor: its goal rate from the data, its standard from a prior.

import type { Fixture, PastMatch } from "@/lib/types";


const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Half-life of a result, in days. The last ten reach back across a transfer
// window, so sixty days puts a match from last spring at about an eighth of
// last weekend's.
export const HALF_LIFE_DAYS = 60;

// How much a match counts, seen from a given date.
export function weightOf(kickoff: string, asOf: string): number {
  const days = (new Date(asOf).getTime() - new Date(kickoff).getTime()) / MS_PER_DAY;
  if (!Number.isFinite(days) || days <= 0) return 1;
  return 0.5 ** (days / HALF_LIFE_DAYS);
}

// How good the average team in a league is, with a mid-table side in England,
// Spain, Italy or Germany at 1.0. Results cannot supply this: two leagues whose
// teams never meet give two self-consistent tables with no way to line them up.
// Only bites when the two sides come from different leagues.
//
// No entry for the Champions League: it is not a home league, and the sides
// whose only football here is continental are the ones from outside the ten,
// which are weaker than the ten, not stronger.
export const LEAGUE_QUALITY: Record<string, number> = {
  PL: 1.0,
  PD: 0.97,
  SA: 0.95,
  BL1: 0.95,
  FL1: 0.88,
  PPL: 0.76,
  DED: 0.74,
  BSA: 0.72,
  ELC: 0.7,
};

// Where a side with no league of its own here is filed: a champion of a smaller
// European league, so around the level of a mid-table Ligue 1 side.
const OTHER = "OTHER";
const DEFAULT_QUALITY = 0.85;

// Never anybody's home league, so a team is not filed under one.
const CONTINENTAL = new Set(["CL", "EL", "ECL", "UCL", "EC", "WC"]);

// Prior weight on a rating, in matches. Backtested: see `npm run backtest`.
// Ten looks heavy, and on ten matches a side it is not. Under it the ratings
// lose to a flat league average, because three or four effective matches cannot
// separate a good team from a lucky one. As the archive fills the shrinkage
// falls out of it on its own, since it is n / (n + this).
const PRIOR_MATCHES = 10;

// The alternating fit settles inside ten; a few more cost nothing.
const PASSES = 14;

// Below this a competition's own goal rate is noise and the pooled one stands in.
const MIN_LEAGUE_SAMPLE = 25;

// Matches of prior on a league's goal rate, and on how that rate splits between
// the two ends. The split gets far more: home advantage barely varies between
// leagues, and a hundred matches is nowhere near enough to see that it does. Off
// a raw split, a quiet run of home form reads as an away league.
const RATE_PRIOR = 60;
const SPLIT_PRIOR = 250;

// Prior on a team's own home edge, in matches. Held down hard: at ten matches
// the home/away split is mostly noise, and the league-wide advantage already
// carries the real part.
const HOME_EDGE_PRIOR = 10;
const MAX_HOME_EDGE = 0.3;

export type TeamKey = string;

// Team ids are not on a past match, but the crest URL carries one.
export function keyOf(id: number | null, logo: string, fallback: string): TeamKey {
  if (id !== null && Number.isFinite(id)) return `t${id}`;
  const fromLogo = /\/(\d+)\.\w+$/.exec(logo ?? "");
  if (fromLogo) return `t${fromLogo[1]}`;
  return `n${fallback}`;
}

const opponentKey = (match: PastMatch): TeamKey =>
  keyOf(null, match.opponentLogo, match.opponentName || match.opponent);

export type PooledMatch = {
  id: number;
  kickoff: string;
  competition: string;
  home: TeamKey;
  away: TeamKey;
  goalsHome: number;
  goalsAway: number;
  weight: number;
};

// Every distinct match in the file, told neutrally. Keyed by fixture id because
// a derby sits in both teams' form. Played fixtures from this week are folded in
// as the freshest evidence there is.
export function poolMatches(fixtures: Fixture[], asOf: string): PooledMatch[] {
  const byId = new Map<number, PooledMatch>();

  const add = (
    id: number,
    kickoff: string,
    competition: string | null,
    home: TeamKey,
    away: TeamKey,
    goalsHome: number,
    goalsAway: number
  ) => {
    if (byId.has(id)) return;
    if (!Number.isFinite(goalsHome) || !Number.isFinite(goalsAway)) return;
    byId.set(id, {
      id,
      kickoff,
      competition: competition ?? "UNK",
      home,
      away,
      goalsHome,
      goalsAway,
      weight: weightOf(kickoff, asOf),
    });
  };

  for (const fixture of fixtures) {
    for (const form of [fixture.home, fixture.away]) {
      const team = keyOf(form.team.id, form.team.logo, form.team.short);

      for (const match of form.matches) {
        const other = opponentKey(match);
        if (match.venue === "home") {
          add(
            match.fixtureId,
            match.kickoff,
            match.competition,
            team,
            other,
            match.goalsFor,
            match.goalsAgainst
          );
        } else {
          add(
            match.fixtureId,
            match.kickoff,
            match.competition,
            other,
            team,
            match.goalsAgainst,
            match.goalsFor
          );
        }
      }
    }

    if (fixture.status === "finished" && fixture.result) {
      add(
        fixture.id,
        fixture.kickoff,
        competitionOf(fixture),
        keyOf(fixture.home.team.id, fixture.home.team.logo, fixture.home.team.short),
        keyOf(fixture.away.team.id, fixture.away.team.logo, fixture.away.team.short),
        fixture.result.goalsHome,
        fixture.result.goalsAway
      );
    }
  }

  return [...byId.values()];
}

// Archived matches carry no weight of their own, and a fixture seen in both
// wins: the live copy of a match is the stale one.
function withHistory(
  pool: PooledMatch[],
  history: PooledMatch[] | undefined,
  asOf: string
): PooledMatch[] {
  if (!history || history.length === 0) return pool;

  const byId = new Map<number, PooledMatch>();
  for (const match of history) {
    byId.set(match.id, { ...match, weight: weightOf(match.kickoff, asOf) });
  }
  for (const match of pool) byId.set(match.id, match);
  return [...byId.values()];
}

// Fixtures are keyed by api-football league id, form matches by football-data
// competition code. Only the codes have a quality prior, so a fixture is filed
// under whatever its sides mostly play in.
function competitionOf(fixture: Fixture): string | null {
  const counts = new Map<string, number>();
  for (const form of [fixture.home, fixture.away]) {
    for (const match of form.matches) {
      if (!match.competition || CONTINENTAL.has(match.competition)) continue;
      counts.set(match.competition, (counts.get(match.competition) ?? 0) + 1);
    }
  }

  let best: string | null = null;
  let most = 0;
  for (const [code, count] of counts) {
    if (count > most) {
      most = count;
      best = code;
    }
  }
  return best;
}

export type LeagueMean = { home: number; away: number; total: number; sample: number };

export type Ratings = {
  attack: Map<TeamKey, number>;
  defence: Map<TeamKey, number>;
  // Goals a side's own ground is worth it, capped and shrunk.
  homeEdge: Map<TeamKey, number>;
  // Matches behind a rating after decay. Drives the confidence dot.
  sample: Map<TeamKey, number>;
  league: Map<TeamKey, string>;
  leagueMean: Map<string, LeagueMean>;
  pooled: LeagueMean;
  matches: number;
};

const EMPTY_MEAN: LeagueMean = { home: 1.53, away: 1.24, total: 2.77, sample: 0 };

// Where a team plays week to week, so it can be lifted onto the common scale.
function homeLeagues(pool: PooledMatch[]): Map<TeamKey, string> {
  const counts = new Map<TeamKey, Map<string, number>>();

  const note = (team: TeamKey, competition: string) => {
    if (CONTINENTAL.has(competition)) return;
    let inner = counts.get(team);
    if (!inner) counts.set(team, (inner = new Map()));
    inner.set(competition, (inner.get(competition) ?? 0) + 1);
  };

  for (const match of pool) {
    note(match.home, match.competition);
    note(match.away, match.competition);
  }

  const leagues = new Map<TeamKey, string>();
  for (const [team, inner] of counts) {
    let best = "UNK";
    let most = 0;
    for (const [code, count] of inner) {
      if (count > most) {
        most = count;
        best = code;
      }
    }
    leagues.set(team, best);
  }

  // A side whose only football here is continental is from outside the ten, so
  // it is filed with the others like it rather than under the competition.
  for (const match of pool) {
    if (!leagues.has(match.home)) leagues.set(match.home, OTHER);
    if (!leagues.has(match.away)) leagues.set(match.away, OTHER);
  }

  return leagues;
}

function leagueMeans(pool: PooledMatch[]) {
  const sums = new Map<string, { home: number; away: number; weight: number; n: number }>();
  let home = 0;
  let away = 0;
  let weight = 0;

  for (const match of pool) {
    let entry = sums.get(match.competition);
    if (!entry) sums.set(match.competition, (entry = { home: 0, away: 0, weight: 0, n: 0 }));
    entry.home += match.goalsHome * match.weight;
    entry.away += match.goalsAway * match.weight;
    entry.weight += match.weight;
    entry.n += 1;

    home += match.goalsHome * match.weight;
    away += match.goalsAway * match.weight;
    weight += match.weight;
  }

  const pooled: LeagueMean =
    weight > 0
      ? { home: home / weight, away: away / weight, total: (home + away) / weight, sample: pool.length }
      : EMPTY_MEAN;

  const pooledShare = pooled.total > 0 ? pooled.home / pooled.total : 0.54;

  const means = new Map<string, LeagueMean>();
  for (const [code, entry] of sums) {
    if (entry.n < MIN_LEAGUE_SAMPLE || entry.weight <= 0) {
      means.set(code, { ...pooled, sample: entry.n });
      continue;
    }

    const own = (entry.home + entry.away) / entry.weight;
    const total = (own * entry.n + pooled.total * RATE_PRIOR) / (entry.n + RATE_PRIOR);

    const ownShare = entry.home + entry.away > 0 ? entry.home / (entry.home + entry.away) : pooledShare;
    const share = (ownShare * entry.n + pooledShare * SPLIT_PRIOR) / (entry.n + SPLIT_PRIOR);

    means.set(code, {
      home: total * share,
      away: total * (1 - share),
      total,
      sample: entry.n,
    });
  }

  return { means, pooled };
}

const qualityOf = (league: string) => LEAGUE_QUALITY[league] ?? DEFAULT_QUALITY;

// Lifts a league onto the common scale. Attack times defence has to reproduce
// the league's goal rate (from the data), their ratio has to reflect how good
// the league is (from the prior). Two equations, two unknowns.
function anchor(league: string, means: Map<string, LeagueMean>, pooled: LeagueMean) {
  const mean = means.get(league) ?? pooled;
  const rate = Math.sqrt(Math.max(mean.total, 0.5) / Math.max(pooled.total, 0.5));
  const quality = qualityOf(league);
  return { attack: quality * rate, defence: rate / quality };
}

export type FitOptions = {
  // Off holds every defence at league average, which is the old way of reading
  // form: a team's rate off its own goals. Kept so the backtest can price what
  // the opponent adjustment is worth.
  opponentAdjusted?: boolean;
  // Fit over these matches instead of the ones in the fixtures. The backtest
  // passes a training split; nothing else needs it.
  pool?: PooledMatch[];
  // Overrides PRIOR_MATCHES, so the backtest can sweep it.
  prior?: number;
  // Played matches from earlier refreshes, folded in before the fit. This is
  // what lifts a team past the ten its form carries.
  history?: PooledMatch[];
};

// Alternating maximum likelihood: hold defences still and every attack has a
// closed form, then the other way round. Converges fast, needs no solver.
export function fitRatings(
  fixtures: Fixture[],
  asOf?: string,
  options: FitOptions = {}
): Ratings {
  const latest =
    asOf ??
    fixtures.reduce(
      (newest, fixture) => (fixture.kickoff > newest ? fixture.kickoff : newest),
      fixtures[0]?.kickoff ?? new Date().toISOString()
    );

  const adjusted = options.opponentAdjusted !== false;
  const pool = options.pool ?? withHistory(poolMatches(fixtures, latest), options.history, latest);
  const { means, pooled } = leagueMeans(pool);
  const league = homeLeagues(pool);

  // Indexed per team so a pass walks a team's own matches, not the whole pool.
  type Appearance = { match: PooledMatch; at: "home" | "away" };
  const appearances = new Map<TeamKey, Appearance[]>();
  const push = (team: TeamKey, entry: Appearance) => {
    const list = appearances.get(team);
    if (list) list.push(entry);
    else appearances.set(team, [entry]);
  };

  for (const match of pool) {
    push(match.home, { match, at: "home" });
    push(match.away, { match, at: "away" });
  }

  const attack = new Map<TeamKey, number>();
  const defence = new Map<TeamKey, number>();
  const sample = new Map<TeamKey, number>();

  for (const [team, list] of appearances) {
    attack.set(team, 1);
    defence.set(team, 1);
    sample.set(team, list.reduce((sum, entry) => sum + entry.match.weight, 0));
  }

  const meanFor = (competition: string) => means.get(competition) ?? pooled;

  // Goals expected before the side's own attack is applied: the league rate for
  // that end of the pitch times the opponent's defence.
  const expected = (entry: Appearance, opponentDefence: number) => {
    const mean = meanFor(entry.match.competition);
    return (entry.at === "home" ? mean.home : mean.away) * opponentDefence;
  };

  // The prior is worth this many matches of a wholly average side.
  const priorMass = (options.prior ?? PRIOR_MATCHES) * Math.max(pooled.total / 2, 0.5);

  for (let pass = 0; pass < (adjusted ? PASSES : 1); pass += 1) {
    for (const [team, list] of appearances) {
      let scored = 0;
      let base = 0;
      for (const entry of list) {
        const other = entry.at === "home" ? entry.match.away : entry.match.home;
        const goals = entry.at === "home" ? entry.match.goalsHome : entry.match.goalsAway;
        scored += goals * entry.match.weight;
        base += expected(entry, defence.get(other) ?? 1) * entry.match.weight;
      }
      attack.set(team, (scored + priorMass) / (base + priorMass));
    }

    if (!adjusted) {
      normalise(attack, appearances, league, sample);
      continue;
    }

    for (const [team, list] of appearances) {
      let conceded = 0;
      let base = 0;
      for (const entry of list) {
        const other = entry.at === "home" ? entry.match.away : entry.match.home;
        const goals = entry.at === "home" ? entry.match.goalsAway : entry.match.goalsHome;
        conceded += goals * entry.match.weight;
        // The opponent's attack, against this team at the other end of the pitch.
        const mean = meanFor(entry.match.competition);
        const norm = entry.at === "home" ? mean.away : mean.home;
        base += norm * (attack.get(other) ?? 1) * entry.match.weight;
      }
      defence.set(team, (conceded + priorMass) / (base + priorMass));
    }

    normalise(attack, appearances, league, sample);
    normalise(defence, appearances, league, sample);
  }

  // Onto the common scale, once, at the end.
  for (const [team] of appearances) {
    const scale = anchor(league.get(team) ?? "UNK", means, pooled);
    attack.set(team, (attack.get(team) ?? 1) * scale.attack);
    defence.set(team, (defence.get(team) ?? 1) * scale.defence);
  }

  return {
    attack,
    defence,
    homeEdge: fitHomeEdge(appearances),
    sample,
    league,
    leagueMean: means,
    pooled,
    matches: pool.length,
  };
}

// Holds each league at an average of one. Without it attack and defence drift
// together pass over pass (doubling every attack and halving every defence
// describes the same matches), and the league anchor lands on a moving scale.
function normalise(
  values: Map<TeamKey, number>,
  appearances: Map<TeamKey, { match: PooledMatch; at: "home" | "away" }[]>,
  league: Map<TeamKey, string>,
  sample: Map<TeamKey, number>
) {
  const totals = new Map<string, { sum: number; weight: number }>();

  for (const [team] of appearances) {
    const code = league.get(team) ?? "UNK";
    const weight = sample.get(team) ?? 0;
    let entry = totals.get(code);
    if (!entry) totals.set(code, (entry = { sum: 0, weight: 0 }));
    entry.sum += (values.get(team) ?? 1) * weight;
    entry.weight += weight;
  }

  for (const [team] of appearances) {
    const code = league.get(team) ?? "UNK";
    const entry = totals.get(code);
    if (!entry || entry.weight <= 0) continue;
    const mean = entry.sum / entry.weight;
    if (mean > 0) values.set(team, (values.get(team) ?? 1) / mean);
  }
}

// A side's own home advantage in goals of swing, over the league's. Read off
// goal difference rather than goals, so a team that plays open matches at home
// does not read as strong there.
function fitHomeEdge(
  appearances: Map<TeamKey, { match: PooledMatch; at: "home" | "away" }[]>
): Map<TeamKey, number> {
  const edges = new Map<TeamKey, number>();

  for (const [team, list] of appearances) {
    let homeDiff = 0;
    let homeWeight = 0;
    let awayDiff = 0;
    let awayWeight = 0;

    for (const entry of list) {
      const { goalsHome, goalsAway, weight } = entry.match;
      if (entry.at === "home") {
        homeDiff += (goalsHome - goalsAway) * weight;
        homeWeight += weight;
      } else {
        awayDiff += (goalsAway - goalsHome) * weight;
        awayWeight += weight;
      }
    }

    if (homeWeight <= 0 || awayWeight <= 0) {
      edges.set(team, 0);
      continue;
    }

    const raw = (homeDiff / homeWeight - awayDiff / awayWeight) / 2;
    const evidence = Math.min(homeWeight, awayWeight);
    const shrunk = raw * (evidence / (evidence + HOME_EDGE_PRIOR));
    edges.set(team, Math.max(-MAX_HOME_EDGE, Math.min(MAX_HOME_EDGE, shrunk)));
  }

  return edges;
}

export type TeamRating = {
  attack: number;
  defence: number;
  homeEdge: number;
  // Effective matches behind it, after decay.
  sample: number;
  league: string;
};

export function ratingOf(ratings: Ratings, key: TeamKey): TeamRating {
  return {
    attack: ratings.attack.get(key) ?? 1,
    defence: ratings.defence.get(key) ?? 1,
    homeEdge: ratings.homeEdge.get(key) ?? 0,
    sample: ratings.sample.get(key) ?? 0,
    league: ratings.league.get(key) ?? "UNK",
  };
}

// One number per team for display and ordering: 100 is mid-table in a top
// league, higher is better.
export function overallRating(rating: TeamRating): number {
  return Math.round((rating.attack / Math.max(rating.defence, 0.2)) * 100);
}
