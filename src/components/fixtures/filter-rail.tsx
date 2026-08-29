"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { LEAGUES } from "@/lib/leagues";

type Props = {
  counts: Map<number, number>;
  active: number | null;
  onSelect: (leagueId: number | null) => void;
  total: number;
};

// The league switcher: one row, scrolls sideways on a phone, wraps on a desk.
// Counts are live against the current day filter, so an empty league says so.
export function LeagueRail({ counts, active, onSelect, total }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  const present = LEAGUES.filter((league) => (counts.get(league.id) ?? 0) > 0);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-1.5 lg:w-full lg:flex-wrap">
        <Chip
          label={t("filter.all")}
          count={total}
          active={active === null}
          onClick={() => onSelect(null)}
          amharic={amharic}
        />
        {present.map((league) => (
          <Chip
            key={league.id}
            label={amharic ? league.amharic : league.name}
            code={league.short}
            count={counts.get(league.id) ?? 0}
            active={active === league.id}
            onClick={() => onSelect(league.id)}
            amharic={amharic}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  code,
  count,
  active,
  onClick,
  amharic,
}: {
  label: string;
  code?: string;
  count: number;
  active: boolean;
  onClick: () => void;
  amharic: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] transition-all duration-200 ${
        active
          ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {code && (
        <span
          className={`font-mono text-[10px] font-bold tracking-wider ${
            active ? "text-primary-foreground/70" : "text-subtle"
          }`}
        >
          {code}
        </span>
      )}
      <span className={`font-medium ${amharic ? "amharic" : ""}`}>{label}</span>
      <span
        className={`font-mono text-[11px] tnum ${
          active ? "text-primary-foreground/70" : "text-subtle"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
