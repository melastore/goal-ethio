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
  const home = match.home.short;
  const away = match.away.short;

  const combo = (key: string) =>
    board.resultAndBtts.find((entry) => entry.key === key)?.probability ?? 0;
  const total = (key: string) =>
    board.resultAndTotal.find((entry) => entry.key === key)?.probability ?? 0;

  return (
    <div className="space-y-5">
      <Group title={t("market.matchResult")}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label={home} value={outcome.home} tone="home" />
          <Tile label={t("card.draw")} value={outcome.draw} tone="draw" />
          <Tile label={away} value={outcome.away} tone="away" />
        </div>
      </Group>

      <Group title={t("market.btts")}>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={t("market.yes")} value={board.btts.yes} tone="home" />
          <Tile label={t("market.no")} value={board.btts.no} tone="away" />
        </div>
      </Group>

      <Group title={t("market.dnb")}>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={home} value={board.drawNoBet.home} tone="home" />
          <Tile label={away} value={board.drawNoBet.away} tone="away" />
        </div>
      </Group>

      <Group title={t("market.totals")}>
        <div className="space-y-3">
          {board.totals.map((line) => (
            <div key={line.line} className="space-y-1">
              <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>
                  {t("market.over")} {line.line} @{odds(line.over)}
                </span>
                <span>
                  {t("market.under")} {line.line} @{odds(line.under)}
                </span>
              </div>
              <Meter label={`${t("market.over")} ${line.line}`} value={line.over} color="var(--draw)" />
            </div>
          ))}
        </div>
      </Group>

      <Group title={t("market.asian")} note={t("market.asianNote")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-right font-mono text-[11px] tnum">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-subtle">
                <th className="py-1 text-left font-semibold">{t("market.line")}</th>
                <th className="py-1 font-semibold">{home}</th>
                <th className="py-1 font-semibold">@</th>
                <th className="py-1 font-semibold">{away}</th>
                <th className="py-1 font-semibold">@</th>
              </tr>
            </thead>
            <tbody>
              {board.asian.map((row) => (
                <tr key={row.line} className="border-t border-hairline">
                  <td className="py-1 text-left font-semibold">
                    {row.line > 0 ? `+${row.line}` : row.line}
                  </td>
                  <td className="py-1">{percent(row.home.price)}</td>
                  <td className="py-1 text-muted-foreground">{odds(row.home.price)}</td>
                  <td className="py-1">{percent(row.away.price)}</td>
                  <td className="py-1 text-muted-foreground">{odds(row.away.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Group>

      <Group title={t("market.teamGoals")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{home}</Label>
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
            <Label>{away}</Label>
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
          <Tile label={`${home} / X`} value={board.doubleChance.homeOrDraw} />
          <Tile label={`${home} / ${away}`} value={board.doubleChance.homeOrAway} />
          <Tile label={`X / ${away}`} value={board.doubleChance.drawOrAway} />
        </div>
      </Group>

      <Group title={t("market.resultBtts")}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label={`${home} & ${t("market.yes")}`} value={combo("homeYes")} tone="home" />
          <Tile label={`X & ${t("market.yes")}`} value={combo("drawYes")} tone="draw" />
          <Tile label={`${away} & ${t("market.yes")}`} value={combo("awayYes")} tone="away" />
          <Tile label={`${home} & ${t("market.no")}`} value={combo("homeNo")} />
          <Tile label={`X & ${t("market.no")}`} value={combo("drawNo")} />
          <Tile label={`${away} & ${t("market.no")}`} value={combo("awayNo")} />
        </div>
      </Group>

      <Group title={t("market.resultTotal")}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label={`${home} & ${t("market.over")}`} value={total("homeOver")} tone="home" />
          <Tile label={`X & ${t("market.over")}`} value={total("drawOver")} tone="draw" />
          <Tile label={`${away} & ${t("market.over")}`} value={total("awayOver")} tone="away" />
          <Tile label={`${home} & ${t("market.under")}`} value={total("homeUnder")} />
          <Tile label={`X & ${t("market.under")}`} value={total("drawUnder")} />
          <Tile label={`${away} & ${t("market.under")}`} value={total("awayUnder")} />
        </div>
      </Group>

      <Group title={t("market.margin")}>
        <div className="space-y-1.5">
          {board.margins.slice(0, 6).map((m) => (
            <Meter
              key={`${m.side}${m.by}`}
              label={
                m.side === "draw"
                  ? t("card.draw")
                  : `${m.side === "home" ? home : away} +${m.by}${m.by === 3 ? "+" : ""}`
              }
              value={m.probability}
              color={
                m.side === "home" ? "var(--home)" : m.side === "away" ? "var(--away)" : "var(--draw)"
              }
            />
          ))}
        </div>
      </Group>

      <Group title={t("market.exactScores")}>
        <div className="grid grid-cols-3 gap-2">
          {board.exactScores.map((s) => (
            <Tile key={s.score} label={s.score} value={s.probability} />
          ))}
        </div>
      </Group>

      <Group title={t("market.cleanSheet")}>
        <div className="grid grid-cols-2 gap-2">
          <Tile label={home} value={board.cleanSheets.home} />
          <Tile label={away} value={board.cleanSheets.away} />
          <Tile label={`${home} · ${t("market.winToNil")}`} value={board.cleanSheets.homeWinToNil} />
          <Tile label={`${away} · ${t("market.winToNil")}`} value={board.cleanSheets.awayWinToNil} />
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
  const board = match.p.board;
  const half = board.halfTime;
  const highest = board.highestScoringHalf;
  const home = match.home.short;
  const away = match.away.short;

  const htft = (key: string) => board.htft.find((entry) => entry.key === key)?.probability ?? 0;
  const label = (side: string) => (side === "home" ? home : side === "away" ? away : "X");

  return (
    <div className="space-y-5">
      <Group title={t("market.htResult")}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label={home} value={half.result.home} tone="home" />
          <Tile label="X" value={half.result.draw} tone="draw" />
          <Tile label={away} value={half.result.away} tone="away" />
        </div>
      </Group>

      <Group title={t("market.htft")} note={t("market.htftNote")}>
        <div className="grid grid-cols-3 gap-2">
          {["home", "draw", "away"].map((first) =>
            ["home", "draw", "away"].map((second) => (
              <Tile
                key={`${first}${second}`}
                label={`${label(first)} / ${label(second)}`}
                value={htft(`${first}${second}`)}
                tone={first === second && first !== "draw" ? (first as "home" | "away") : undefined}
              />
            ))
          )}
        </div>
      </Group>

      <Group title={t("market.highestHalf")}>
        <div className="grid grid-cols-3 gap-2">
          <Tile label={t("market.firstHalf")} value={highest.first} />
          <Tile label={t("market.equal")} value={highest.draw} />
          <Tile label={t("market.secondHalf")} value={highest.second} />
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

      <Group title={t("market.bothHalves")}>
        <div className="space-y-2">
          <Meter label={home} value={board.bothHalves.home} color="var(--home)" />
          <Meter label={away} value={board.bothHalves.away} color="var(--away)" />
          <Meter label={t("market.goalEachHalf")} value={board.goalEachHalf} color="var(--draw)" />
        </div>
      </Group>

      <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
        <span className="text-xs text-muted-foreground">{t("market.htShare")}</span>
        <span className="font-mono text-xs font-semibold tnum">{percent(half.share)}</span>
      </div>
    </div>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-subtle">{title}</h4>
        {note && <span className="text-[10px] text-subtle">{note}</span>}
      </div>
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
  tone,
}: {
  label: string;
  value: number;
  tone?: "home" | "draw" | "away";
}) {
  const color =
    tone === "home"
      ? "var(--home)"
      : tone === "away"
        ? "var(--away)"
        : tone === "draw"
          ? "var(--draw)"
          : undefined;

  return (
    <div className="rounded-xl bg-muted px-2.5 py-2 transition hover:bg-muted/70">
      <div className="truncate text-[10.5px] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-1">
        <span
          className="font-mono text-[15px] font-bold leading-none tnum"
          style={color ? { color } : undefined}
        >
          {percent(value)}
        </span>
        <span className="font-mono text-[10px] font-semibold tnum text-subtle">@{odds(value)}</span>
      </div>
    </div>
  );
}
