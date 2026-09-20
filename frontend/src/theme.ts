// Design tokens for RIYANMEE PROXY. Dark neon-green primary + a clean light
// theme. Keys match the "color" block of design_guidelines.json. Theme is
// switchable at runtime via Appearance.setColorScheme (see src/settings.tsx).

import { useMemo } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0A0F0D",
  onSurface: "#E2ECE6",
  surfaceSecondary: "#121A16",
  onSurfaceSecondary: "#C5D8CC",
  surfaceTertiary: "#1B2721",
  onSurfaceTertiary: "#8AA695",
  surfaceInverse: "#E2ECE6",
  onSurfaceInverse: "#0A0F0D",
  muted: "#7A9988",

  brand: "#00FF66",
  onBrand: "#0A0F0D",
  brandPrimary: "#00FF66",
  onBrandPrimary: "#0A0F0D",
  brandSecondary: "#00CC52",
  onBrandSecondary: "#0A0F0D",
  brandTertiary: "rgba(0, 255, 102, 0.12)",
  onBrandTertiary: "#00FF66",

  success: "#00FF66",
  onSuccess: "#0A0F0D",
  warning: "#FFB800",
  onWarning: "#0A0F0D",
  error: "#FF3344",
  onError: "#0A0F0D",
  info: "#00E5FF",
  onInfo: "#0A0F0D",

  border: "rgba(0, 255, 102, 0.2)",
  borderStrong: "#00FF66",
  divider: "rgba(255, 255, 255, 0.08)",
};

const light: typeof dark = {
  surface: "#F3F7F4",
  onSurface: "#0A1F14",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#16281F",
  surfaceTertiary: "#E7EFEA",
  onSurfaceTertiary: "#4A6B58",
  surfaceInverse: "#0A0F0D",
  onSurfaceInverse: "#E2ECE6",
  muted: "#5E7A6B",

  brand: "#00A344",
  onBrand: "#FFFFFF",
  brandPrimary: "#00A344",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#00CC52",
  onBrandSecondary: "#062B15",
  brandTertiary: "rgba(0, 163, 68, 0.12)",
  onBrandTertiary: "#007A33",

  success: "#00A344",
  onSuccess: "#FFFFFF",
  warning: "#B26A00",
  onWarning: "#FFFFFF",
  error: "#C42B36",
  onError: "#FFFFFF",
  info: "#0077A3",
  onInfo: "#FFFFFF",

  border: "rgba(0, 163, 68, 0.25)",
  borderStrong: "#00A344",
  divider: "rgba(0, 0, 0, 0.08)",
};

export type ThemeColors = typeof dark;

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

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const font = { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24 };
export const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string;
