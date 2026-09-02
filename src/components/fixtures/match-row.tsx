"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { readKickoff } from "@/lib/ethiopian-date";
import { percent } from "@/lib/format";
import { leagueById } from "@/lib/leagues";
import type { MatchView } from "@/lib/view";
import { leanOf } from "@/lib/view";

const CONFIDENCE = {
  solid: { key: "confidence.solid" as const, dot: "var(--home)" },
  fair: { key: "confidence.fair" as const, dot: "var(--draw)" },
  thin: { key: "confidence.thin" as const, dot: "var(--subtle)" },
};

type Props = {
  match: MatchView;
  active: boolean;
  onOpen: (id: number) => void;
};

// One fixture as a row. The whole list has to be scannable in a column, so the
// outcome lives in the strip along the bottom rather than in three more numbers.
export function MatchRow({ match, active, onOpen }: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  const kickoff = readKickoff(match.kickoff);
  const league = leagueById(match.leagueId);
  const pick = leanOf(match);
  const confidence = CONFIDENCE[match.p.confidence];
  const top = match.standouts[0];

  const live = match.isLive && match.result;

  return (
    <button
      type="button"
      onClick={() => onOpen(match.id)}
      aria-current={active}
      className={`group relative block w-full overflow-hidden border-b border-hairline text-left transition ${
        active ? "bg-muted/70" : "hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <div className="w-[52px] shrink-0 text-center leading-none">
          {live ? (
            <>
              <div className="font-mono text-[17px] font-bold tnum">
                {match.result!.goalsHome}-{match.result!.goalsAway}
              </div>
              <div className="mt-1 font-mono text-[10px] font-bold tnum text-live">
                {match.result!.period === "HT"
                  ? "HT"
                  : match.result!.minute !== null && match.result!.minute !== undefined
                    ? `${match.result!.minute}'`
                    : "LIVE"}
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-[15px] font-bold tnum">{kickoff.ethiopianClock}</div>
              <div className="amharic mt-0.5 text-[9px] text-subtle">{kickoff.periodAmharic}</div>
              <div className="mt-0.5 font-mono text-[10px] tnum text-subtle">{kickoff.eatTime}</div>
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <Side team={match.home} chance={match.p.outcome.home} winning={pick === "home"} />
          <Side team={match.away} chance={match.p.outcome.away} winning={pick === "away"} />
        </div>

        <div className="hidden w-[128px] shrink-0 text-right sm:block">
          <div
            className={`truncate text-[10px] uppercase tracking-wider text-subtle ${
              amharic ? "amharic normal-case tracking-normal" : ""
            }`}
          >
            {amharic ? league?.amharic : league?.short}
          </div>
          {top ? (
            <div className="mt-1 truncate font-mono text-[11px] font-semibold tnum text-value">
              +{Math.round(top.edge * 100)} {t("standout.short")}
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: confidence.dot }} />
              <span className={`text-[10px] text-subtle ${amharic ? "amharic" : ""}`}>
                {t(confidence.key)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex h-[3px] gap-px" aria-hidden>
        <span style={{ flexGrow: Math.max(match.p.outcome.home, 0.02), background: "var(--home)" }} />
        <span style={{ flexGrow: Math.max(match.p.outcome.draw, 0.02), background: "var(--draw)" }} />
        <span style={{ flexGrow: Math.max(match.p.outcome.away, 0.02), background: "var(--away)" }} />
      </div>
    </button>
  );
}

function Side({
  team,
  chance,
  winning,
}: {
  team: { name: string; short: string; logo: string };
  chance: number;
  winning: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Remote crests, and the export is unoptimised, so a plain img is right. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={team.logo} alt="" width={18} height={18} className="size-[18px] shrink-0 object-contain" />
      <span className={`min-w-0 flex-1 truncate text-[13.5px] ${winning ? "font-bold" : "font-medium"}`}>
        {team.name}
      </span>
      <span
        className={`shrink-0 font-mono text-xs tnum ${
          winning ? "font-bold text-foreground" : "text-muted-foreground"
        }`}
      >
        {percent(chance)}
      </span>
    </div>
  );
}
