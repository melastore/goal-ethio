import assert from "node:assert/strict";
import test from "node:test";

import { readKickoff } from "@/lib/ethiopian-date";

test("a Saturday tea-time kickoff reads as an Addis evening", () => {
  // 14:00 UTC is 17:00 in Addis, which is eleven o'clock in the afternoon.
  const kickoff = readKickoff("2026-08-29T14:00:00Z");
  assert.equal(kickoff.eatTime, "17:00");
  assert.equal(kickoff.ethiopianClock, "11:00");
  assert.equal(kickoff.periodAmharic, "ከቀኑ");
  assert.equal(kickoff.weekday.label, "Saturday");
});

test("a late European kickoff lands in the Ethiopian evening", () => {
  // 20:00 UTC is 23:00 in Addis: five in the evening, ከምሽቱ running to midnight.
  const kickoff = readKickoff("2026-08-29T20:00:00Z");
  assert.equal(kickoff.eatTime, "23:00");
  assert.equal(kickoff.ethiopianClock, "5:00");
  assert.equal(kickoff.periodAmharic, "ከምሽቱ");
});

test("past midnight in Addis is spoken as night", () => {
  // 21:30 UTC is 00:30, which is ከሌሊቱ.
  assert.equal(readKickoff("2026-08-29T21:30:00Z").periodAmharic, "ከሌሊቱ");
});

test("kickoffs after 21:00 UTC belong to the next Ethiopian day", () => {
  const kickoff = readKickoff("2026-08-29T21:30:00Z");
  assert.equal(kickoff.weekday.label, "Sunday");
  assert.equal(kickoff.eatTime, "00:30");
});

test("the Gregorian date converts to an Ethiopian one", () => {
  const kickoff = readKickoff("2026-08-29T14:00:00Z");
  // Late August is Nehase, the twelfth month.
  assert.equal(kickoff.ethiopian.month, 12);
  assert.ok(kickoff.ethiopianDate.startsWith("Nehase"));
  assert.ok(kickoff.ethiopianDateAmharic.includes("ነሐሴ"));
});

test("dawn itself is said as twelve", () => {
  // 03:00 UTC is 06:00 in Addis.
  assert.equal(readKickoff("2026-08-29T03:00:00Z").ethiopianClock, "12:00");
});
