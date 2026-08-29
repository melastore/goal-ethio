// Number formatting the pages share, so a percentage reads the same everywhere.

export const percent = (value: number, digits = 0) =>
  `${(value * 100).toFixed(digits)}%`;

export const odds = (probability: number) =>
  probability > 0.005 ? (1 / probability).toFixed(2) : "-";

export const goals = (value: number) => value.toFixed(2);

export const minute = (value: number) => `${Math.round(value)}'`;

export const rate = (hits: number, of: number) =>
  of === 0 ? "-" : `${Math.round((hits / of) * 100)}%`;
