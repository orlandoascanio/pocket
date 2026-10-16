import type { Cents } from "./money";

export type Hue = "purple" | "blue" | "orange" | "indigo" | "brown" | "pink" | "teal" | "green" | "gray";

export interface Category {
  id: string;
  name: string;
  /** SF Symbol name (the same glyphs Pocket for Mac uses). */
  symbol: string;
  hue: Hue;
}

export const CATEGORY_START = "start";

export const SPENDING: Category[] = [
  { id: "games", name: "Games", symbol: "gamecontroller", hue: "purple" },
  { id: "subscriptions", name: "Subscriptions", symbol: "repeat", hue: "blue" },
  { id: "bills", name: "Bills", symbol: "bolt", hue: "orange" },
  { id: "apps", name: "Apps", symbol: "square.grid.2x2", hue: "indigo" },
  { id: "food", name: "Food", symbol: "cup.and.saucer", hue: "brown" },
  { id: "shopping", name: "Shopping", symbol: "bag", hue: "pink" },
  { id: "fun", name: "Fun", symbol: "sparkles", hue: "orange" },
  { id: "transport", name: "Transport", symbol: "bus", hue: "teal" },
  { id: "other", name: "Other", symbol: "ellipsis.circle", hue: "gray" },
];

export const INCOME: Category[] = [
  { id: "pay", name: "Pay", symbol: "banknote", hue: "green" },
  { id: "gift", name: "Gift", symbol: "gift", hue: "green" },
  { id: "refund", name: "Refund", symbol: "arrow.uturn.backward", hue: "green" },
  { id: "otherin", name: "Other", symbol: "arrow.down.left", hue: "green" },
];

const ALL: Category[] = [...SPENDING, ...INCOME, { id: CATEGORY_START, name: "Starting balance", symbol: "banknote", hue: "green" }];

export const findCategory = (id?: string) => ALL.find((c) => c.id === id);

/** The category an entry is counted under: uncategorized money goes to Other (in or out). */
export const categoryKey = (id: string | undefined, cents: Cents) => id ?? (cents > 0 ? "otherin" : "other");

export const categoryName = (id?: string) => findCategory(id)?.name ?? "Uncategorized";

export const categorySymbol = (id: string | undefined, cents: Cents) =>
  findCategory(id)?.symbol ?? (cents > 0 ? "arrow.down.left" : "arrow.up.right");

export const categoryHue = (id: string | undefined, cents: Cents): Hue => findCategory(id)?.hue ?? (cents > 0 ? "green" : "gray");
