import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, MyProxyT } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { useT } from "@/src/settings";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

const PROTOS = ["socks5", "http", "https", "ssh"];

export default function ServersScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const qc = useQueryClient();

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ label: "", host: "", port: "1080", protocol: "socks5", username: "", password: "" });

  const proxiesQ = useQuery({ queryKey: ["proxies"], queryFn: () => api<MyProxyT[]>("/proxies") });

  const createMut = useMutation({
    mutationFn: () => api<MyProxyT>("/proxies", { method: "POST", json: { ...form, port: parseInt(form.port, 10) || 1080 } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proxies"] });
      setModal(false);
      setForm({ label: "", host: "", port: "1080", protocol: "socks5", username: "", password: "" });
      toast.show(t("server_added"), "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/proxies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proxies"] });
      toast.show(t("server_removed"), "info");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="servers-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>{t("servers_title")}</Text>
          <Text style={styles.subtitle}>{t("servers_sub")}</Text>
        </View>
        <Pressable testID="add-server-button" onPress={() => setModal(true)} style={styles.addBtn} hitSlop={8}>
          <Icon name="plus" size={24} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {proxiesQ.data?.length ? (
          proxiesQ.data.map((p) => (
            <View key={p.id} testID={`server-item-${p.id}`} style={styles.card}>
              <View style={styles.protoDot}>
                <Icon name="server" size={20} color={colors.brandPrimary} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.cardLabel}>{p.label}</Text>
                <Text style={styles.cardMeta}>{p.host}:{p.port} · {p.protocol.toUpperCase()}</Text>
              </View>
              <Pressable testID={`server-delete-${p.id}`} onPress={() => deleteMut.mutate(p.id)} hitSlop={8} style={styles.trash}>
                <Icon name="trash-can-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          ))
        ) : (
          <View testID="servers-empty" style={styles.empty}>
            <Icon name="server-off" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>{t("servers_empty")}</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.sheetTitle}>{t("add_server")}</Text>
            <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>{t("label")}</Text>
              <TextInput testID="proxy-label-input" style={styles.input} placeholder="VPS Hetzner SG" placeholderTextColor={colors.muted} value={form.label} onChangeText={(v) => setForm((f) => ({ ...f, label: v }))} />
              <Text style={styles.fieldLabel}>{t("host")}</Text>
              <TextInput testID="proxy-host-input" style={styles.input} autoCapitalize="none" autoCorrect={false} placeholder="103.150.10.20" placeholderTextColor={colors.muted} value={form.host} onChangeText={(v) => setForm((f) => ({ ...f, host: v }))} />
              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>{t("port")}</Text>
                  <TextInput testID="proxy-port-input" style={styles.input} keyboardType="number-pad" value={form.port} onChangeText={(v) => setForm((f) => ({ ...f, port: v.replace(/[^0-9]/g, "") }))} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>{t("protocol")}</Text>
                  <View style={styles.protoRow}>
                    {PROTOS.map((p) => {
                      const sel = form.protocol === p;
                      return (
                        <Pressable key={p} testID={`proxy-proto-${p}`} onPress={() => setForm((f) => ({ ...f, protocol: p }))} style={[styles.protoChip, { borderColor: sel ? colors.borderStrong : colors.divider, backgroundColor: sel ? colors.brandTertiary : "transparent" }]}>
                          <Text style={[styles.protoChipText, { color: sel ? colors.onBrandTertiary : colors.muted }]}>{p.toUpperCase()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>{t("username")}</Text>
                  <TextInput testID="proxy-user-input" style={styles.input} autoCapitalize="none" autoCorrect={false} value={form.username} onChangeText={(v) => setForm((f) => ({ ...f, username: v }))} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>{t("password")}</Text>
                  <TextInput testID="proxy-pass-input" style={styles.input} secureTextEntry autoCapitalize="none" value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} />
                </View>
              </View>
              <View style={styles.btnRow}>
                <Pressable testID="proxy-cancel-button" onPress={() => setModal(false)} style={[styles.btn, { borderColor: colors.divider }]}>
                  <Text style={[styles.btnText, { color: colors.onSurfaceSecondary }]}>{t("cancel")}</Text>
                </Pressable>
                <Pressable
                  testID="proxy-save-button"
                  onPress={() => {
                    if (!form.label.trim() || !form.host.trim()) {
                      toast.show(t("fill_label_host"), "error");
                      return;
                    }
                    createMut.mutate();
                  }}
                  style={[styles.btn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                  disabled={createMut.isPending}
                >
                  {createMut.isPending ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Text style={[styles.btnText, { color: colors.onBrandPrimary }]}>{t("save")}</Text>}
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
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 40, height: 44, alignItems: "flex-start", justifyContent: "center" },
  flex1: { flex: 1 },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg },
  protoDot: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  cardLabel: { color: colors.onSurface, fontSize: font.lg, fontWeight: "700" },
  cardMeta: { color: colors.onSurfaceTertiary, fontSize: font.sm, fontFamily: mono, marginTop: 2 },
  trash: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: spacing.md, paddingTop: 100, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: font.base, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, maxHeight: "88%" },
  sheetTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.md },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, color: colors.onSurface, fontSize: font.base, paddingHorizontal: spacing.md, height: 48 },
  row: { flexDirection: "row", gap: spacing.md },
  protoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  protoChip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 8, flexShrink: 0 },
  protoChipText: { fontSize: 10, fontWeight: "800" },
  btnRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  btn: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: font.base, fontWeight: "800", letterSpacing: 1 },
}));
