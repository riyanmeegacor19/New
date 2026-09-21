import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, HuntMode, HuntResp, ProxyAccountT, ProxyResultT } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { useT } from "@/src/settings";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

export default function HuntingScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();

  const MODES: { value: HuntMode; label: string; desc: string }[] = [
    { value: "ultimate", label: t("mode_ultimate"), desc: t("mode_ultimate_desc") },
    { value: "full", label: t("mode_full"), desc: t("mode_full_desc") },
    { value: "city", label: t("mode_city"), desc: t("mode_city_desc") },
    { value: "isp", label: t("mode_isp"), desc: t("mode_isp_desc") },
  ];

  const [targetIp, setTargetIp] = useState("");
  const [mode, setMode] = useState<HuntMode>("ultimate");
  const [modeOpen, setModeOpen] = useState(false);
  const [result, setResult] = useState<HuntResp | null>(null);
  const [connected, setConnected] = useState<ProxyResultT | null>(null);

  const proxyQ = useQuery({ queryKey: ["proxy-account"], queryFn: () => api<ProxyAccountT>("/proxy-account") });
  const pa = proxyQ.data;
  const srvHost = pa?.host || user?.server_host;
  const srvPort = pa?.port || user?.server_port;
  const srvUser = pa?.username || user?.username || "";
  const srvPass = pa?.password || user?.proxy_password;

  const proxyString = (p: ProxyResultT) => {
    const host = p.gateway_host || srvHost;
    const port = p.gateway_port || p.port || srvPort;
    const u = p.username || srvUser;
    const pw = p.password || srvPass;
    return u ? `${host}:${port}:${u}:${pw}` : `${host}:${port}`;
  };

  const copyCreds = async () => {
    if (connected) {
      await Clipboard.setStringAsync(proxyString(connected));
    } else {
      await Clipboard.setStringAsync(`${srvHost}:${srvPort}${srvUser ? `:${srvUser}:${srvPass}` : ""}`);
    }
    toast.show(t("creds_copied"), "success");
  };

  const huntMut = useMutation({
    mutationFn: () => api<HuntResp>("/hunt", { method: "POST", json: { target_ip: targetIp.trim(), mode } }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.show(`${r.count} ${t("proxies_found").toLowerCase()}`, "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const startHunt = () => {
    const ip = targetIp.trim();
    if (!ip) {
      toast.show(t("fill_target"), "error");
      return;
    }
    // Basic IPv4 / IPv6 sanity check (backend validates strictly too)
    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    const isIpv6 = ip.includes(":") && ip.length >= 3;
    if (!isIpv4 && !isIpv6) {
      toast.show(t("invalid_ip"), "error");
      return;
    }
    if (isIpv4 && ip.split(".").some((o) => Number(o) > 255)) {
      toast.show(t("invalid_ip"), "error");
      return;
    }
    huntMut.mutate();
  };

  const copyOne = async (p: ProxyResultT) => {
    await Clipboard.setStringAsync(proxyString(p));
    toast.show(`${p.ip} ${t("copied")}`, "success");
  };

  const copyAll = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.results.map(proxyString).join("\n"));
    toast.show(`${result.count} proxy ${t("copied")}`, "success");
  };

  const exportTxt = async () => {
    if (!result) return;
    const body = result.results.map(proxyString).join("\n");
    try {
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(body);
        toast.show(t("exported"), "success");
        return;
      }
      const file = new File(Paths.cache, `riyanmee_proxies_${Date.now()}.txt`);
      file.create({ overwrite: true });
      file.write(body);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "text/plain", dialogTitle: "Export Proxy" });
      } else {
        await Clipboard.setStringAsync(body);
      }
      toast.show(t("exported"), "success");
    } catch {
      toast.show(t("export_failed"), "error");
    }
  };

  const activeMode = MODES.find((m) => m.value === mode)!;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>{t("hunting_title")}</Text>
        <Text style={styles.subtitle}>{t("hunting_sub")}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>{t("target_ip_label")}</Text>
          <TextInput
            testID="hunt-target-input"
            value={targetIp}
            onChangeText={setTargetIp}
            placeholder="31.166.28.143"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "default"}
            returnKeyType="search"
            onSubmitEditing={startHunt}
            style={styles.input}
          />

          <Text style={styles.label}>{t("mode_hunting")}</Text>
          <Pressable testID="hunt-mode-button" onPress={() => setModeOpen(true)} style={styles.dropdown}>
            <View style={styles.flex1}>
              <Text style={styles.dropdownValue}>{activeMode.label}</Text>
              <Text style={styles.dropdownDesc}>{activeMode.desc}</Text>
            </View>
            <Icon name="chevron-down" size={22} color={colors.muted} />
          </Pressable>

          <Pressable
            testID="hunt-start-button"
            onPress={startHunt}
            style={styles.startBtn}
            disabled={huntMut.isPending}
          >
            {huntMut.isPending ? (
              <View style={styles.startRow}>
                <ActivityIndicator color={colors.onBrandPrimary} />
                <Text style={styles.startText}>{t("hunting_wait")}</Text>
              </View>
            ) : (
              <Text style={styles.startText}>{t("start_hunt")}</Text>
            )}
          </Pressable>
        </View>

        {result ? (
          <View testID="hunt-results" style={styles.card}>
            <View style={styles.resultHeader}>
              <View style={styles.flex1}>
                <Text style={styles.resultTitle}>{result.count} {t("proxies_found")}</Text>
                <Text style={styles.resultTarget}>{[result.target.city, result.target.country].filter(Boolean).join(", ")} · {result.mode_label}</Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              <Pressable testID="hunt-copy-all" onPress={copyAll} style={styles.smallBtn}>
                <Icon name="content-copy" size={15} color={colors.onBrandTertiary} />
                <Text style={styles.smallBtnText}>{t("copy_all")}</Text>
              </Pressable>
              <Pressable testID="hunt-export" onPress={exportTxt} style={[styles.smallBtn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                <Icon name="file-download-outline" size={15} color={colors.onBrandPrimary} />
                <Text style={[styles.smallBtnText, { color: colors.onBrandPrimary }]}>{t("export_txt")}</Text>
              </Pressable>
            </View>

            {result.results.map((p, idx) => (
              <View key={`${p.ip}:${p.port}:${idx}`} testID={`proxy-item-${idx}`} style={styles.proxyRow}>
                <Pressable style={styles.flex1} onPress={() => copyOne(p)}>
                  <Text style={styles.proxyIp}>{p.ip}</Text>
                  <Text style={styles.similarity}>{t("similarity")}: OCTET {p.octet_match ?? 0}/4</Text>
                  <Text style={styles.proxyMeta} numberOfLines={1}>{[p.city, p.country].filter(Boolean).join(", ")} · {p.isp}</Text>
                  <View style={styles.proxyBadges}>
                    <View style={[styles.typeBadge, { borderColor: p.owned ? colors.borderStrong : colors.border, backgroundColor: p.owned ? colors.brandTertiary : "transparent" }]}>
                      <Text style={[styles.typeText, { color: p.owned ? colors.onBrandTertiary : colors.onSurfaceTertiary }]}>{p.owned ? t("owned_badge") : p.type}</Text>
                    </View>
                    <Text style={styles.latency}>{p.latency_ms}ms</Text>
                  </View>
                </Pressable>
                <Pressable testID={`proxy-connect-${idx}`} onPress={() => setConnected(p)} style={styles.connectBtn}>
                  <Text style={styles.connectText}>{t("connect")}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Icon name="target-variant" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>{t("hunt_empty")}</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={modeOpen} transparent animationType="fade" onRequestClose={() => setModeOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModeOpen(false)}>
          <View style={styles.pickerCard}>
            {MODES.map((m) => {
              const selected = m.value === mode;
              return (
                <Pressable key={m.value} testID={`mode-option-${m.value}`} onPress={() => { setMode(m.value); setModeOpen(false); }} style={styles.pickerRow}>
                  <Icon name={selected ? "check-circle" : "circle-outline"} size={22} color={selected ? colors.brandPrimary : colors.muted} />
                  <View style={styles.flex1}>
                    <Text style={[styles.pickerLabel, { color: selected ? colors.onSurface : colors.onSurfaceSecondary }]}>{m.label}</Text>
                    <Text style={styles.pickerDesc}>{m.desc}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!connected} transparent animationType="fade" onRequestClose={() => setConnected(null)}>
        <View style={styles.modalBackdrop}>
          <View testID="connect-success-modal" style={styles.successCard}>
            <View style={styles.successIcon}>
              <Icon name="check" size={40} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.successTitle}>{t("success")}</Text>

            {connected ? (
              <View style={styles.successBox}>
                <View style={styles.sRow}>
                  <Text style={styles.sKey}>{t("ip_proxy")}:</Text>
                  <Text testID="success-ip" style={styles.sVal}>{connected.ip}</Text>
                </View>
                <View style={styles.sRow}>
                  <Text style={styles.sKey}>{t("location_label")}:</Text>
                  <Text style={styles.sVal}>{[connected.city, connected.country_code || connected.country].filter(Boolean).join(", ")}</Text>
                </View>
                <View style={styles.sRow}>
                  <Text style={styles.sKey}>{t("asn_label")}:</Text>
                  <Text style={styles.sVal} numberOfLines={1}>{connected.asn || connected.isp}</Text>
                </View>
                <View style={styles.sRow}>
                  <Text style={styles.sKey}>{t("server_label")}:</Text>
                  <Text style={styles.sVal} numberOfLines={1}>{connected.gateway_host || srvHost}</Text>
                </View>
                <View style={styles.sDivider} />
                <View style={styles.sRow}>
                  <Text style={styles.sKey}>{t("port_label")}:</Text>
                  <Text style={[styles.sVal, styles.sPort]}>{connected.gateway_port || connected.port || srvPort}</Text>
                </View>
                <View style={styles.sRow}>
                  <Text style={styles.sKey}>User:</Text>
                  <Text testID="success-user" style={styles.sVal} numberOfLines={1}>{connected.username || srvUser}</Text>
                </View>
                <View style={styles.sRow}>
                  <Text style={styles.sKey}>Pass:</Text>
                  <Text testID="success-pass" style={styles.sVal} numberOfLines={1}>{connected.password || srvPass}</Text>
                </View>
              </View>
            ) : null}

            <Pressable testID="success-copy-button" onPress={copyCreds} style={styles.copyCredsBtn}>
              <Icon name="content-copy" size={16} color={colors.onBrandTertiary} />
              <Text style={styles.copyCredsText}>{t("copy_creds")}</Text>
            </Pressable>
            <Pressable testID="success-ok-button" onPress={() => setConnected(null)} style={styles.okBtn}>
              <Text style={styles.okText}>{t("ok")}</Text>
            </Pressable>
          </View>
        </View>
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
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, color: colors.onSurface, fontSize: font.lg, fontFamily: mono, paddingHorizontal: spacing.md, height: 56 },
  dropdown: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  dropdownValue: { color: colors.onSurface, fontSize: font.base, fontWeight: "700" },
  dropdownDesc: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  startBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.xl, shadowColor: colors.brandPrimary, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  startRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  startText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "800", letterSpacing: 2 },
  resultHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  resultTitle: { color: colors.onSurface, fontSize: font.base, fontWeight: "800", letterSpacing: 1 },
  resultTarget: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  smallBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.md },
  smallBtnText: { color: colors.onBrandTertiary, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  proxyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, paddingVertical: spacing.md },
  proxyIp: { color: colors.onSurface, fontSize: font.base, fontFamily: mono, fontWeight: "700" },
  similarity: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginTop: 4, fontFamily: mono },
  proxyPort: { color: colors.brandPrimary },
  proxyMeta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  proxyBadges: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  connectBtn: { height: 40, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  connectText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  typeBadge: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  typeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  latency: { color: colors.muted, fontSize: 11, fontFamily: mono },
  successCard: { width: "100%", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center" },
  successIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  successTitle: { color: colors.onSurface, fontSize: 26, fontWeight: "800", marginBottom: spacing.lg },
  successBox: { width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  sRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  sKey: { color: colors.onSurfaceTertiary, fontSize: font.sm, fontFamily: mono },
  sVal: { color: colors.onSurface, fontSize: font.sm, fontFamily: mono, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  sPort: { color: colors.brandPrimary, fontSize: font.lg },
  sDivider: { height: 1, backgroundColor: colors.divider, marginVertical: 2 },
  okBtn: { marginTop: spacing.md, minWidth: 120, height: 48, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  okText: { color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "800", letterSpacing: 1 },
  copyCredsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.lg, alignSelf: "stretch", height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.brandTertiary },
  copyCredsText: { color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "800", letterSpacing: 0.5 },
  emptyCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.xxl, alignItems: "center", gap: spacing.md },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: font.base, textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  pickerCard: { width: "100%", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm },
  countryScroll: { maxHeight: 400 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  pickerLabel: { fontSize: font.base, fontWeight: "700" },
  pickerDesc: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
}));
