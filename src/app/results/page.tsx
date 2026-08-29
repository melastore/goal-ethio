import type { Metadata } from "next";

import { ResultsView } from "@/components/fixtures/results-view";
import { PageHeading } from "@/components/layout/page-heading";
import { loadWeek } from "@/lib/week-data";

export const metadata: Metadata = {
  title: "Results",
  description: "This week's finished matches, with what the model called beforehand.",
};

export default function ResultsPage() {
  const { graded, record } = loadWeek();

  return (
    <>
      <PageHeading titleKey="results.heading" />
      <ResultsView graded={graded} record={record} />
    </>
  );
}
