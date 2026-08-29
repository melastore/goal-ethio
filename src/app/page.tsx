import { FixturesView } from "@/components/fixtures/fixtures-view";
import { loadWeek } from "@/lib/week-data";

export default function FixturesPage() {
  const { upcoming, graded, sample } = loadWeek();

  return <FixturesView upcoming={upcoming} playedCount={graded.length} sample={sample} />;
}
