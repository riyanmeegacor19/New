// Design tokens for this app. Dark-first tactical palette (RIYANMEE PROXY).
//
// The keys match the "color" block of /app/design_guidelines.json. The app is
// dark-only, so both schemes carry the same obsidian + neon green palette.
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//   }));
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.

import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const palette = {
  // Surfaces
  surface: "#0A0F0D",
  onSurface: "#E2ECE6",
  surfaceSecondary: "#121A16",
  onSurfaceSecondary: "#C5D8CC",
  surfaceTertiary: "#1B2721",
  onSurfaceTertiary: "#8AA695",
  surfaceInverse: "#E2ECE6",
  onSurfaceInverse: "#0A0F0D",
  muted: "#7A9988",

  // Brand
  brand: "#00FF66",
  onBrand: "#0A0F0D",
  brandPrimary: "#00FF66",
  onBrandPrimary: "#0A0F0D",
  brandSecondary: "#00CC52",
  onBrandSecondary: "#0A0F0D",
  brandTertiary: "rgba(0, 255, 102, 0.12)",
  onBrandTertiary: "#00FF66",

  // Status
  success: "#00FF66",
  onSuccess: "#0A0F0D",
  warning: "#FFB800",
  onWarning: "#0A0F0D",
  error: "#FF3344",
  onError: "#0A0F0D",
  info: "#00E5FF",
  onInfo: "#0A0F0D",

  // Lines
  border: "rgba(0, 255, 102, 0.2)",
  borderStrong: "#00FF66",
  divider: "rgba(255, 255, 255, 0.08)",
};

const light = palette;
const dark = palette;

export type ThemeColors = typeof palette;

export const defaultScheme: ColorScheme = "dark";

export const themes: { light: ThemeColors; dark: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

// ---- Layout tokens (from design_guidelines.json) --------------------------
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const font = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string;
