"use client";

import { useLanguage } from "@/components/providers/language-provider";
import type { Kickoff } from "@/lib/ethiopian-date";

export type Day = {
  key: string;
  kickoff: Kickoff;
  count: number;
};

type Props = {
  days: Day[];
  active: string | null;
  onSelect: (key: string | null) => void;
  total: number;
};

// Ethiopian days, not Gregorian ones: a Saturday night kick-off in Europe often
// belongs to Sunday here, and this rail is where that becomes visible.
export function DayRail({ days, active, onSelect, total }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={active === null}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 transition ${
            active === null
              ? "border-foreground/20 bg-muted"
              : "border-transparent hover:bg-muted/60"
          }`}
        >
          <span className={`text-[13px] font-medium ${amharic ? "amharic" : ""}`}>
            {t("filter.allDays")}
          </span>
          <span className="font-mono text-[11px] tnum text-subtle">{total}</span>
        </button>

        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            onClick={() => onSelect(day.key === active ? null : day.key)}
            aria-pressed={day.key === active}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 transition ${
              day.key === active
                ? "border-foreground/20 bg-muted"
                : "border-transparent hover:bg-muted/60"
            }`}
          >
            <span className={`text-[13px] font-medium ${amharic ? "amharic" : ""}`}>
              {amharic ? day.kickoff.weekday.amharic : day.kickoff.weekday.label.slice(0, 3)}
            </span>
            <span className="font-mono text-[13px] tnum">{day.kickoff.ethiopian.day}</span>
            <span className="font-mono text-[11px] tnum text-subtle">{day.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
