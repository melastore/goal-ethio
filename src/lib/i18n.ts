export type Language = "en" | "am";

export const languageLabels: Record<Language, string> = {
  en: "English",
  am: "አማርኛ",
};

export const translations = {
  en: {
    "site.name": "GoalEthio",
    "site.tagline": "Europe's top leagues, in Ethiopian time",
    "nav.fixtures": "Fixtures",
    "nav.results": "Results",
    "nav.how": "How it works",
    "language.label": "Language",

    "week.heading": "This week",
    "week.updated": "Updated",
    "week.empty": "No fixtures left this week. Check the results.",
    "week.picks": "Five to watch",
    "week.picksNote": "The week's clearest reads, by how far the model leans.",
    "week.all": "Every fixture",

    "card.chance": "Chance",
    "card.firstGoal": "Scores first",
    "card.neither": "No goal",
    "card.expected": "Expected goals",
    "card.openingGoal": "Opening goal around",
    "card.scorelines": "Likeliest scores",
    "card.btts": "Both score",
    "card.over": "Over 2.5",
    "card.form": "Last 8",
    "card.homeForm": "At home",
    "card.awayForm": "Away",
    "card.scoredFirstRate": "Scored first",
    "card.odds": "Fair odds",
    "card.lean": "Model leans",
    "card.draw": "Draw",

    "confidence.thin": "Thin data",
    "confidence.fair": "Fair data",
    "confidence.solid": "Solid data",
    "confidence.note": "Set by how many home and away matches both sides have on record.",

    "results.heading": "Results",
    "results.empty": "Nothing played yet this week.",
    "results.predicted": "Called",
    "results.actual": "Final",
    "results.firstScorer": "First goal",
    "results.hit": "Hit",
    "results.miss": "Miss",
    "results.record": "Record this week",
    "results.outcomeHits": "Match result",
    "results.firstGoalHits": "First goal",
    "results.scorelineHits": "Exact score",
    "results.calibration": "Mean chance given to what happened",

    "how.heading": "How it works",
    "how.body":
      "Each team's last eight matches are split into home and away, and turned into an attack and a defence number measured against the competition average. Those numbers multiply into a goals-per-match rate for each side, and the scoreline is drawn from there.",
    "how.shrink":
      "Eight matches split by venue leaves about four each way, so every rate is pulled toward the competition average by how thin it is. A team with two home matches on record reads as close to average, which is the honest answer.",
    "how.firstGoal":
      "Who scores first comes from treating the two scoring rates as a race: the side with the larger share of the combined rate opens the scoring more often, and the chance of a goalless match is taken out first.",
    "how.disclaimer":
      "Projections only. No bets are taken here and none are placed for you. A model built on eight matches is roughly as accurate as the market, not better than it.",
    "footer.note": "Data from api-football. Times shown on the Ethiopian clock.",
  },
  am: {
    "site.name": "GoalEthio",
    "site.tagline": "የአውሮፓ ታላላቅ ሊጎች፣ በኢትዮጵያ ሰዓት",
    "nav.fixtures": "ጨዋታዎች",
    "nav.results": "ውጤቶች",
    "nav.how": "እንዴት እንደሚሰራ",
    "language.label": "ቋንቋ",

    "week.heading": "የዚህ ሳምንት",
    "week.updated": "የተሻሻለው",
    "week.empty": "በዚህ ሳምንት የቀረ ጨዋታ የለም። ውጤቶቹን ይመልከቱ።",
    "week.picks": "አምስቱ ተመልከቷቸው",
    "week.picksNote": "ሞዴሉ በጣም ያዘነበለባቸው የሳምንቱ ጨዋታዎች።",
    "week.all": "ሁሉም ጨዋታዎች",

    "card.chance": "ዕድል",
    "card.firstGoal": "መጀመሪያ ግብ",
    "card.neither": "ግብ የለም",
    "card.expected": "የሚጠበቅ ግብ",
    "card.openingGoal": "የመጀመሪያው ግብ ገደማ",
    "card.scorelines": "የሚጠበቁ ውጤቶች",
    "card.btts": "ሁለቱም ያስቆጥራሉ",
    "card.over": "ከ2.5 በላይ",
    "card.form": "የመጨረሻ 8",
    "card.homeForm": "በሜዳው",
    "card.awayForm": "ከሜዳ ውጪ",
    "card.scoredFirstRate": "መጀመሪያ ያስቆጠረበት",
    "card.odds": "ትክክለኛ ኦድስ",
    "card.lean": "ሞዴሉ ያዘነበለው",
    "card.draw": "አቻ",

    "confidence.thin": "ውሱን መረጃ",
    "confidence.fair": "መጠነኛ መረጃ",
    "confidence.solid": "በቂ መረጃ",
    "confidence.note": "ሁለቱም ቡድኖች በሜዳቸውና ከሜዳ ውጪ ባላቸው የጨዋታ ብዛት ይወሰናል።",

    "results.heading": "ውጤቶች",
    "results.empty": "በዚህ ሳምንት ገና የተጫወተ የለም።",
    "results.predicted": "የተገመተው",
    "results.actual": "የመጨረሻ",
    "results.firstScorer": "የመጀመሪያ ግብ",
    "results.hit": "ትክክል",
    "results.miss": "ስህተት",
    "results.record": "የሳምንቱ ውጤታማነት",
    "results.outcomeHits": "የጨዋታ ውጤት",
    "results.firstGoalHits": "መጀመሪያ ግብ",
    "results.scorelineHits": "ትክክለኛ ውጤት",
    "results.calibration": "ለተከሰተው የተሰጠ አማካይ ዕድል",

    "how.heading": "እንዴት እንደሚሰራ",
    "how.body":
      "የእያንዳንዱ ቡድን የመጨረሻ ስምንት ጨዋታዎች በሜዳና ከሜዳ ውጪ ተከፍለው፣ ከውድድሩ አማካይ ጋር በማነጻጸር የማጥቃትና የመከላከል አኃዝ ይሰላል። እነዚህ ተባዝተው ለእያንዳንዱ ወገን የግብ መጠን ይሰጣሉ።",
    "how.shrink":
      "ስምንት ጨዋታ በሜዳ ተከፍሎ ለእያንዳንዱ አራት ገደማ ስለሚሆን፣ መረጃው ባነሰ ቁጥር ውጤቱ ወደ ውድድሩ አማካይ ይሳባል። ሁለት የሜዳ ጨዋታ ብቻ ያለው ቡድን ወደ አማካይ ቀርቦ ይነበባል።",
    "how.firstGoal":
      "መጀመሪያ ማን እንደሚያስቆጥር የሚወሰነው ሁለቱን የግብ መጠኖች እንደ ውድድር በመቁጠር ነው፤ ከጠቅላላው ድርሻ የበለጠ ያለው ወገን በብዛት ይቀድማል።",
    "how.disclaimer":
      "ግምት ብቻ ነው። እዚህ ውርርድ አይቀበልም፣ ለእርስዎም አይደረግም። በስምንት ጨዋታ የተሰራ ሞዴል ከገበያው የተሻለ አይደለም።",
    "footer.note": "መረጃው ከapi-football። ሰዓቱ በኢትዮጵያ አቆጣጠር።",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export function translate(language: Language, key: TranslationKey, fallback?: string) {
  return translations[language][key] ?? translations.en[key] ?? fallback ?? key;
}
