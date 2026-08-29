import type { FormSummary } from "@/lib/model";

const TONE = {
  W: "bg-[var(--home)] text-white",
  D: "bg-muted text-muted-foreground",
  L: "bg-[var(--away)] text-white",
} as const;

type Props = {
  label: string;
  summary: FormSummary;
};

export function FormStrip({ label, summary }: Props) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 truncate text-muted-foreground">{label}</span>
      <div className="flex flex-1 gap-1">
        {summary.sequence.length === 0 ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          summary.sequence.map((outcome, index) => (
            <span
              key={index}
              className={`grid size-4.5 place-items-center rounded text-[10px] font-bold ${TONE[outcome]}`}
            >
              {outcome}
            </span>
          ))
        )}
      </div>
      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
        {summary.goalsFor}:{summary.goalsAgainst}
      </span>
    </div>
  );
}
