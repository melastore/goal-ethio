import { FixturesView } from "@/components/fixtures/fixtures-view";
import { loadWeek } from "@/lib/week-data";

export default function FixturesPage() {
  const { upcoming, results, sample } = loadWeek();

  return <FixturesView upcoming={upcoming} playedCount={results.length} sample={sample} />;
}
