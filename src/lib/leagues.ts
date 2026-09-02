// Competitions the site covers, with the ids api-football knows them by.

export type LeagueId = 39 | 140 | 135 | 78 | 61 | 2 | 88 | 94 | 40 | 71 | 4;

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
  { id: 88, name: "Eredivisie", amharic: "ኤሬዲቪዚ", country: "Netherlands", short: "DED" },
  { id: 94, name: "Primeira Liga", amharic: "ፕሪሜይራ ሊጋ", country: "Portugal", short: "PPL" },
  { id: 40, name: "Championship", amharic: "ቻምፒዮንሺፕ", country: "England", short: "ELC" },
  { id: 71, name: "Brasileirao", amharic: "ብራዚል ሴሪ አ", country: "Brazil", short: "BSA" },
  { id: 4, name: "European Championship", amharic: "የአውሮፓ ዋንጫ", country: "Europe", short: "EURO" },
];

export const leagueById = (id: number): League | undefined =>
  LEAGUES.find((league) => league.id === id);

// The fixture list is keyed by api-football id; football-data, which the live
// worker calls, knows the same competitions by these codes.
const CODES: Record<number, string> = {
  39: "PL",
  140: "PD",
  135: "SA",
  78: "BL1",
  61: "FL1",
  2: "CL",
  88: "DED",
  94: "PPL",
  40: "ELC",
  71: "BSA",
  4: "EC",
};

export const codeOf = (id: number): string | undefined => CODES[id];

// Scoring rates are pooled per competition: continental form is set against a
// different standard than a domestic weekend, and mixing them skews both.
export const isContinental = (id: number) => id === 2 || id === 4;

// The five the site leads on. The rest are listed but sit below them.
export const TOP_FIVE = new Set([39, 140, 135, 78, 61]);
