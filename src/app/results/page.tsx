import type { Metadata } from "next";

import { ResultsView } from "@/components/fixtures/results-view";
import { loadWeek } from "@/lib/week-data";

export const metadata: Metadata = {
  title: "Results",
  description: "This week's finished matches, with what the model called beforehand.",
};

export default function ResultsPage() {
  const { graded, record, sample } = loadWeek();

  return <ResultsView graded={graded} record={record} sample={sample} />;
}
