import { Platform, useColorScheme } from "react-native";
import type { Hue } from "../core/categories";

// Same colors as the web app and Pocket for Mac: warm off-white / near-black, pocket green.
const light = {
  bg: "#f6f5f2",
  surface: "#ffffff",
  ink: "#1b1b1a",
  muted: "#6d6b66",
  faint: "#a5a29b",
  line: "#e4e2dc",
  neg: "#c2352b",
  pos: "#1f7a50",
  accent: "#1d6b47",
  accentInk: "#ffffff",
  chip: "#ecebe6",
  scrim: "rgba(0,0,0,0.35)",
  warn: "#b85f0c",
  hues: {
    purple: "#8e3fb8", blue: "#1f6fd1", orange: "#b85f0c", indigo: "#4d4bc4",
    brown: "#86663f", pink: "#c22f4e", teal: "#127c8f", green: "#1f7a50", gray: "#6d6b66",
  } as Record<Hue, string>,
};

const dark: typeof light = {
  bg: "#121212",
  surface: "#1c1c1c",
  ink: "#f1f0ec",
  muted: "#a09e98",
  faint: "#6b6a66",
  line: "#2c2c2b",
  neg: "#ff6b5e",
  pos: "#4cc98f",
  accent: "#4cc98f",
  accentInk: "#0d2a1c",
  chip: "#262626",
  scrim: "rgba(0,0,0,0.55)",
  warn: "#ffad5c",
  hues: {
    purple: "#c98bff", blue: "#6aa8ff", orange: "#ffad5c", indigo: "#9997ff",
    brown: "#cfae86", pink: "#ff7d98", teal: "#5fd3e6", green: "#4cc98f", gray: "#a09e98",
  },
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === "dark";
}

/** The rounded system face the Mac app uses for money and headings. */
export const DISPLAY = Platform.select({ ios: "ui-rounded", default: undefined });

/** Tinted tile behind a category glyph. */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const radius = { card: 18, row: 12, chip: 999, tile: 10 };
export const GUTTER = 16;
