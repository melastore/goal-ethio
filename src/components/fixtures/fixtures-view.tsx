"use client";

import { MatchCard } from "@/components/fixtures/match-card";
import { useLanguage } from "@/components/providers/language-provider";
import { groupByEthiopianDay } from "@/lib/ethiopian-date";
import { lean } from "@/lib/model";
import type { Projected } from "@/lib/week-data";

// The five the model is most sure about, by how far the top outcome clears the
// next one. A 55/25/20 is a clearer read than a 40/35/25 with a higher top.
const PICKS = 5;

export function FixturesView({ upcoming }: { upcoming: Projected[] }) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  if (upcoming.length === 0) {
    return (
      <p className={`rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground ${amharic ? "amharic" : ""}`}>
        {t("week.empty")}
      </p>
    );
  }

  const picks = [...upcoming]
    .sort((a, b) => lean(b.projection.outcome).margin - lean(a.projection.outcome).margin)
    .slice(0, PICKS);

  const pickIds = new Set(picks.map((entry) => entry.fixture.id));
  const rest = upcoming.filter((entry) => !pickIds.has(entry.fixture.id));
  const days = groupByEthiopianDay(rest, (entry) => entry.fixture.kickoff);

  return (
    <div className="space-y-8">
      <section>
        <h2 className={`text-lg font-semibold ${amharic ? "amharic" : ""}`}>
          {t("week.picks")}
        </h2>
        <p className={`mt-0.5 text-sm text-muted-foreground ${amharic ? "amharic" : ""}`}>
          {t("week.picksNote")}
        </p>
        <div className="mt-3 space-y-3">
          {picks.map((entry) => (
            <MatchCard
              key={entry.fixture.id}
              fixture={entry.fixture}
              projection={entry.projection}
            />
          ))}
        </div>
      </section>

      {days.length > 0 && (
        <section>
          <h2 className={`text-lg font-semibold ${amharic ? "amharic" : ""}`}>
            {t("week.all")}
          </h2>
          <div className="mt-3 space-y-6">
            {days.map((day) => (
              <div key={day.kickoff.date.toISOString()}>
                <h3 className="mb-2 flex items-baseline gap-2 text-sm font-medium">
                  <span className={amharic ? "amharic" : undefined}>
                    {amharic ? day.kickoff.weekday.amharic : day.kickoff.weekday.label}
                  </span>
                  <span className={`text-xs font-normal text-muted-foreground ${amharic ? "amharic" : ""}`}>
                    {amharic
                      ? day.kickoff.ethiopianDateAmharic
                      : `${day.kickoff.ethiopianDate} · ${day.kickoff.gregorianDate}`}
                  </span>
                </h3>
                <div className="space-y-3">
                  {day.items.map((entry) => (
                    <MatchCard
                      key={entry.fixture.id}
                      fixture={entry.fixture}
                      projection={entry.projection}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
