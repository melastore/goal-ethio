import type { FormSummary } from "@/lib/model";

const TONE = {
  W: "bg-home text-white",
  D: "bg-muted text-muted-foreground",
  L: "bg-away text-white",
} as const;

type Props = {
  label: string;
  summary: FormSummary;
  /** The venue rows are the ones the projection leans on, so they read heavier. */
  emphasis?: boolean;
};

export function FormStrip({ label, summary, emphasis = false }: Props) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span
        className={`w-[70px] shrink-0 truncate ${
          emphasis ? "font-medium text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>

      <div className="flex flex-1 gap-1">
        {summary.sequence.length === 0 ? (
          <span className="text-subtle">-</span>
        ) : (
          summary.sequence.map((outcome, index) => (
            <span
              key={index}
              className={`grid size-[18px] place-items-center rounded-[5px] text-[10px] font-bold ${TONE[outcome]}`}
              title={outcome}
            >
              {outcome}
            </span>
          ))
        )}
      </div>

      <span className="shrink-0 font-mono text-[11px] tnum text-muted-foreground">
        {summary.goalsFor}:{summary.goalsAgainst}
      </span>
    </div>
  );
}
