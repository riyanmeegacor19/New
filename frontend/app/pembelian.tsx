import Icon from "@react-native-vector-icons/material-design-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PurchaseT } from "@/src/api";
import { useT } from "@/src/settings";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function fmt(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function PembelianScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();

  const purchasesQ = useQuery({ queryKey: ["purchases"], queryFn: () => api<PurchaseT[]>("/purchases") });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="purchases-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>{t("purchases_title")}</Text>
          <Text style={styles.subtitle}>{t("purchases_sub")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        {purchasesQ.isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : purchasesQ.data?.length ? (
          purchasesQ.data.map((p) => (
            <View key={p.id} testID={`purchase-row-${p.id}`} style={styles.card}>
              <View style={styles.iconWrap}>
                <Icon name="receipt-text-check" size={22} color={colors.brandPrimary} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.planName}>{p.plan_name}</Text>
                <Text style={styles.meta}>{t("active_until")} {fmtDate(p.expires_at)}</Text>
                <Text style={styles.ts}>{fmt(p.ts)}</Text>
              </View>
              <Text style={styles.price}>{p.price_label}</Text>
            </View>
          ))
        ) : (
          <View testID="purchases-empty" style={styles.empty}>
            <Icon name="receipt" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>{t("purchases_empty")}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 40, height: 44, alignItems: "flex-start", justifyContent: "center" },
  flex1: { flex: 1 },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  planName: { color: colors.onSurface, fontSize: font.lg, fontWeight: "700" },
  meta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  ts: { color: colors.muted, fontSize: 11, fontFamily: mono, marginTop: 2 },
  price: { color: colors.brandPrimary, fontSize: font.base, fontWeight: "800" },
  empty: { alignItems: "center", gap: spacing.md, paddingTop: 100, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: font.base, textAlign: "center" },
}));
