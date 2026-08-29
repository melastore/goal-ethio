"use client";

import { MatchCard } from "@/components/fixtures/match-card";
import { SampleNotice } from "@/components/layout/sample-notice";
import { WeekHero } from "@/components/fixtures/week-hero";
import { useLanguage } from "@/components/providers/language-provider";
import { groupByEthiopianDay } from "@/lib/ethiopian-date";
import { lean } from "@/lib/model";
import type { Projected } from "@/lib/week-data";

// A 55/25/20 is a clearer read than a 40/35/25 with a higher top, so the picks
// are ranked by how far the leading outcome clears the next one, not by its size.
const PICKS = 5;

type Props = {
  upcoming: Projected[];
  playedCount: number;
  sample: boolean;
};

export function FixturesView({ upcoming, playedCount, sample }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  if (upcoming.length === 0) {
    return (
      <>
        {sample && <SampleNotice />}
        <WeekHero upcoming={upcoming} playedCount={playedCount} />
        <p
          className={`rounded-[16px] border border-hairline bg-card px-6 py-10 text-center text-sm text-muted-foreground ${
            amharic ? "amharic" : ""
          }`}
        >
          {t("week.empty")}
        </p>
      </>
    );
  }

  const picks = [...upcoming]
    .sort((a, b) => lean(b.projection.outcome).margin - lean(a.projection.outcome).margin)
    .slice(0, PICKS);

  const pickIds = new Set(picks.map((entry) => entry.fixture.id));
  const days = groupByEthiopianDay(
    upcoming.filter((entry) => !pickIds.has(entry.fixture.id)),
    (entry) => entry.fixture.kickoff
  );

  return (
    <>
      {sample && <SampleNotice />}
      <WeekHero upcoming={upcoming} playedCount={playedCount} />

      <section>
        <SectionHeading title={t("week.picks")} note={t("week.picksNote")} amharic={amharic} />
        <div className="mt-3.5 space-y-3">
          {picks.map((entry, index) => (
            <MatchCard
              key={entry.fixture.id}
              fixture={entry.fixture}
              projection={entry.projection}
              rank={index + 1}
            />
          ))}
        </div>
      </section>

      {days.length > 0 && (
        <section className="mt-10">
          <SectionHeading title={t("week.all")} amharic={amharic} />

          <div className="mt-3.5 space-y-7">
            {days.map((day) => (
              <div key={day.kickoff.date.toISOString()}>
                <div className="sticky top-[104px] z-10 -mx-1 mb-2.5 flex items-baseline gap-2 bg-background/90 px-1 py-1 backdrop-blur-sm">
                  <span className={`text-sm font-semibold ${amharic ? "amharic" : ""}`}>
                    {amharic ? day.kickoff.weekday.amharic : day.kickoff.weekday.label}
                  </span>
                  <span className={`text-xs text-subtle ${amharic ? "amharic" : ""}`}>
                    {amharic ? day.kickoff.ethiopianDateAmharic : day.kickoff.ethiopianDate}
                  </span>
                </div>

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
    </>
  );
}

function SectionHeading({
  title,
  note,
  amharic,
}: {
  title: string;
  note?: string;
  amharic: boolean;
}) {
  return (
    <div>
      <h2 className={`text-lg font-bold tracking-tight ${amharic ? "amharic" : ""}`}>{title}</h2>
      {note && (
        <p className={`mt-0.5 text-sm text-muted-foreground ${amharic ? "amharic" : ""}`}>
          {note}
        </p>
      )}
    </div>
  );
}
