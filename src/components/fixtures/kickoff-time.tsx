import type { Kickoff } from "@/lib/ethiopian-date";

// Ethiopian clock first, since that is the one people read the time in here.
// The 24-hour EAT reading sits under it for checking against a TV listing.
export function KickoffTime({ kickoff }: { kickoff: Kickoff }) {
  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-lg font-semibold tabular-nums">
        {kickoff.ethiopianClock}
      </div>
      <div className="amharic text-[11px] text-muted-foreground">
        {kickoff.periodAmharic}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
        {kickoff.eatTime}
      </div>
    </div>
  );
}
