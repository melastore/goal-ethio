// The archive of played matches.
//
// A refresh pulls each team's last ten and throws away what it pulled the week
// before, which caps the ratings at ten matches a side. Backtested, that is not
// enough to beat a flat league average: three or four effective matches after
// decay cannot tell a good team from a lucky one.
//
// So every match the fetch has ever seen is kept here instead. It costs no
// extra calls, the file grows by a few hundred rows a week, and the ratings get
// stronger on their own as it fills.

import type { PooledMatch } from "@/lib/ratings";

// Short keys: this file is committed on every refresh and read on every build.
export type ArchivedMatch = {
  i: number;
  k: string;
  c: string;
  h: string;
  a: string;
  gh: number;
  ga: number;
};

export type History = {
  generatedAt: string;
  matches: ArchivedMatch[];
};

// Past this a result says nothing about a squad that has turned over twice.
export const MAX_AGE_DAYS = 500;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const toArchived = (match: PooledMatch): ArchivedMatch => ({
  i: match.id,
  k: match.kickoff,
  c: match.competition,
  h: match.home,
  a: match.away,
  gh: match.goalsHome,
  ga: match.goalsAway,
});

// Weight is left at zero: the fit sets it against its own cutoff.
export const fromArchived = (row: ArchivedMatch): PooledMatch => ({
  id: row.i,
  kickoff: row.k,
  competition: row.c,
  home: row.h,
  away: row.a,
  goalsHome: row.gh,
  goalsAway: row.ga,
  weight: 0,
});

// Newer rows win: a match seen live and archived mid-play is corrected by the
// finished version of itself on the next run.
export function merge(existing: ArchivedMatch[], incoming: ArchivedMatch[], asOf: string): ArchivedMatch[] {
  const byId = new Map<number, ArchivedMatch>();
  for (const row of existing) byId.set(row.i, row);
  for (const row of incoming) byId.set(row.i, row);

  const floor = new Date(asOf).getTime() - MAX_AGE_DAYS * MS_PER_DAY;

  return [...byId.values()]
    .filter((row) => {
      const at = new Date(row.k).getTime();
      return Number.isFinite(at) && at >= floor;
    })
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i));
}
