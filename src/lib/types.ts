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
  // Competition code, so a cup upset is not read as league form.
  competition: string | null;
  venue: Venue;
  opponent: string;
  opponentName: string;
  opponentLogo: string;
  goalsFor: number;
  goalsAgainst: number;
  // The only split of the match this data source gives. Null when not reported.
  halfFor: number | null;
  halfAgainst: number | null;
  // "for" means this team scored first. Null on a goalless match.
  firstGoal: "for" | "against" | null;
  firstGoalMinute: number | null;
};

export type TeamForm = {
  team: Team;
  // Most recent first: the last five at home and the last five away.
  matches: PastMatch[];
};

// An earlier meeting between the two sides, told neutrally rather than from one
// team's side, because either team can be at home in it.
export type H2HMatch = {
  fixtureId: number;
  kickoff: string;
  competition: string | null;
  homeId: number;
  home: string;
  away: string;
  goalsHome: number;
  goalsAway: number;
  halfHome: number | null;
  halfAway: number | null;
};

export type Result = {
  goalsHome: number;
  goalsAway: number;
  halfHome: number | null;
  halfAway: number | null;
  firstGoal: Venue | null;
  firstGoalMinute: number | null;
  firstScorer: string | null;
  minute?: number | null;
  period?: string | null;
};

export type Fixture = {
  id: number;
  leagueId: number;
  round: string;
  // ISO instant. Every clock on the site is derived from this.
  kickoff: string;
  status: "scheduled" | "live" | "finished";
  home: TeamForm;
  away: TeamForm;
  // Earlier meetings between these two, most recent first.
  h2h: H2HMatch[];
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
