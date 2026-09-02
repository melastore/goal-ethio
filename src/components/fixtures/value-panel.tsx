"use client";

import { useMemo, useState } from "react";

import { useLanguage } from "@/components/providers/language-provider";
import { odds as asOdds, percent } from "@/lib/format";
import { overround, valueOfBook, type Value } from "@/lib/edge";
import type { MatchView } from "@/lib/view";

// A price, per selection, as typed. Kept as text so a half-typed "2." does not
// jump to 2 under the cursor.
type Prices = Record<string, string>;

type Selection = { key: string; label: string; probability: number };
type Group = { key: string; title: string; picks: Selection[] };

const parse = (raw: string | undefined) => {
  const value = Number.parseFloat((raw ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
};

/**
 * The model on its own is not a betting position. This is the part that makes
 * it one: a price goes in, the book's margin comes out, the model is folded
 * against it by how much evidence stands behind it, and what is left is an edge
 * and a stake.
 */
export function ValuePanel({ match }: { match: MatchView }) {
  const { t, language } = useLanguage();
  const amharic = language === "am";
  const [prices, setPrices] = useState<Prices>({});

  const board = match.p.board;
  const outcome = match.p.outcome;

  const groups: Group[] = useMemo(
    () => [
      {
        key: "1x2",
        title: t("market.matchResult"),
        picks: [
          { key: "1x2.home", label: match.home.short, probability: outcome.home },
          { key: "1x2.draw", label: t("card.draw"), probability: outcome.draw },
          { key: "1x2.away", label: match.away.short, probability: outcome.away },
        ],
      },
      {
        key: "ou",
        title: `${t("market.totals")} 2.5`,
        picks: [
          { key: "ou.over", label: `${t("market.over")} 2.5`, probability: board.totals[2].over },
          { key: "ou.under", label: `${t("market.under")} 2.5`, probability: board.totals[2].under },
        ],
      },
      {
        key: "btts",
        title: t("market.btts"),
        picks: [
          { key: "btts.yes", label: t("market.yes"), probability: board.btts.yes },
          { key: "btts.no", label: t("market.no"), probability: board.btts.no },
        ],
      },
      {
        key: "dc",
        title: t("market.doubleChance"),
        picks: [
          { key: "dc.hd", label: `${match.home.short}/X`, probability: board.doubleChance.homeOrDraw },
          { key: "dc.ha", label: `${match.home.short}/${match.away.short}`, probability: board.doubleChance.homeOrAway },
          { key: "dc.da", label: `X/${match.away.short}`, probability: board.doubleChance.drawOrAway },
        ],
      },
    ],
    [board, match.home.short, match.away.short, outcome, t]
  );

  const priced = useMemo(
    () =>
      groups.map((group) => {
        const entered = group.picks.map((pick) => parse(prices[pick.key]));
        const values = valueOfBook(
          group.picks.map((pick) => pick.probability),
          entered,
          match.p.confidence
        );
        const complete = entered.every((price) => price > 1);
        return {
          group,
          values,
          margin: complete ? overround(entered) : null,
        };
      }),
    [groups, prices, match.p.confidence]
  );

  const anyEntered = Object.values(prices).some((raw) => parse(raw) > 1);

  return (
    <div className="space-y-5">
      <p className={`text-[12px] leading-relaxed text-muted-foreground ${amharic ? "amharic" : ""}`}>
        {t("value.explain")}
      </p>

      {priced.map(({ group, values, margin }) => (
        <section key={group.key}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h4
              className={`text-[11px] font-semibold uppercase tracking-wider text-subtle ${
                amharic ? "amharic normal-case tracking-normal" : ""
              }`}
            >
              {group.title}
            </h4>
            {margin !== null && (
              <span className="font-mono text-[10px] tnum text-subtle">
                {t("value.margin")} {percent(margin, 1)}
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-hairline">
            <div className="grid grid-cols-[1fr_58px_64px_54px] items-center gap-1 border-b border-hairline bg-muted/60 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle">
              <span className={amharic ? "amharic normal-case tracking-normal" : ""}>
                {t("value.pick")}
              </span>
              <span className="text-right">{t("value.model")}</span>
              <span className="text-right">{t("value.yourOdds")}</span>
              <span className="text-right">{t("value.edge")}</span>
            </div>

            {group.picks.map((pick, index) => (
              <Row
                key={pick.key}
                pick={pick}
                value={values[index]}
                price={prices[pick.key] ?? ""}
                onPrice={(raw) => setPrices((current) => ({ ...current, [pick.key]: raw }))}
              />
            ))}
          </div>
        </section>
      ))}

      {anyEntered && (
        <button
          type="button"
          onClick={() => setPrices({})}
          className={`w-full rounded-lg border border-hairline py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted ${
            amharic ? "amharic" : ""
          }`}
        >
          {t("value.clear")}
        </button>
      )}

      <p className={`border-t border-hairline pt-3 text-[11px] leading-relaxed text-subtle ${amharic ? "amharic" : ""}`}>
        {t("value.disclaimer")}
      </p>
    </div>
  );
}

const TONE = {
  value: "text-value",
  fair: "text-muted-foreground",
  poor: "text-live",
} as const;

function Row({
  pick,
  value,
  price,
  onPrice,
}: {
  pick: Selection;
  value: Value | null;
  price: string;
  onPrice: (raw: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-[1fr_58px_64px_54px] items-center gap-1 border-b border-hairline px-2.5 py-1.5 last:border-b-0">
      <span className="truncate text-[12.5px] font-medium">{pick.label}</span>

      <span className="text-right font-mono text-[12px] tnum text-muted-foreground">
        {asOdds(pick.probability)}
      </span>

      <input
        type="text"
        inputMode="decimal"
        value={price}
        onChange={(event) => onPrice(event.target.value)}
        placeholder="-"
        aria-label={`${pick.label} ${t("value.yourOdds")}`}
        className="w-full rounded-md border border-hairline bg-card px-1.5 py-1 text-right font-mono text-[12px] tnum outline-none transition focus:border-primary/50"
      />

      <span
        className={`text-right font-mono text-[12px] font-bold tnum ${
          value ? TONE[value.verdict] : "text-subtle"
        }`}
        title={
          value
            ? `${t("value.stake")} ${(value.stake * 100).toFixed(1)}% · ${t("value.ev")} ${(value.expected * 100).toFixed(1)}%`
            : undefined
        }
      >
        {value ? `${value.edge >= 0 ? "+" : ""}${(value.edge * 100).toFixed(1)}` : "-"}
      </span>
    </div>
  );
}
