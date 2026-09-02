"use client";

import { Meter, SplitBar } from "@/components/fixtures/probability-row";
import { useLanguage } from "@/components/providers/language-provider";
import { odds, percent } from "@/lib/format";
import type { MatchView } from "@/lib/view";

// Everything the goal data supports, grouped the way a coupon groups it.
export function GoalsBoard({ match }: { match: MatchView }) {
  const { t } = useLanguage();
  const board = match.p.board;
  const outcome = match.p.outcome;

  return (
    <div className="space-y-5">
      <Group title={t("market.matchResult")}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label={match.home.short} value={outcome.home} oddsValue={outcome.home} tone="home" />
          <Tile label={t("card.draw")} value={outcome.draw} oddsValue={outcome.draw} tone="draw" />
          <Tile label={match.away.short} value={outcome.away} oddsValue={outcome.away} tone="away" />
        </div>
      </Group>

      <Group title={t("market.btts")}>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={t("market.yes")} value={board.btts.yes} oddsValue={board.btts.yes} tone="home" />
          <Tile label={t("market.no")} value={board.btts.no} oddsValue={board.btts.no} tone="away" />
        </div>
      </Group>

      <Group title={t("market.dnb")}>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={match.home.short} value={board.drawNoBet.home} oddsValue={board.drawNoBet.home} tone="home" />
          <Tile label={match.away.short} value={board.drawNoBet.away} oddsValue={board.drawNoBet.away} tone="away" />
        </div>
      </Group>

      <Group title={t("market.totals")}>
        <div className="space-y-3">
          {board.totals.map((line) => (
            <div key={line.line} className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>{t("market.over")} {line.line} (@{odds(line.over)})</span>
                <span>{t("market.under")} {line.line} (@{odds(line.under)})</span>
              </div>
              <Meter
                label={`${t("market.over")} ${line.line}`}
                value={line.over}
                color="var(--draw)"
              />
            </div>
          ))}
        </div>
      </Group>

      <Group title={t("market.teamGoals")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{match.home.short}</Label>
            {board.homeGoals.map((line) => (
              <Meter
                key={line.line}
                label={`${t("market.over")} ${line.line}`}
                value={line.over}
                color="var(--home)"
              />
            ))}
          </div>
          <div className="space-y-2">
            <Label>{match.away.short}</Label>
            {board.awayGoals.map((line) => (
              <Meter
                key={line.line}
                label={`${t("market.over")} ${line.line}`}
                value={line.over}
                color="var(--away)"
              />
            ))}
          </div>
        </div>
      </Group>

      <Group title={t("market.doubleChance")}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label={`${match.home.short} / X`} value={board.doubleChance.homeOrDraw} oddsValue={board.doubleChance.homeOrDraw} />
          <Tile label={`${match.home.short} / ${match.away.short}`} value={board.doubleChance.homeOrAway} oddsValue={board.doubleChance.homeOrAway} />
          <Tile label={`X / ${match.away.short}`} value={board.doubleChance.drawOrAway} oddsValue={board.doubleChance.drawOrAway} />
        </div>
      </Group>

      <Group title={t("market.handicap")}>
        <div className="space-y-2">
          {board.handicaps.map((h) => (
            <div key={h.goals} className="grid grid-cols-2 gap-2">
              <Tile label={`${match.home.short} -${h.goals}`} value={h.homeGives} oddsValue={h.homeGives} />
              <Tile label={`${match.away.short} -${h.goals}`} value={h.awayGives} oddsValue={h.awayGives} />
            </div>
          ))}
        </div>
      </Group>

      <Group title={t("market.exactScores")}>
        <div className="grid grid-cols-3 gap-2">
          {board.exactScores.map((s) => (
            <Tile key={s.score} label={s.score} value={s.probability} oddsValue={s.probability} />
          ))}
        </div>
      </Group>

      <Group title={t("market.cleanSheet")}>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={match.home.short} value={board.cleanSheets.home} oddsValue={board.cleanSheets.home} />
          <Tile label={match.away.short} value={board.cleanSheets.away} oddsValue={board.cleanSheets.away} />
          <Tile
            label={`${match.home.short} · ${t("market.winToNil")}`}
            value={board.cleanSheets.homeWinToNil}
            oddsValue={board.cleanSheets.homeWinToNil}
          />
          <Tile
            label={`${match.away.short} · ${t("market.winToNil")}`}
            value={board.cleanSheets.awayWinToNil}
            oddsValue={board.cleanSheets.awayWinToNil}
          />
        </div>
      </Group>

      <Group title={t("market.oddEven")}>
        <SplitBar
          leftLabel={t("market.odd")}
          rightLabel={t("market.even")}
          left={board.oddEven.odd}
          leftColor="var(--draw)"
          rightColor="var(--away)"
        />
      </Group>

      <p className="border-t border-hairline pt-3 text-[11px] leading-relaxed text-subtle">
        {t("market.noCards")}
      </p>
    </div>
  );
}

export function HalvesBoard({ match }: { match: MatchView }) {
  const { t } = useLanguage();
  const half = match.p.board.halfTime;
  const highest = match.p.board.highestScoringHalf;

  return (
    <div className="space-y-5">
      <Group title={t("market.htResult")}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label={match.home.short} value={half.result.home} oddsValue={half.result.home} tone="home" />
          <Tile label="X" value={half.result.draw} oddsValue={half.result.draw} tone="draw" />
          <Tile label={match.away.short} value={half.result.away} oddsValue={half.result.away} tone="away" />
        </div>
      </Group>

      <Group title={t("market.highestHalf")}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label={t("market.firstHalf")} value={highest.first} oddsValue={highest.first} />
          <Tile label={t("market.equal")} value={highest.draw} oddsValue={highest.draw} />
          <Tile label={t("market.secondHalf")} value={highest.second} oddsValue={highest.second} />
        </div>
      </Group>

      <Group title={t("market.htGoals")}>
        <div className="space-y-2">
          {half.totals.map((line) => (
            <Meter
              key={line.line}
              label={`${t("market.over")} ${line.line}`}
              value={line.over}
              color="var(--draw)"
            />
          ))}
        </div>
      </Group>

      <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
        <span className="text-xs text-muted-foreground">{t("market.htShare")}</span>
        <span className="font-mono text-xs font-semibold tnum">{percent(half.share)}</span>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold">{children}</div>;
}

function Tile({
  label,
  value,
  oddsValue,
  tone,
}: {
  label: string;
  value: number;
  oddsValue?: number;
  tone?: "home" | "draw" | "away";
}) {
  const color =
    tone === "home" ? "var(--home)" : tone === "away" ? "var(--away)" : tone === "draw" ? "var(--draw)" : undefined;

  return (
    <div className="rounded-xl bg-muted px-3 py-2.5 transition hover:bg-muted/70">
      <div className="truncate text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-1">
        <span
          className="font-mono text-lg font-bold tnum leading-none"
          style={color ? { color } : undefined}
        >
          {percent(value)}
        </span>
        {oddsValue !== undefined && (
          <span className="font-mono text-[11px] font-semibold text-muted-foreground tnum">
            @{odds(oddsValue)}
          </span>
        )}
      </div>
    </div>
  );
}
