// Competitions the site covers, with the ids api-football knows them by.

export type LeagueId = 39 | 140 | 135 | 78 | 61 | 2;

export type League = {
  id: LeagueId;
  name: string;
  amharic: string;
  country: string;
  short: string;
};

export const LEAGUES: League[] = [
  { id: 39, name: "Premier League", amharic: "ፕሪሚየር ሊግ", country: "England", short: "EPL" },
  { id: 140, name: "La Liga", amharic: "ላ ሊጋ", country: "Spain", short: "LAL" },
  { id: 135, name: "Serie A", amharic: "ሴሪ አ", country: "Italy", short: "SER" },
  { id: 78, name: "Bundesliga", amharic: "ቡንደስሊጋ", country: "Germany", short: "BUN" },
  { id: 61, name: "Ligue 1", amharic: "ሊግ 1", country: "France", short: "L1" },
  { id: 2, name: "Champions League", amharic: "ሻምፒዮንስ ሊግ", country: "Europe", short: "UCL" },
];

export const leagueById = (id: number): League | undefined =>
  LEAGUES.find((league) => league.id === id);

// Scoring rates are pooled per competition: UCL form is set against a different
// standard than a domestic weekend, and mixing them skews both.
export const isContinental = (id: number) => id === 2;
