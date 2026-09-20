import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, GatewayT } from "@/src/api";
import { Segmented } from "@/src/components/segmented";
import { useToast } from "@/src/components/toast";
import { useT } from "@/src/settings";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

const PROTOCOLS = ["socks5", "http", "https", "ssh"];

export default function GatewayScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const qc = useQueryClient();

  const gatewayQ = useQuery({ queryKey: ["gateway"], queryFn: () => api<GatewayT>("/gateway") });

  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [protocol, setProtocol] = useState("socks5");

  useEffect(() => {
    const g = gatewayQ.data;
    if (g && g.configured) {
      setHost(g.host);
      setPort(String(g.port));
      setUsername(g.username);
      setPassword(g.password);
      setProtocol(g.protocol);
    }
  }, [gatewayQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      api<GatewayT>("/gateway", {
        method: "PUT",
        json: { host: host.trim(), port: Number(port), username: username.trim(), password, protocol },
      }),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["gateway"] });
      toast.show(`${t("gw_saved")} · ${g.online ? t("gw_online") : t("gw_offline")}`, g.online ? "success" : "info");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const testMut = useMutation({
    mutationFn: () => api<{ online: boolean }>("/gateway/test", { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["gateway"] });
      toast.show(r.online ? t("gw_online") : t("gw_offline"), r.online ? "success" : "error");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const clearMut = useMutation({
    mutationFn: () => api("/gateway", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gateway"] });
      setHost(""); setPort(""); setUsername(""); setPassword(""); setProtocol("socks5");
      toast.show(t("gw_cleared"), "info");
    },
  });

  const configured = gatewayQ.data?.configured;
  const online = gatewayQ.data?.online;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="gateway-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>{t("gateway_title")}</Text>
          <Text style={styles.subtitle}>{t("gateway_sub")}</Text>
        </View>
        {configured ? (
          <View style={[styles.statusBadge, { borderColor: online ? colors.brandPrimary : colors.error, backgroundColor: online ? colors.brandTertiary : "transparent" }]}>
            <View style={[styles.dot, { backgroundColor: online ? colors.brandPrimary : colors.error }]} />
            <Text style={[styles.statusText, { color: online ? colors.onBrandTertiary : colors.error }]}>
              {online ? t("gw_online") : t("gw_offline")}
            </Text>
          </View>
        ) : null}
      </View>

      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.noteCard}>
          <Icon name="information-outline" size={18} color={colors.muted} />
          <Text style={styles.noteText}>{configured ? t("gw_note") : t("gw_not_set")}</Text>
        </View>

        <Pressable testID="gateway-guide-button" onPress={() => router.push("/panduan")} style={styles.guideBtn}>
          <Icon name="book-open-variant" size={18} color={colors.onBrandTertiary} />
          <Text style={styles.guideText}>{t("guide_open")}</Text>
          <Icon name="chevron-right" size={20} color={colors.onBrandTertiary} />
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.label}>{t("gw_host")}</Text>
          <TextInput
            testID="gw-host-input"
            style={styles.input}
            placeholder="server.domain.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={host}
            onChangeText={setHost}
          />
          <Text style={styles.label}>{t("gw_port")}</Text>
          <TextInput
            testID="gw-port-input"
            style={styles.input}
            placeholder="1080"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            value={port}
            onChangeText={setPort}
          />
          <Text style={styles.label}>{t("gw_protocol")}</Text>
          <Segmented
            testIdPrefix="gw-protocol"
            options={PROTOCOLS.map((p) => ({ value: p, label: p.toUpperCase() }))}
            value={protocol}
            onChange={setProtocol}
          />
          <Text style={styles.label}>{t("gw_user")}</Text>
          <TextInput
            testID="gw-user-input"
            style={styles.input}
            placeholder="username"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <Text style={styles.label}>{t("gw_pass")}</Text>
          <TextInput
            testID="gw-pass-input"
            style={styles.input}
            placeholder="password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            testID="gw-save-button"
            onPress={() => {
              if (!host.trim() || !port.trim()) {
                toast.show(t("gw_host"), "error");
                return;
              }
              saveMut.mutate();
            }}
            style={styles.saveBtn}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.saveText}>{t("gw_save")}</Text>
            )}
          </Pressable>

          {configured ? (
            <View style={styles.rowBtns}>
              <Pressable testID="gw-test-button" onPress={() => testMut.mutate()} style={[styles.subBtn, { borderColor: colors.border, backgroundColor: colors.brandTertiary }]} disabled={testMut.isPending}>
                {testMut.isPending ? (
                  <ActivityIndicator size="small" color={colors.onBrandTertiary} />
                ) : (
                  <Text style={[styles.subText, { color: colors.onBrandTertiary }]}>{t("gw_test")}</Text>
                )}
              </Pressable>
              <Pressable testID="gw-clear-button" onPress={() => clearMut.mutate()} style={[styles.subBtn, { borderColor: colors.error }]}>
                <Text style={[styles.subText, { color: colors.error }]}>{t("gw_clear")}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 36, height: 44, alignItems: "flex-start", justifyContent: "center" },
  flex1: { flex: 1 },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  noteCard: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, padding: spacing.md },
  noteText: { flex: 1, color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18 },
  guideBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48 },
  guideText: { flex: 1, color: colors.onBrandTertiary, fontSize: font.sm, fontWeight: "800", letterSpacing: 0.5 },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, color: colors.onSurface, fontSize: font.base, fontFamily: mono, paddingHorizontal: spacing.md, height: 52 },
  saveBtn: { height: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  saveText: { color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "800", letterSpacing: 1 },
  rowBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  subBtn: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subText: { fontSize: font.sm, fontWeight: "800", letterSpacing: 0.5 },
}));
