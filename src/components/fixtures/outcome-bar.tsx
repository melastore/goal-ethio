import { percent } from "@/lib/format";
import type { Outcome } from "@/lib/model";

type Props = {
  outcome: Outcome;
  homeLabel: string;
  awayLabel: string;
  drawLabel: string;
};

export function OutcomeBar({ outcome, homeLabel, awayLabel, drawLabel }: Props) {
  const segments = [
    { key: "home", value: outcome.home, color: "var(--home)", label: homeLabel },
    { key: "draw", value: outcome.draw, color: "var(--draw)", label: drawLabel },
    { key: "away", value: outcome.away, color: "var(--away)", label: awayLabel },
  ];

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {segments.map((segment) => (
          <div
            key={segment.key}
            style={{ width: `${segment.value * 100}%`, background: segment.color }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-xs">
        {segments.map((segment) => (
          <div key={segment.key} className="flex min-w-0 items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: segment.color }}
              aria-hidden
            />
            <span className="truncate text-muted-foreground">{segment.label}</span>
            <span className="font-mono font-semibold tabular-nums">
              {percent(segment.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
