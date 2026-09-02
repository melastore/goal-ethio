// Names a selection off the board. Same reason as note-text: every phrase takes
// a team name or a line, and a table of format strings reads worse.

import type { Language } from "@/lib/i18n";
import type { Quote } from "@/lib/markets";

type Sides = { home: string; away: string };
type Phrase = (values: (string | number)[], sides: Sides) => string;

const EN: Record<string, Phrase> = {
  home: (_v, s) => `${s.home} to win`,
  draw: () => "Draw",
  away: (_v, s) => `${s.away} to win`,
  over: ([line]) => `Over ${line} goals`,
  under: ([line]) => `Under ${line} goals`,
  bttsYes: () => "Both teams to score",
  bttsNo: () => "One side keeps it out",
  dnbHome: (_v, s) => `${s.home}, draw no bet`,
  dnbAway: (_v, s) => `${s.away}, draw no bet`,
  homeOrDraw: (_v, s) => `${s.home} or draw`,
  drawOrAway: (_v, s) => `${s.away} or draw`,
  homeOrAway: () => "Either side, not the draw",
  homeCleanSheet: (_v, s) => `${s.home} clean sheet`,
  awayCleanSheet: (_v, s) => `${s.away} clean sheet`,
  homeBothHalves: (_v, s) => `${s.home} score in both halves`,
  awayBothHalves: (_v, s) => `${s.away} score in both halves`,
  goalEachHalf: () => "A goal in each half",
  htOver: ([line]) => `Over ${line} before the break`,
  htUnder: ([line]) => `Under ${line} before the break`,
  "rb.homeYes": (_v, s) => `${s.home} win, both score`,
  "rb.homeNo": (_v, s) => `${s.home} win, clean sheet`,
  "rb.drawYes": () => "Score draw",
  "rb.drawNo": () => "Goalless draw",
  "rb.awayYes": (_v, s) => `${s.away} win, both score`,
  "rb.awayNo": (_v, s) => `${s.away} win, clean sheet`,
};

const AM: Record<string, Phrase> = {
  home: (_v, s) => `${s.home} ያሸንፋሉ`,
  draw: () => "አቻ",
  away: (_v, s) => `${s.away} ያሸንፋሉ`,
  over: ([line]) => `ከ${line} ግቦች በላይ`,
  under: ([line]) => `ከ${line} ግቦች በታች`,
  bttsYes: () => "ሁለቱም ያስቆጥራሉ",
  bttsNo: () => "አንዱ ሳያስተናግድ ይጨርሳል",
  dnbHome: (_v, s) => `${s.home}፣ አቻ ከሆነ ገንዘብ ይመለሳል`,
  dnbAway: (_v, s) => `${s.away}፣ አቻ ከሆነ ገንዘብ ይመለሳል`,
  homeOrDraw: (_v, s) => `${s.home} ወይም አቻ`,
  drawOrAway: (_v, s) => `${s.away} ወይም አቻ`,
  homeOrAway: () => "አንዱ ወገን፣ አቻ ሳይሆን",
  homeCleanSheet: (_v, s) => `${s.home} ግብ ሳያስተናግዱ`,
  awayCleanSheet: (_v, s) => `${s.away} ግብ ሳያስተናግዱ`,
  homeBothHalves: (_v, s) => `${s.home} በሁለቱም አጋማሽ ያስቆጥራሉ`,
  awayBothHalves: (_v, s) => `${s.away} በሁለቱም አጋማሽ ያስቆጥራሉ`,
  goalEachHalf: () => "በእያንዳንዱ አጋማሽ ግብ",
  htOver: ([line]) => `ከእረፍት በፊት ከ${line} በላይ`,
  htUnder: ([line]) => `ከእረፍት በፊት ከ${line} በታች`,
  "rb.homeYes": (_v, s) => `${s.home} ያሸንፋሉ፣ ሁለቱም ያስቆጥራሉ`,
  "rb.homeNo": (_v, s) => `${s.home} ግብ ሳያስተናግዱ ያሸንፋሉ`,
  "rb.drawYes": () => "ግብ ያለበት አቻ",
  "rb.drawNo": () => "ግብ አልባ አቻ",
  "rb.awayYes": (_v, s) => `${s.away} ያሸንፋሉ፣ ሁለቱም ያስቆጥራሉ`,
  "rb.awayNo": (_v, s) => `${s.away} ግብ ሳያስተናግዱ ያሸንፋሉ`,
};

export function quoteText(
  quote: Pick<Quote, "key" | "values">,
  language: Language,
  home: string,
  away: string
): string {
  const table = language === "am" ? AM : EN;
  const phrase = table[quote.key] ?? EN[quote.key];
  // A selection with no phrase is still better named by its key than dropped.
  return phrase ? phrase(quote.values, { home, away }) : quote.key;
}
