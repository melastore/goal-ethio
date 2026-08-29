import { percent } from "@/lib/format";
import type { Outcome } from "@/lib/model";

type Props = {
  outcome: Outcome;
  homeLabel: string;
  awayLabel: string;
  drawLabel: string;
};

// The three outcomes as one bar, with the legend under it. A sliver keeps a
// minimum width so a 3% draw is still visible as a colour.
export function OutcomeBar({ outcome, homeLabel, awayLabel, drawLabel }: Props) {
  const segments = [
    { key: "home", value: outcome.home, color: "var(--home)", label: homeLabel },
    { key: "draw", value: outcome.draw, color: "var(--draw)", label: drawLabel },
    { key: "away", value: outcome.away, color: "var(--away)", label: awayLabel },
  ];

  return (
    <div>
      <div className="flex h-2.5 gap-px overflow-hidden rounded-full bg-muted">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="transition-[flex-grow] duration-500"
            style={{
              flexGrow: Math.max(segment.value, 0.012),
              flexBasis: 0,
              background: segment.color,
            }}
          />
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        {segments.map((segment) => (
          <div key={segment.key} className="flex min-w-0 items-center gap-1.5">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: segment.color }}
              aria-hidden
            />
            <span className="truncate text-xs text-muted-foreground">{segment.label}</span>
            <span className="font-mono text-xs font-bold tnum">
              {percent(segment.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
