// The Ethiopian day starts at dawn, so 6am is twelve o'clock, and an hour is
// only half a time without the period word that goes with it.

// Dawn, in hours after local midnight.
export const DAWN_HOUR = 6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

export type PeriodId = "morning" | "afternoon" | "evening" | "night";

export type DayPeriod = {
  id: PeriodId;
  amharic: string;
  english: string;
};

// Four quarters of six hours each, in the order they arrive after dawn. That is
// why the hour never has to run past twelve.
export const DAY_PERIODS: Record<PeriodId, DayPeriod> = {
  morning: { id: "morning", amharic: "ከጠዋቱ", english: "morning" },
  afternoon: { id: "afternoon", amharic: "ከቀኑ", english: "afternoon" },
  evening: { id: "evening", amharic: "ከምሽቱ", english: "evening" },
  night: { id: "night", amharic: "ከሌሊቱ", english: "night" },
};

const PERIOD_ORDER: PeriodId[] = ["morning", "afternoon", "evening", "night"];

export type EthiopianTime = {
  // 1-12, the way it is said aloud.
  hour: number;
  minute: number;
  period: DayPeriod;
  isDaylight: boolean;
};

const msSinceMidnight = (date: Date) =>
  ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000;

export function ethiopianTimeAt(date: Date): EthiopianTime {
  // Wind back to dawn, then wrap: pre-sunrise hours belong to the night before
  // and have to land at the end of the cycle, not below zero.
  const sinceDawn =
    (msSinceMidnight(date) - DAWN_HOUR * MS_PER_HOUR + MS_PER_DAY) % MS_PER_DAY;

  const totalSeconds = Math.floor(sinceDawn / 1000);
  const hoursSinceDawn = Math.floor(totalSeconds / 3600);

  return {
    // Twelve, not zero: the hour dawn arrives is said as twelve o'clock.
    hour: hoursSinceDawn % 12 === 0 ? 12 : hoursSinceDawn % 12,
    minute: Math.floor(totalSeconds / 60) % 60,
    period: DAY_PERIODS[PERIOD_ORDER[Math.floor(hoursSinceDawn / 6)]],
    isDaylight: sinceDawn < MS_PER_DAY / 2,
  };
}

export const formatEthiopianClock = (time: EthiopianTime) =>
  `${time.hour}:${String(time.minute).padStart(2, "0")}`;
