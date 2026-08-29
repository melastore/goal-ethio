// Shapes the fetch script writes and the site reads at build time.

export type Venue = "home" | "away";

export type Team = {
  id: number;
  name: string;
  short: string;
  logo: string;
};

// A finished match, from the point of view of the team whose form it belongs to.
export type PastMatch = {
  fixtureId: number;
  kickoff: string;
  venue: Venue;
  opponent: string;
  goalsFor: number;
  goalsAgainst: number;
  // "for" means this team scored first. Null on a goalless match.
  firstGoal: "for" | "against" | null;
  firstGoalMinute: number | null;
};

export type TeamForm = {
  team: Team;
  // Most recent first, at most eight.
  matches: PastMatch[];
};

export type Result = {
  goalsHome: number;
  goalsAway: number;
  firstGoal: Venue | null;
  firstGoalMinute: number | null;
  firstScorer: string | null;
};

export type Fixture = {
  id: number;
  leagueId: number;
  round: string;
  // ISO instant. Every clock on the site is derived from this.
  kickoff: string;
  status: "scheduled" | "finished";
  home: TeamForm;
  away: TeamForm;
  result: Result | null;
};

export type WeekData = {
  // True while the shipped placeholder is in place. The fetch script never sets
  // it, so real data clears it and the warning banner goes away on its own.
  sample?: boolean;
  generatedAt: string;
  // Monday of the covered week, in Addis terms.
  weekStart: string;
  fixtures: Fixture[];
};
