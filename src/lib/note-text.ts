// Turns a Note into a sentence. Kept out of the flat translation table because
// every phrase interpolates, and a table of format strings reads worse than the
// phrases themselves.

import type { Language } from "@/lib/i18n";
import type { Note } from "@/lib/read";

type Phrase = (values: (string | number)[]) => string;

const EN: Record<Note["key"], Phrase> = {
  strongFavourite: ([team, p]) => `${team} are the clear side at ${p}%.`,
  tightMatch: ([p]) => `Nothing separates these three: the top read is only ${p}%.`,
  homeFortress: ([team, won, of]) => `${team} have won ${won} of ${of} at home.`,
  awayTravellers: ([team, kept, of]) => `${team} are unbeaten in ${kept} of ${of} away.`,
  leakyDefence: ([team, rate]) => `${team} are shipping ${rate} a game at this venue.`,
  meanDefence: () => `Both defences are keeping it under a goal a game.`,
  goalsExpected: ([p]) => `Goals look likely: over 2.5 lands ${p}% of the time.`,
  goalsScarce: ([p]) => `A quiet one is the read: under 2.5 at ${p}%.`,
  scoresFirst: ([team, hit, of]) => `${team} opened the scoring in ${hit} of ${of}.`,
  slowStarters: ([p]) => `Slow starts on both sides: ${p}% chance of a goalless half.`,
  fastStarters: ([p]) => `Expect an early goal: ${p}% for one before the break.`,
  formSwing: ([team, way]) =>
    `${team} are markedly ${way} at this venue than their overall form suggests.`,
  thinEvidence: ([n]) => `Read this softly: only ${n} match on record at these venues.`,
};

const AM: Record<Note["key"], Phrase> = {
  strongFavourite: ([team, p]) => `${team} በ${p}% ግልጽ የበላይነት አላቸው።`,
  tightMatch: ([p]) => `ሦስቱም ተቀራራቢ ናቸው፤ ከፍተኛው ግምት ${p}% ብቻ ነው።`,
  homeFortress: ([team, won, of]) => `${team} በሜዳቸው ከ${of} ${won} አሸንፈዋል።`,
  awayTravellers: ([team, kept, of]) => `${team} ከሜዳ ውጪ ከ${of} ${kept} ሳይሸነፉ አልፈዋል።`,
  leakyDefence: ([team, rate]) => `${team} በዚህ ሜዳ በጨዋታ ${rate} ግብ ያስተናግዳሉ።`,
  meanDefence: () => `ሁለቱም መከላከያዎች በጨዋታ ከአንድ ግብ በታች እያስተናገዱ ነው።`,
  goalsExpected: ([p]) => `ግቦች ይጠበቃሉ፤ ከ2.5 በላይ በ${p}% ይከሰታል።`,
  goalsScarce: ([p]) => `ጸጥ ያለ ጨዋታ ይጠበቃል፤ ከ2.5 በታች በ${p}%።`,
  scoresFirst: ([team, hit, of]) => `${team} ከ${of} በ${hit} መጀመሪያ አስቆጥረዋል።`,
  slowStarters: ([p]) => `ሁለቱም በዝግታ ይጀምራሉ፤ ${p}% ግብ አልባ የመጀመሪያ አጋማሽ።`,
  fastStarters: ([p]) => `ቀደም ያለ ግብ ይጠበቃል፤ ${p}% ከእረፍት በፊት።`,
  formSwing: ([team, way]) =>
    `${team} በዚህ ሜዳ ከአጠቃላይ አቋማቸው በእጅጉ ${way === "better" ? "የተሻሉ" : "የደከሙ"} ናቸው።`,
  thinEvidence: ([n]) => `በጥንቃቄ ይነበብ፤ በእነዚህ ሜዳዎች ${n} ጨዋታ ብቻ ነው ያለው።`,
};

export function noteText(note: Note, language: Language): string {
  const table = language === "am" ? AM : EN;
  return table[note.key](note.values);
}
