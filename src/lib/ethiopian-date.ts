// Kickoff said the way it is said in Addis: Ethiopian date, and a clock counted
// from dawn. Both read off the Addis wall clock, never the device's.

import Kenat from "kenat";

import { addisWallClock } from "@/lib/addis-time";
import { ethiopianTimeAt, formatEthiopianClock } from "@/lib/ethiopian-clock";

export const ETHIOPIAN_MONTHS = [
  { label: "Meskerem", amharic: "መስከረም" },
  { label: "Tikimt", amharic: "ጥቅምት" },
  { label: "Hidar", amharic: "ኅዳር" },
  { label: "Tahsas", amharic: "ታኅሣሥ" },
  { label: "Tir", amharic: "ጥር" },
  { label: "Yekatit", amharic: "የካቲት" },
  { label: "Megabit", amharic: "መጋቢት" },
  { label: "Miyazya", amharic: "ሚያዝያ" },
  { label: "Ginbot", amharic: "ግንቦት" },
  { label: "Sene", amharic: "ሰኔ" },
  { label: "Hamle", amharic: "ሐምሌ" },
  { label: "Nehase", amharic: "ነሐሴ" },
  { label: "Pagume", amharic: "ጳጉሜ" },
];

export const WEEKDAYS = [
  { label: "Sunday", amharic: "እሑድ" },
  { label: "Monday", amharic: "ሰኞ" },
  { label: "Tuesday", amharic: "ማክሰኞ" },
  { label: "Wednesday", amharic: "ረቡዕ" },
  { label: "Thursday", amharic: "ሐሙስ" },
  { label: "Friday", amharic: "ዓርብ" },
  { label: "Saturday", amharic: "ቅዳሜ" },
];

export type Kickoff = {
  date: Date;
  ethiopian: { year: number; month: number; day: number };
  // መስከረም 12, 2018
  ethiopianDate: string;
  ethiopianDateAmharic: string;
  weekday: { label: string; amharic: string };
  // 4:00, the hour as it is said, counted from dawn.
  ethiopianClock: string;
  // ከሌሊቱ and the rest. The hour alone is only half a time.
  periodAmharic: string;
  periodEnglish: string;
  // ከምሽቱ 4:00
  ethiopianTime: string;
  // 22:00, the same moment on the 24-hour clock.
  eatTime: string;
  // Gregorian, for cross-checking against a broadcast listing.
  gregorianDate: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

export function readKickoff(iso: string): Kickoff {
  const date = new Date(iso);
  // Every field below reads off Addis, not the device.
  const wall = addisWallClock(date);

  const ethiopian = new Kenat(wall).getEthiopian();
  const month = ETHIOPIAN_MONTHS[ethiopian.month - 1];
  const weekday = WEEKDAYS[wall.getDay()];
  const time = ethiopianTimeAt(wall);
  const clock = formatEthiopianClock(time);

  return {
    date,
    ethiopian,
    ethiopianDate: `${month.label} ${ethiopian.day}, ${ethiopian.year}`,
    ethiopianDateAmharic: `${month.amharic} ${ethiopian.day} ቀን ${ethiopian.year}`,
    weekday,
    ethiopianClock: clock,
    periodAmharic: time.period.amharic,
    periodEnglish: time.period.english,
    ethiopianTime: `${time.period.amharic} ${clock}`,
    eatTime: `${pad(wall.getHours())}:${pad(wall.getMinutes())}`,
    gregorianDate: wall.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

// Fixtures grouped under the Addis day they kick off on, in order.
export function groupByEthiopianDay<T>(items: T[], isoOf: (item: T) => string) {
  const days = new Map<string, { kickoff: Kickoff; items: T[] }>();

  for (const item of items) {
    const kickoff = readKickoff(isoOf(item));
    const key = `${kickoff.ethiopian.year}-${kickoff.ethiopian.month}-${kickoff.ethiopian.day}`;
    const day = days.get(key);
    if (day) day.items.push(item);
    else days.set(key, { kickoff, items: [item] });
  }

  return [...days.values()].sort(
    (a, b) => a.kickoff.date.getTime() - b.kickoff.date.getTime()
  );
}

/**
 * A past date, short enough for a form row.
 *
 * The year is only worth the space when the match is from a different Ethiopian
 * year than the fixture being read, which is what separates last season's
 * meetings from this season's.
 */
export function pastDate(iso: string, reference: string) {
  const at = readKickoff(iso);
  const sameYear = at.ethiopian.year === readKickoff(reference).ethiopian.year;
  const month = ETHIOPIAN_MONTHS[at.ethiopian.month - 1];
  const year = sameYear ? "" : ` ${at.ethiopian.year}`;

  return {
    label: `${month.label} ${at.ethiopian.day}${year}`,
    amharic: `${month.amharic} ${at.ethiopian.day}${year}`,
    gregorian: at.gregorianDate,
  };
}
