import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, formatBytes, UserT } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { useSettings } from "@/src/settings";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function countdown(target: string | null, now: number) {
  if (!target) return { d: 0, h: 0, m: 0, s: 0, expired: true };
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, expired: false };
}

export default function BerandaScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user: authUser, signOut, setUser } = useAuth();
  const { t, lang, scheme, toggleLang, toggleScheme } = useSettings();

  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<UserT>("/profile"),
    initialData: authUser ?? undefined,
  });
  const user = profileQ.data ?? authUser;

  useEffect(() => {
    if (profileQ.data) setUser(profileQ.data);
  }, [profileQ.data, setUser]);

  const [whitelistIp, setWhitelistIp] = useState("");
  const [pwModal, setPwModal] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const whitelistMut = useMutation({
    mutationFn: (ip: string) => api<UserT>("/profile/whitelist", { method: "POST", json: { ip } }),
    onSuccess: (u) => {
      qc.setQueryData(["profile"], u);
      setWhitelistIp("");
      toast.show(t("ip_added"), "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const removeWlMut = useMutation({
    mutationFn: (ip: string) => api<UserT>(`/profile/whitelist/${encodeURIComponent(ip)}`, { method: "DELETE" }),
    onSuccess: (u) => {
      qc.setQueryData(["profile"], u);
      toast.show(t("ip_removed"), "info");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const resetTrafficMut = useMutation({
    mutationFn: () => api<UserT>("/profile/reset-traffic", { method: "POST" }),
    onSuccess: (u) => {
      qc.setQueryData(["profile"], u);
      toast.show(t("traffic_reset"), "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const clearHistoryMut = useMutation({
    mutationFn: () => api("/history", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.show(t("history_cleared"), "info");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const myIpMut = useMutation({
    mutationFn: () => api<{ ip: string }>("/my-ip"),
    onSuccess: (r) => setWhitelistIp(r.ip),
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const changePwMut = useMutation({
    mutationFn: () =>
      api("/auth/change-password", {
        method: "POST",
        json: { current_password: curPw, new_password: newPw },
      }),
    onSuccess: () => {
      setPwModal(false);
      setCurPw("");
      setNewPw("");
      toast.show(t("pw_changed"), "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const copyCreds = async () => {
    if (!user) return;
    await Clipboard.setStringAsync(`${user.server_host}:${user.server_port}`);
    toast.show(t("server_copied"), "success");
  };

  if (!user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  const cd = countdown(user.expires_at, tick);
  const bottomPad = usesNativeTabs ? insets.bottom + 24 : 24;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.flex1}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>RIYANMEE</Text>
            <Text style={styles.brandAccent}> PROXY</Text>
          </View>
          <Text style={styles.brandSub}>Hunter Engine Access</Text>
        </View>
        <Pressable testID="theme-toggle" onPress={toggleScheme} style={styles.headerIcon} hitSlop={6}>
          <Icon name={scheme === "dark" ? "weather-night" : "white-balance-sunny"} size={20} color={colors.onSurfaceSecondary} />
        </Pressable>
        <Pressable testID="lang-toggle" onPress={toggleLang} style={styles.langBtn} hitSlop={6}>
          <Text style={styles.langText}>{lang.toUpperCase()}</Text>
        </Pressable>
        <Pressable testID="logout-button" onPress={signOut} style={styles.logoutBtn} hitSlop={8}>
          <Text style={styles.logoutText}>{t("logout")}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View testID="profile-card" style={styles.card}>
          <Text style={styles.cardLabel}>{t("customer_profile")}</Text>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.flex1}>
              <Text testID="profile-username" style={styles.username}>{user.username}</Text>
              <Text style={styles.tier}>{user.tier}</Text>
              <Text style={styles.activeLabel}>
                {t("active")}{" "}
                <Text style={styles.activeValue} testID="membership-countdown">
                  {cd.expired ? t("expired") : `${cd.d}H ${cd.h}J ${cd.m}M ${cd.s}D`}
                </Text>
              </Text>
            </View>
          </View>

          <Pressable testID="server-creds" onPress={copyCreds} style={styles.credBox}>
            <View style={styles.credRow}>
              <Text style={styles.credKey}>{t("server")}</Text>
              <Text style={styles.credVal} numberOfLines={1}>{user.server_host}</Text>
            </View>
            <View style={styles.credDivider} />
            <View style={styles.credRow}>
              <Text style={styles.credKey}>{t("port")}</Text>
              <Text style={[styles.credVal, styles.credPort]}>{user.server_port}</Text>
            </View>
          </Pressable>

          <View style={styles.btnRow}>
            <Pressable testID="change-password-button" onPress={() => setPwModal(true)} style={[styles.actionBtn, styles.actionInfo]}>
              <Text style={[styles.actionText, { color: colors.info }]}>{t("change_password")}</Text>
            </Pressable>
            <Pressable
              testID="clear-history-button"
              onPress={() => clearHistoryMut.mutate()}
              style={[styles.actionBtn, styles.actionDanger]}
            >
              <Text style={[styles.actionText, { color: colors.error }]}>{t("clear_all")}</Text>
            </Pressable>
          </View>
          <Pressable
            testID="reset-traffic-button"
            onPress={() => resetTrafficMut.mutate()}
            style={[styles.actionBtnFull, { borderColor: colors.divider, backgroundColor: colors.surfaceTertiary }]}
          >
            <Text style={[styles.actionText, { color: colors.onSurfaceSecondary }]}>
              {t("reset_traffic")} · {formatBytes(user.traffic_bytes)}
            </Text>
          </Pressable>

          <View style={styles.hr} />

          <Text style={styles.cardLabel}>{t("ip_whitelist")}</Text>
          <View style={styles.wlInputRow}>
            <TextInput
              testID="whitelist-input"
              style={styles.wlInput}
              placeholder="cth: 59.153.131.72"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              value={whitelistIp}
              onChangeText={setWhitelistIp}
            />
            <Pressable
              testID="whitelist-myip-button"
              onPress={() => myIpMut.mutate()}
              style={styles.myIpBtn}
              disabled={myIpMut.isPending}
            >
              {myIpMut.isPending ? (
                <ActivityIndicator size="small" color={colors.onBrandPrimary} />
              ) : (
                <Text style={styles.myIpText}>{t("whitelist_myip")}</Text>
              )}
            </Pressable>
          </View>
          <Pressable
            testID="whitelist-add-button"
            onPress={() => {
              if (!whitelistIp.trim()) {
                toast.show(t("fill_ip_first"), "error");
                return;
              }
              whitelistMut.mutate(whitelistIp.trim());
            }}
            style={[styles.actionBtnFull, { backgroundColor: colors.brandTertiary, borderColor: colors.border }]}
          >
            <Text style={[styles.actionText, { color: colors.onBrandTertiary }]}>{t("add_to_whitelist")}</Text>
          </Pressable>

          {user.whitelist_ips.length > 0 ? (
            <View style={styles.wlList}>
              {user.whitelist_ips.map((ip) => (
                <View key={ip} testID={`whitelist-item-${ip}`} style={styles.wlChip}>
                  <Text style={styles.wlChipText}>{ip}</Text>
                  <Pressable onPress={() => removeWlMut.mutate(ip)} hitSlop={8} testID={`whitelist-remove-${ip}`}>
                    <Icon name="close" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.poolRow}>
            <Text style={styles.poolLabel}>{t("total_pool")}</Text>
            <View style={styles.poolValueRow}>
              <Icon name="earth" size={16} color={colors.brandPrimary} />
              <Text style={styles.poolValue}>{user.total_pool} {t("ips_pool")}</Text>
            </View>
          </View>
        </View>

        <Pressable testID="go-servers-card" onPress={() => router.push("/servers")} style={styles.linkCard}>
          <Icon name="server-network" size={22} color={colors.brandPrimary} />
          <View style={styles.flex1}>
            <Text style={styles.linkTitle}>{t("link_servers")}</Text>
            <Text style={styles.linkSub}>{t("link_servers_sub")}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.muted} />
        </Pressable>
        <Pressable testID="go-gateway-card" onPress={() => router.push("/gateway")} style={styles.linkCard}>
          <Icon name="transit-connection-variant" size={22} color={colors.brandPrimary} />
          <View style={styles.flex1}>
            <Text style={styles.linkTitle}>{t("link_gateway")}</Text>
            <Text style={styles.linkSub}>{t("link_gateway_sub")}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.muted} />
        </Pressable>
        <Pressable testID="go-plans-card" onPress={() => router.push("/langganan")} style={styles.linkCard}>
          <Icon name="crown" size={22} color={colors.warning} />
          <View style={styles.flex1}>
            <Text style={styles.linkTitle}>{t("link_plans")}</Text>
            <Text style={styles.linkSub}>{t("link_plans_sub")}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.muted} />
        </Pressable>
        <Pressable testID="go-purchases-card" onPress={() => router.push("/pembelian")} style={styles.linkCard}>
          <Icon name="receipt" size={22} color={colors.info} />
          <View style={styles.flex1}>
            <Text style={styles.linkTitle}>{t("link_purchases")}</Text>
            <Text style={styles.linkSub}>{t("link_purchases_sub")}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.muted} />
        </Pressable>
        <Pressable testID="go-hunting-card" onPress={() => router.push("/hunting")} style={styles.linkCard}>
          <Icon name="target" size={22} color={colors.brandPrimary} />
          <View style={styles.flex1}>
            <Text style={styles.linkTitle}>{t("link_hunting")}</Text>
            <Text style={styles.linkSub}>{t("link_hunting_sub")}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.muted} />
        </Pressable>
        <Pressable testID="go-cekip-card" onPress={() => router.push("/cekip")} style={styles.linkCard}>
          <Icon name="web" size={22} color={colors.info} />
          <View style={styles.flex1}>
            <Text style={styles.linkTitle}>{t("link_cekip")}</Text>
            <Text style={styles.linkSub}>{t("link_cekip_sub")}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.muted} />
        </Pressable>
      </ScrollView>

      <Modal visible={pwModal} transparent animationType="slide" onRequestClose={() => setPwModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.sheetTitle}>{t("change_password")}</Text>
            <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{t("cur_password")}</Text>
              <TextInput
                testID="cur-password-input"
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                value={curPw}
                onChangeText={setCurPw}
              />
              <Text style={styles.fieldLabel}>{t("new_password")}</Text>
              <TextInput
                testID="new-password-input"
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                value={newPw}
                onChangeText={setNewPw}
              />
              <View style={styles.btnRow}>
                <Pressable testID="pw-cancel-button" onPress={() => setPwModal(false)} style={[styles.sheetBtn, { borderColor: colors.divider }]}>
                  <Text style={[styles.actionText, { color: colors.onSurfaceSecondary }]}>{t("cancel")}</Text>
                </Pressable>
                <Pressable
                  testID="pw-save-button"
                  onPress={() => {
                    if (newPw.length < 6) {
                      toast.show(t("new_pw_min6"), "error");
                      return;
                    }
                    changePwMut.mutate();
                  }}
                  style={[styles.sheetBtn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                  disabled={changePwMut.isPending}
                >
                  {changePwMut.isPending ? (
                    <ActivityIndicator size="small" color={colors.onBrandPrimary} />
                  ) : (
                    <Text style={[styles.actionText, { color: colors.onBrandPrimary }]}>{t("save")}</Text>
                  )}
                </Pressable>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  loading: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  flex1: { flex: 1 },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 2 },
  brandAccent: { color: colors.brandPrimary, fontSize: font.xl, fontWeight: "800", letterSpacing: 2 },
  brandSub: { color: colors.muted, fontSize: font.sm, fontStyle: "italic", marginTop: 2 },
  logoutBtn: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  logoutText: { color: colors.error, fontSize: font.sm, fontWeight: "800", letterSpacing: 1 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  langBtn: {
    width: 44,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  langText: { color: colors.onSurfaceSecondary, fontSize: font.sm, fontWeight: "800" },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onBrandPrimary, fontSize: font.xxl, fontWeight: "800" },
  username: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800" },
  tier: { color: colors.brandPrimary, fontSize: font.sm, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  activeLabel: { color: colors.muted, fontSize: font.sm, marginTop: spacing.xs },
  activeValue: { color: colors.onSurfaceSecondary, fontFamily: mono, fontWeight: "700" },
  credBox: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  credRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  credKey: { color: colors.muted, fontSize: font.sm, fontWeight: "700", letterSpacing: 1 },
  credVal: { color: colors.onSurface, fontSize: font.base, fontFamily: mono, flexShrink: 1, textAlign: "right" },
  credPort: { color: colors.brandPrimary, fontWeight: "800" },
  credDivider: { height: 1, backgroundColor: colors.divider },
  btnRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  actionBtn: { flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionInfo: { borderColor: colors.info, backgroundColor: "transparent" },
  actionDanger: { borderColor: colors.error, backgroundColor: "transparent" },
  actionBtnFull: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  actionText: { fontSize: font.sm, fontWeight: "800", letterSpacing: 1 },
  hr: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  wlInputRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md, alignItems: "stretch" },
  wlInput: {
    flex: 1,
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
  myIpBtn: {
    width: 96,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  myIpText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "800", textAlign: "center", letterSpacing: 0.5 },
  wlList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  wlChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  wlChipText: { color: colors.onSurfaceSecondary, fontSize: font.sm, fontFamily: mono },
  poolRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
  poolLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  poolValueRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  poolValue: { color: colors.brandPrimary, fontSize: font.sm, fontWeight: "800" },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  linkTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "700" },
  linkSub: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: "80%",
  },
  sheetTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.md },
  fieldLabel: {
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
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  sheetBtn: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
}));
