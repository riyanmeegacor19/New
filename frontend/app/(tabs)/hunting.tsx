import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, HuntMode, HuntResp, ProxyResultT } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

const MODES: { value: HuntMode; label: string; desc: string }[] = [
  { value: "ultimate", label: "ULTIMATE AUTO", desc: "Pemilihan otomatis terbaik" },
  { value: "full", label: "FULL SCAN", desc: "Negara, Kota, ISP/ASN Cocok" },
  { value: "city", label: "KOTA SAJA", desc: "Fokus pada Kota Tertentu" },
  { value: "isp", label: "ISP SAJA", desc: "Fokus Penyedia yang Sama" },
];

export default function HuntingScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [targetIp, setTargetIp] = useState("");
  const [mode, setMode] = useState<HuntMode>("ultimate");
  const [modeOpen, setModeOpen] = useState(false);
  const [result, setResult] = useState<HuntResp | null>(null);

  const huntMut = useMutation({
    mutationFn: () => api<HuntResp>("/hunt", { method: "POST", json: { target_ip: targetIp.trim(), mode } }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.show(`${r.count} proxy ditemukan`, "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const copyOne = async (p: ProxyResultT) => {
    await Clipboard.setStringAsync(`${p.ip}:${p.port}`);
    toast.show(`${p.ip}:${p.port} disalin`, "success");
  };

  const copyAll = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.results.map((p) => `${p.ip}:${p.port}`).join("\n"));
    toast.show(`${result.count} proxy disalin`, "success");
  };

  const bottomPad = usesNativeTabs ? insets.bottom + 24 : 24;
  const activeMode = MODES.find((m) => m.value === mode)!;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>IP Hunting</Text>
        <Text style={styles.subtitle}>Cari proxy sesuai lokasi & ISP target</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.label}>ALAMAT IP TARGET (IPV4 / IPV6)</Text>
          <TextInput
            testID="hunt-target-input"
            style={styles.input}
            placeholder="Contoh: 109.228.222.82"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={targetIp}
            onChangeText={setTargetIp}
          />

          <Text style={styles.label}>MODE HUNTING</Text>
          <Pressable testID="hunt-mode-button" onPress={() => setModeOpen(true)} style={styles.dropdown}>
            <View style={styles.flex1}>
              <Text style={styles.dropdownValue}>{activeMode.label}</Text>
              <Text style={styles.dropdownDesc}>{activeMode.desc}</Text>
            </View>
            <Icon name="chevron-down" size={22} color={colors.muted} />
          </Pressable>

          <Pressable
            testID="hunt-start-button"
            onPress={() => {
              if (!targetIp.trim()) {
                toast.show("Masukkan IP target dulu", "error");
                return;
              }
              huntMut.mutate();
            }}
            style={styles.startBtn}
            disabled={huntMut.isPending}
          >
            {huntMut.isPending ? (
              <View style={styles.startRow}>
                <ActivityIndicator color={colors.onBrandPrimary} />
                <Text style={styles.startText}>MENCARI...</Text>
              </View>
            ) : (
              <Text style={styles.startText}>MULAI PENCARIAN</Text>
            )}
          </Pressable>
        </View>

        {result ? (
          <View testID="hunt-results" style={styles.card}>
            <View style={styles.resultHeader}>
              <View style={styles.flex1}>
                <Text style={styles.resultTitle}>{result.count} PROXY DITEMUKAN</Text>
                <Text style={styles.resultTarget}>
                  {[result.target.city, result.target.country].filter(Boolean).join(", ")} · {result.mode_label}
                </Text>
              </View>
              <Pressable testID="hunt-copy-all" onPress={copyAll} style={styles.copyAllBtn}>
                <Icon name="content-copy" size={16} color={colors.onBrandTertiary} />
                <Text style={styles.copyAllText}>SALIN SEMUA</Text>
              </Pressable>
            </View>

            {result.results.map((p, idx) => (
              <Pressable
                key={`${p.ip}:${p.port}`}
                testID={`proxy-item-${idx}`}
                onPress={() => copyOne(p)}
                style={styles.proxyRow}
              >
                <View style={styles.flex1}>
                  <Text style={styles.proxyIp}>
                    {p.ip}
                    <Text style={styles.proxyPort}>:{p.port}</Text>
                  </Text>
                  <Text style={styles.proxyMeta} numberOfLines={1}>
                    {[p.city, p.country].filter(Boolean).join(", ")} · {p.isp}
                  </Text>
                </View>
                <View style={styles.proxyRight}>
                  <View style={[styles.typeBadge, { borderColor: colors.border }]}>
                    <Text style={styles.typeText}>{p.type}</Text>
                  </View>
                  <Text style={styles.latency}>{p.latency_ms}ms</Text>
                </View>
                <Icon name="content-copy" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Icon name="target-variant" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>
              Masukkan IP target dan ketuk &quot;Mulai Pencarian&quot; untuk menemukan proxy yang cocok.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Mode picker modal */}
      <Modal visible={modeOpen} transparent animationType="fade" onRequestClose={() => setModeOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModeOpen(false)}>
          <View style={styles.pickerCard}>
            {MODES.map((m) => {
              const selected = m.value === mode;
              return (
                <Pressable
                  key={m.value}
                  testID={`mode-option-${m.value}`}
                  onPress={() => {
                    setMode(m.value);
                    setModeOpen(false);
                  }}
                  style={styles.pickerRow}
                >
                  <Icon
                    name={selected ? "check-circle" : "circle-outline"}
                    size={22}
                    color={selected ? colors.brandPrimary : colors.muted}
                  />
                  <View style={styles.flex1}>
                    <Text style={[styles.pickerLabel, { color: selected ? colors.onSurface : colors.onSurfaceSecondary }]}>
                      {m.label}
                    </Text>
                    <Text style={styles.pickerDesc}>{m.desc}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  flex1: { flex: 1 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    color: colors.onSurface,
    fontSize: font.lg,
    fontFamily: mono,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dropdownValue: { color: colors.onSurface, fontSize: font.base, fontWeight: "700" },
  dropdownDesc: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  startBtn: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
    shadowColor: colors.brandPrimary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  startRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  startText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "800", letterSpacing: 2 },
  resultHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  resultTitle: { color: colors.onSurface, fontSize: font.base, fontWeight: "800", letterSpacing: 1 },
  resultTarget: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  copyAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  copyAllText: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  proxyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingVertical: spacing.md,
  },
  proxyIp: { color: colors.onSurface, fontSize: font.base, fontFamily: mono, fontWeight: "700" },
  proxyPort: { color: colors.brandPrimary },
  proxyMeta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  proxyRight: { alignItems: "flex-end", gap: 4 },
  typeBadge: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { color: colors.onBrandTertiary, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  latency: { color: colors.muted, fontSize: 11, fontFamily: mono },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  pickerCard: {
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  pickerLabel: { fontSize: font.base, fontWeight: "700" },
  pickerDesc: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
}));
