"use client";

import { ResultCard } from "@/components/fixtures/result-card";
import { useLanguage } from "@/components/providers/language-provider";
import { percent, rate } from "@/lib/format";
import type { Graded, Tally } from "@/lib/scoring";

type Props = {
  graded: Graded[];
  record: Tally;
};

export function ResultsView({ graded, record }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  if (graded.length === 0) {
    return (
      <p className={`rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground ${amharic ? "amharic" : ""}`}>
        {t("results.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-4">
        <h2 className={`text-sm font-semibold ${amharic ? "amharic" : ""}`}>
          {t("results.record")}
        </h2>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <Score
            label={t("results.outcomeHits")}
            value={rate(record.outcomeHits, record.played)}
            detail={`${record.outcomeHits}/${record.played}`}
          />
          <Score
            label={t("results.firstGoalHits")}
            value={rate(record.firstGoalHits, record.firstGoalGraded)}
            detail={`${record.firstGoalHits}/${record.firstGoalGraded}`}
          />
          <Score
            label={t("results.scorelineHits")}
            value={rate(record.scorelineHits, record.played)}
            detail={`${record.scorelineHits}/${record.played}`}
          />
        </dl>
        <p className={`mt-3 border-t pt-3 text-xs text-muted-foreground ${amharic ? "amharic" : ""}`}>
          {t("results.calibration")}:{" "}
          <span className="font-mono">{percent(record.meanProbabilityOfActual, 1)}</span>
        </p>
      </section>

      <div className="space-y-3">
        {graded.map((entry) => (
          <ResultCard key={entry.fixture.id} graded={entry} />
        ))}
      </div>
    </div>
  );
}

function Score({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{value}</dd>
      <div className="font-mono text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}
