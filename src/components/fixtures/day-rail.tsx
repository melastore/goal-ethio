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
          className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${
            active === null
              ? "border-foreground/20 bg-muted"
              : "border-transparent hover:bg-muted/60"
          }`}
        >
          <div className={`text-xs font-semibold ${amharic ? "amharic" : ""}`}>
            {t("filter.allDays")}
          </div>
          <div className="font-mono text-[11px] tnum text-subtle">{total}</div>
        </button>

        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            onClick={() => onSelect(day.key === active ? null : day.key)}
            aria-pressed={day.key === active}
            className={`w-[74px] shrink-0 rounded-xl border px-2.5 py-2 text-left transition ${
              day.key === active
                ? "border-foreground/20 bg-muted"
                : "border-transparent hover:bg-muted/60"
            }`}
          >
            <div className={`truncate text-xs font-semibold ${amharic ? "amharic" : ""}`}>
              {amharic ? day.kickoff.weekday.amharic : day.kickoff.weekday.label.slice(0, 3)}
            </div>
            <div className="truncate font-mono text-[11px] tnum text-muted-foreground">
              {day.kickoff.ethiopian.day}/{day.kickoff.ethiopian.month}
            </div>
            <div className="font-mono text-[11px] tnum text-subtle">{day.count}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
