// Reads an instant off Addis's clock, not the device's, so a page opened
// abroad shows the same kickoff time as one opened in Bole.

export const ADDIS_ZONE = "Africa/Addis_Ababa";

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: ADDIS_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// A Date carrying Addis's reading in its local fields. It deliberately points
// at a different instant, so local getters and any formatter over them speak
// for Ethiopia.
export function addisWallClock(date: Date): Date {
  const parts = PARTS.formatToParts(date);
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return new Date(
    field("year"),
    field("month") - 1,
    field("day"),
    // en-US writes midnight as 24 in this shape.
    field("hour") % 24,
    field("minute"),
    field("second")
  );
}

// Whether the device already reads what Addis reads. Nairobi keeps the same
// clock without being Ethiopia, and there is nothing to add for it.
export function matchesAddis(date: Date): boolean {
  // Under a minute apart is the same offset: no zone sits between one second
  // and thirty minutes of another.
  return Math.abs(addisWallClock(date).getTime() - date.getTime()) < 60_000;
}
