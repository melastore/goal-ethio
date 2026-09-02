import type { Metadata } from "next";

import { ResultsView } from "@/components/fixtures/results-view";
import { loadWeek } from "@/lib/week-data";

export const metadata: Metadata = {
  title: "Results",
  description: "This week's finished matches, with what the model called beforehand.",
};

export default function ResultsPage() {
  const { results, record, sample, live, upcoming } = loadWeek();

  return (
    <ResultsView
      results={results}
      record={record}
      sample={sample}
      live={live}
      upcoming={upcoming}
    />
  );
}
