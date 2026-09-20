import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, GeoT } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { useT } from "@/src/settings";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

export default function CekIpScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const qc = useQueryClient();

  const [ip, setIp] = useState("");
  const [result, setResult] = useState<GeoT | null>(null);

  const checkMut = useMutation({
    mutationFn: () => api<GeoT>("/tools/ip-info", { method: "POST", json: { ip: ip.trim() } }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.show(t("ip_found"), "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const rows: { label: string; value: string }[] = result
    ? [
        { label: t("f_ip"), value: result.ip },
        { label: t("f_country"), value: [result.country, result.country_code].filter(Boolean).join(" · ") },
        { label: t("f_region"), value: result.region || "—" },
        { label: t("f_city"), value: result.city || "—" },
        { label: t("f_isp"), value: result.isp || "—" },
        { label: t("f_asn"), value: result.asn || "—" },
        { label: t("f_tz"), value: result.timezone || "—" },
        {
          label: t("f_coord"),
          value:
            result.latitude != null && result.longitude != null
              ? `${result.latitude}, ${result.longitude}`
              : "—",
        },
      ]
    : [];

  const bottomPad = usesNativeTabs ? insets.bottom + 24 : 24;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>{t("cekip_title")}</Text>
        <Text style={styles.subtitle}>{t("cekip_sub")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.label}>{t("ip_address")}</Text>
          <TextInput
            testID="cekip-input"
            style={styles.input}
            placeholder="Contoh: 104.23.175.121"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={ip}
            onChangeText={setIp}
          />
          <Pressable
            testID="cekip-button"
            onPress={() => {
              if (!ip.trim()) {
                toast.show(t("fill_ip"), "error");
                return;
              }
              checkMut.mutate();
            }}
            style={styles.checkBtn}
            disabled={checkMut.isPending}
          >
            {checkMut.isPending ? (
              <ActivityIndicator color={colors.onSuccess} />
            ) : (
              <Text style={styles.checkText}>{t("check_ip")}</Text>
            )}
          </Pressable>
        </View>

        {result ? (
          <View testID="cekip-result" style={styles.card}>
            <View style={styles.resultHead}>
              <Icon name="map-marker-radius" size={20} color={colors.brandPrimary} />
              <Text style={styles.resultTitle}>{t("track_result")}</Text>
            </View>
            {rows.map((r) => (
              <View key={r.label} style={styles.row}>
                <Text style={styles.rowKey}>{r.label}</Text>
                <Text style={styles.rowVal} numberOfLines={2}>{r.value}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Icon name="web" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>{t("cekip_empty")}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    color: colors.onSurface,
    fontSize: font.base,
    fontFamily: mono,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  checkBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  checkText: { color: colors.onSuccess, fontSize: font.lg, fontWeight: "800", letterSpacing: 2 },
  resultHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  resultTitle: { color: colors.onSurface, fontSize: font.base, fontWeight: "800", letterSpacing: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: spacing.md,
  },
  rowKey: { color: colors.muted, fontSize: font.sm, fontWeight: "700" },
  rowVal: { flex: 1, color: colors.onSurface, fontSize: font.base, fontFamily: mono, textAlign: "right" },
  emptyCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: font.base, textAlign: "center" },
}));
