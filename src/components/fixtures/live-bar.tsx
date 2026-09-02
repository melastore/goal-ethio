"use client";

import { RotateCw } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import type { LiveScore } from "@/lib/live";
import type { MatchView } from "@/lib/view";

type Props = {
  matches: MatchView[];
  scores: Map<number, LiveScore>;
  checkedAt: Date | null;
  loading: boolean;
  direct: boolean;
  onRefresh: () => void;
  onOpen: (id: number) => void;
};

// Sticks under the header while anything is on. Scores only: the detail is one
// tap away and a bar that tries to say more stops being scannable.
export function LiveBar({
  matches,
  scores,
  checkedAt,
  loading,
  direct,
  onRefresh,
  onOpen,
}: Props) {
  const { t, language } = useLanguage();
  const amharic = language === "am";

  if (matches.length === 0) return null;

  return (
    <div className="sticky top-[49px] z-20 -mx-4 mb-4 border-b border-hairline bg-background/95 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
      <div className="flex items-center gap-2 px-4 pt-2 sm:px-3">
        <span className="size-2 rounded-full bg-live live-dot" />
        <span
          className={`text-[11px] font-bold uppercase tracking-wider text-live ${
            amharic ? "amharic normal-case tracking-normal" : ""
          }`}
        >
          {t("results.liveMatches")}
        </span>
        <span className="font-mono text-[11px] tnum text-subtle">{matches.length}</span>

        <span className="ml-auto flex items-center gap-2">
          {checkedAt && (
            <span
              className="font-mono text-[10px] tnum text-subtle"
              title={direct ? t("live.direct") : t("live.delayed")}
            >
              {checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {!direct && " ~"}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={t("market.refresh")}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <RotateCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </span>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2 sm:px-3">
        {matches.map((match) => {
          const score = scores.get(match.id);
          const goalsHome = score?.goalsHome ?? match.result?.goalsHome ?? 0;
          const goalsAway = score?.goalsAway ?? match.result?.goalsAway ?? 0;
          const minute = score?.minute ?? match.result?.minute ?? null;
          const period = score?.period ?? match.result?.period ?? "LIVE";

          return (
            <button
              key={match.id}
              type="button"
              onClick={() => onOpen(match.id)}
              className="flex shrink-0 items-center gap-2.5 rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-left transition hover:border-live/40 hover:bg-muted"
            >
              <span className="flex flex-col gap-0.5 text-[11px] font-semibold leading-tight">
                <span className="max-w-[92px] truncate">{match.home.short}</span>
                <span className="max-w-[92px] truncate">{match.away.short}</span>
              </span>
              <span className="flex flex-col gap-0.5 font-mono text-[13px] font-bold leading-tight tnum">
                <span>{goalsHome}</span>
                <span>{goalsAway}</span>
              </span>
              <span className="ml-1 shrink-0 font-mono text-[10px] font-bold tnum text-live">
                {period === "HT" ? "HT" : minute !== null ? `${minute}'` : "LIVE"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
