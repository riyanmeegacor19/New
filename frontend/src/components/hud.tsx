import Icon from "@react-native-vector-icons/material-design-icons";
import { ReactNode } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { font, glow, radius, spacing, useTheme } from "@/src/theme";

// L-shaped neon corner brackets overlay — the classic gaming/HUD frame.
export function NeonCorners({ color, size = 14 }: { color: string; size?: number }) {
  const b = { position: "absolute" as const, width: size, height: size, borderColor: color };
  return (
    <>
      <View pointerEvents="none" style={[b, { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 }]} />
      <View pointerEvents="none" style={[b, { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 }]} />
      <View pointerEvents="none" style={[b, { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 }]} />
      <View pointerEvents="none" style={[b, { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 }]} />
    </>
  );
}

// Section header with a glowing vertical bar + techy uppercase label.
export function SectionHeader({ title, icon }: { title: string; icon?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <View style={[styles.sectionBar, { backgroundColor: colors.brandPrimary }, glow(colors.brandPrimary, 8)]} />
      {icon ? <Icon name={icon} size={15} color={colors.brandPrimary} /> : null}
      <Text style={[styles.sectionText, { color: colors.onSurfaceSecondary }]}>{title}</Text>
      <View style={[styles.sectionLine, { backgroundColor: colors.divider }]} />
    </View>
  );
}

// Neon card wrapper — glowing border + corner brackets. Pressable when onPress.
export function NeonCard({
  children,
  onPress,
  style,
  testID,
  glowColor,
  active = false,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  glowColor?: string;
  active?: boolean;
}) {
  const { colors } = useTheme();
  const gc = glowColor ?? colors.brandPrimary;
  const base: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: colors.surfaceSecondary,
      borderColor: active ? gc : colors.border,
    },
    active ? glow(gc, 12) : null,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [base, pressed ? [{ borderColor: gc }, glow(gc, 16)] : null]}
      >
        {({ pressed }) => (
          <>
            {(pressed || active) && <NeonCorners color={gc} />}
            {children}
          </>
        )}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={base}>
      {active && <NeonCorners color={gc} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, marginBottom: 2 },
  sectionBar: { width: 3, height: 16, borderRadius: 2 },
  sectionText: { fontSize: 11, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  sectionLine: { flex: 1, height: 1, marginLeft: spacing.xs },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, position: "relative", overflow: "visible" },
});
