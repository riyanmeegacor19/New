import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CountryT, countryName, PlanT, UserT } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function fmtDate(v: string | null): string {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminCustomers() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const custQ = useQuery({ queryKey: ["admin-customers"], queryFn: () => api<UserT[]>("/admin/customers") });
  const countriesQ = useQuery({ queryKey: ["countries"], queryFn: () => api<CountryT[]>("/countries") });
  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => api<PlanT[]>("/plans") });
  const countries = countriesQ.data ?? [];
  const plans = plansQ.data ?? [];

  const [modal, setModal] = useState(false);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [country, setCountry] = useState("");
  const [pkg, setPkg] = useState("");

  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-customers"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); };

  const createMut = useMutation({
    mutationFn: () => api<UserT>("/admin/customers", { method: "POST", json: { username: u, password: p, country, package_id: pkg } }),
    onSuccess: () => { refresh(); setModal(false); setU(""); setP(""); setCountry(""); setPkg(""); toast.show("Pelanggan dibuat", "success"); },
    onError: (e: Error) => toast.show(e.message, "error"),
  });
  const patchMut = useMutation({
    mutationFn: (v: { id: string; body: any }) => api<UserT>(`/admin/customers/${v.id}`, { method: "PATCH", json: v.body }),
    onSuccess: () => { refresh(); toast.show("Diperbarui", "success"); },
    onError: (e: Error) => toast.show(e.message, "error"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/admin/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast.show("Pelanggan dihapus", "info"); },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const customers = custQ.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="customers-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>Pelanggan</Text>
          <Text style={styles.subtitle}>{customers.length} akun</Text>
        </View>
        <Pressable testID="add-customer-button" onPress={() => setModal(true)} style={styles.addBtn} hitSlop={8}>
          <Icon name="plus" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {custQ.isLoading ? (
          <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: 30 }} />
        ) : customers.length === 0 ? (
          <Text style={styles.empty}>Belum ada pelanggan. Tekan + untuk menambah.</Text>
        ) : (
          customers.map((c) => {
            const active = c.status === "active";
            return (
              <View key={c.id} style={styles.card} testID={`customer-${c.username}`}>
                <View style={styles.rowTop}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{c.username.charAt(0).toUpperCase()}</Text></View>
                  <View style={styles.flex1}>
                    <Text style={styles.uname}>{c.username}</Text>
                    <Text style={styles.meta}>{c.package_name || "Tanpa paket"} · {countryName(c.country, countries)}</Text>
                    <Text style={styles.meta}>Aktif s/d {fmtDate(c.expires_at)}</Text>
                  </View>
                  <View style={[styles.statusChip, { borderColor: active ? colors.brandPrimary : colors.error }]}>
                    <Text style={[styles.statusText, { color: active ? colors.brandPrimary : colors.error }]}>{active ? "AKTIF" : (c.status || "").toUpperCase()}</Text>
                  </View>
                </View>
                <Pressable onPress={() => { Clipboard.setStringAsync(c.username); toast.show("Username disalin", "success"); }} style={styles.credBox} testID={`copy-cred-${c.username}`}>
                  <Text style={styles.credText}>user: {c.username} · pass: {c.proxy_password}</Text>
                  <Icon name="content-copy" size={14} color={colors.muted} />
                </Pressable>
                <View style={styles.actionsWrap}>
                  <Pressable testID={`toggle-${c.username}`} onPress={() => patchMut.mutate({ id: c.id, body: { status: active ? "suspended" : "active" } })} style={[styles.smallBtn, { borderColor: active ? colors.error : colors.brandPrimary }]}>
                    <Text style={[styles.smallText, { color: active ? colors.error : colors.brandPrimary }]}>{active ? "SUSPEND" : "AKTIFKAN"}</Text>
                  </Pressable>
                  <Pressable testID={`adddays-${c.username}`} onPress={() => patchMut.mutate({ id: c.id, body: { add_days: 30 } })} style={[styles.smallBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.smallText, { color: colors.onSurfaceSecondary }]}>+30 HARI</Text>
                  </Pressable>
                  <Pressable testID={`regen-${c.username}`} onPress={() => patchMut.mutate({ id: c.id, body: { regenerate_proxy_password: true } })} style={[styles.smallBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.smallText, { color: colors.onSurfaceSecondary }]}>RESET PASS</Text>
                  </Pressable>
                  <Pressable testID={`del-${c.username}`} onPress={() => delMut.mutate(c.id)} style={[styles.smallBtn, { borderColor: colors.error }]}>
                    <Icon name="trash-can-outline" size={16} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.sheetTitle}>Tambah Pelanggan</Text>
            <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>USERNAME</Text>
              <TextInput testID="new-username" style={styles.input} autoCapitalize="none" value={u} onChangeText={setU} placeholder="cth: budi01" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput testID="new-password" style={styles.input} autoCapitalize="none" value={p} onChangeText={setP} placeholder="min 6 karakter" placeholderTextColor={colors.muted} />
              <Text style={styles.label}>NEGARA</Text>
              <View style={styles.chipWrap}>
                {countries.map((c) => (
                  <Pressable key={c.code} onPress={() => setCountry(c.code)} style={[styles.chip, { borderColor: c.code === country ? colors.borderStrong : colors.divider, backgroundColor: c.code === country ? colors.brandTertiary : "transparent" }]}>
                    <Text style={[styles.chipText, { color: c.code === country ? colors.onBrandTertiary : colors.muted }]}>{c.code}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>PAKET (opsional)</Text>
              <View style={styles.chipWrap}>
                {plans.map((pl) => (
                  <Pressable key={pl.id} onPress={() => setPkg(pl.id === pkg ? "" : pl.id)} style={[styles.chip, { borderColor: pl.id === pkg ? colors.borderStrong : colors.divider, backgroundColor: pl.id === pkg ? colors.brandTertiary : "transparent" }]}>
                    <Text style={[styles.chipText, { color: pl.id === pkg ? colors.onBrandTertiary : colors.muted }]}>{pl.name}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.modalBtns}>
                <Pressable onPress={() => setModal(false)} style={[styles.mBtn, { borderColor: colors.divider, borderWidth: 1 }]}>
                  <Text style={[styles.smallText, { color: colors.onSurfaceSecondary }]}>BATAL</Text>
                </Pressable>
                <Pressable testID="save-customer-button" onPress={() => { if (u.length < 3 || p.length < 6) { toast.show("Username min 3 & password min 6 karakter", "error"); return; } createMut.mutate(); }} disabled={createMut.isPending} style={[styles.mBtn, { backgroundColor: colors.brandPrimary }]}>
                  {createMut.isPending ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Text style={[styles.smallText, { color: colors.onBrandPrimary }]}>SIMPAN</Text>}
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
  back: { width: 36, height: 44, alignItems: "flex-start", justifyContent: "center" },
  flex1: { flex: 1 },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40, fontSize: font.base },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  rowTop: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandSecondary, fontSize: font.lg, fontWeight: "800" },
  uname: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  meta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  statusChip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 9, fontWeight: "800" },
  credBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  credText: { color: colors.onSurfaceSecondary, fontSize: font.sm, fontFamily: mono, flexShrink: 1 },
  actionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  smallBtn: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, height: 38, alignItems: "center", justifyContent: "center" },
  smallText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, maxHeight: "85%" },
  sheetTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.md },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, color: colors.onSurface, fontSize: font.base, paddingHorizontal: spacing.md, height: 50 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { fontSize: font.sm, fontWeight: "700" },
  modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  mBtn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
}));
