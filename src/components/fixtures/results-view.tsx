"use client";

import { ResultCard } from "@/components/fixtures/result-card";
import { SampleNotice } from "@/components/layout/sample-notice";
import { useLanguage } from "@/components/providers/language-provider";
import { percent, rate } from "@/lib/format";
import type { Graded, Tally } from "@/lib/scoring";

type Props = {
  graded: Graded[];
  record: Tally;
  sample: boolean;
};

export function ResultsView({ graded, record, sample }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  return (
    <>
      {sample && <SampleNotice />}
      <h1
        className={`mb-6 text-[26px] font-bold leading-tight tracking-tight sm:text-3xl ${
          amharic ? "amharic" : ""
        }`}
      >
        {t("results.heading")}
      </h1>

      {graded.length === 0 ? (
        <p
          className={`rounded-[16px] border border-hairline bg-card px-6 py-10 text-center text-sm text-muted-foreground ${
            amharic ? "amharic" : ""
          }`}
        >
          {t("results.empty")}
        </p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[16px] border border-hairline bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className={`text-sm font-bold ${amharic ? "amharic" : ""}`}>{t("results.record")}</h2>

            <dl className="mt-4 grid grid-cols-3 gap-4">
              <Score
                label={t("results.outcomeHits")}
                value={rate(record.outcomeHits, record.played)}
                detail={`${record.outcomeHits}/${record.played}`}
                amharic={amharic}
              />
              <Score
                label={t("results.firstGoalHits")}
                value={rate(record.firstGoalHits, record.firstGoalGraded)}
                detail={`${record.firstGoalHits}/${record.firstGoalGraded}`}
                amharic={amharic}
              />
              <Score
                label={t("results.scorelineHits")}
                value={rate(record.scorelineHits, record.played)}
                detail={`${record.scorelineHits}/${record.played}`}
                amharic={amharic}
              />
            </dl>

            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
              <span className={`text-xs text-muted-foreground ${amharic ? "amharic" : ""}`}>
                {t("results.calibration")}
              </span>
              <span className="font-mono text-xs font-semibold tnum">
                {percent(record.meanProbabilityOfActual, 1)}
              </span>
            </div>
          </section>

          <div className="space-y-3">
            {graded.map((entry) => (
              <ResultCard key={entry.fixture.id} graded={entry} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Score({
  label,
  value,
  detail,
  amharic,
}: {
  label: string;
  value: string;
  detail: string;
  amharic: boolean;
}) {
  return (
    <div>
      <dt className={`truncate text-[11px] text-muted-foreground ${amharic ? "amharic" : ""}`}>
        {label}
      </dt>
      <dd className="mt-1 font-mono text-2xl font-bold tnum leading-none">{value}</dd>
      <div className="mt-1 font-mono text-[11px] tnum text-subtle">{detail}</div>
    </div>
  );
}
