import { FixturesView } from "@/components/fixtures/fixtures-view";
import { PageHeading } from "@/components/layout/page-heading";
import { loadWeek } from "@/lib/week-data";

export default function FixturesPage() {
  const { upcoming } = loadWeek();

  return (
    <>
      <PageHeading titleKey="week.heading" leadKey="site.tagline" />
      <FixturesView upcoming={upcoming} />
    </>
  );
}
