"use client";

import { percent } from "@/lib/format";

// A labelled bar used all through the market board. Two values that sum to one,
// drawn as one track so the comparison is the shape, not two numbers to read.
export function SplitBar({
  leftLabel,
  rightLabel,
  left,
  leftColor = "var(--home)",
  rightColor = "var(--away)",
}: {
  leftLabel: string;
  rightLabel: string;
  left: number;
  leftColor?: string;
  rightColor?: string;
}) {
  return (
    <div className="group">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{leftLabel}</span>
        <span className="truncate text-muted-foreground">{rightLabel}</span>
      </div>
      <div className="flex h-7 gap-px overflow-hidden rounded-lg bg-muted">
        <div
          className="flex items-center justify-start px-2 transition-[flex-grow] duration-500"
          style={{ flexGrow: Math.max(left, 0.06), flexBasis: 0, background: leftColor }}
        >
          <span className="font-mono text-[11px] font-bold tnum text-white">
            {percent(left)}
          </span>
        </div>
        <div
          className="flex items-center justify-end px-2 transition-[flex-grow] duration-500"
          style={{
            flexGrow: Math.max(1 - left, 0.06),
            flexBasis: 0,
            background: rightColor,
          }}
        >
          <span className="font-mono text-[11px] font-bold tnum text-white">
            {percent(1 - left)}
          </span>
        </div>
      </div>
    </div>
  );
}

// A single probability as a thin meter, for lists of many lines.
export function Meter({
  label,
  value,
  color = "var(--home)",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[86px] shrink-0 truncate text-xs text-muted-foreground">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${value * 100}%`, background: color }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs font-semibold tnum">
        {percent(value)}
      </span>
    </div>
  );
}
