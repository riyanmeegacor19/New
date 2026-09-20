import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type PkgT = { id: string; name: string; days: number; price: number; price_label: string; bandwidth_gb: number; tier: string; popular: boolean; active: boolean; features: string[] };

export default function AdminPackages() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const pkgQ = useQuery({ queryKey: ["admin-packages"], queryFn: () => api<PkgT[]>("/admin/packages") });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<PkgT | null>(null);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const [price, setPrice] = useState("");
  const [bw, setBw] = useState("");
  const [popular, setPopular] = useState(false);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-packages"] }); qc.invalidateQueries({ queryKey: ["plans"] }); };

  const open = (p: PkgT | null) => {
    setEditing(p);
    setId(p?.id ?? ""); setName(p?.name ?? ""); setDays(p ? String(p.days) : ""); setPrice(p ? String(p.price) : ""); setBw(p ? String(p.bandwidth_gb) : ""); setPopular(p?.popular ?? false);
    setModal(true);
  };

  const buildBody = (): PkgT => {
    const priceNum = Number(price) || 0;
    return { id: (editing?.id || id).trim(), name: name.trim(), days: Number(days) || 0, price: priceNum, price_label: `Rp ${priceNum.toLocaleString("id-ID")}`, bandwidth_gb: Number(bw) || 0, tier: "RESELLER", popular, active: editing?.active ?? true, features: editing?.features ?? ["Residential Global", `${Number(bw) || 0} GB kuota`, "Pilih negara"] };
  };

  const saveMut = useMutation({
    mutationFn: () => editing ? api(`/admin/packages/${editing.id}`, { method: "PATCH", json: buildBody() }) : api("/admin/packages", { method: "POST", json: buildBody() }),
    onSuccess: () => { refresh(); setModal(false); toast.show("Paket disimpan", "success"); },
    onError: (e: Error) => toast.show(e.message, "error"),
  });
  const toggleMut = useMutation({
    mutationFn: (p: PkgT) => api(`/admin/packages/${p.id}`, { method: "PATCH", json: { ...p, active: !p.active } }),
    onSuccess: () => { refresh(); toast.show("Status paket diperbarui", "info"); },
    onError: (e: Error) => toast.show(e.message, "error"),
  });
  const delMut = useMutation({
    mutationFn: (pid: string) => api(`/admin/packages/${pid}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast.show("Paket dihapus", "info"); },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const packages = pkgQ.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="packages-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>Paket</Text>
          <Text style={styles.subtitle}>Harga, durasi & kuota</Text>
        </View>
        <Pressable testID="add-package-button" onPress={() => open(null)} style={styles.addBtn} hitSlop={8}>
          <Icon name="plus" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {pkgQ.isLoading ? (
          <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: 30 }} />
        ) : (
          packages.map((p) => (
            <View key={p.id} style={styles.card} testID={`package-${p.id}`}>
              <View style={styles.rowTop}>
                <View style={styles.flex1}>
                  <View style={styles.titleRow}>
                    <Text style={styles.pname}>{p.name}</Text>
                    {p.popular ? <View style={styles.popBadge}><Text style={styles.popText}>POPULER</Text></View> : null}
                  </View>
                  <Text style={styles.pmeta}>{p.days} hari · {p.bandwidth_gb} GB · {p.price_label}</Text>
                </View>
                <Pressable onPress={() => toggleMut.mutate(p)} testID={`toggle-pkg-${p.id}`} style={[styles.activeChip, { borderColor: p.active ? colors.brandPrimary : colors.muted, backgroundColor: p.active ? colors.brandTertiary : "transparent" }]}>
                  <Text style={[styles.activeText, { color: p.active ? colors.onBrandTertiary : colors.muted }]}>{p.active ? "AKTIF" : "NONAKTIF"}</Text>
                </Pressable>
              </View>
              <View style={styles.actions}>
                <Pressable testID={`edit-pkg-${p.id}`} onPress={() => open(p)} style={[styles.smallBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.smallText, { color: colors.onSurfaceSecondary }]}>EDIT</Text>
                </Pressable>
                <Pressable testID={`del-pkg-${p.id}`} onPress={() => delMut.mutate(p.id)} style={[styles.smallBtn, { borderColor: colors.error }]}>
                  <Text style={[styles.smallText, { color: colors.error }]}>HAPUS</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.sheetTitle}>{editing ? "Edit Paket" : "Paket Baru"}</Text>
            <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled">
              {!editing ? (<><Text style={styles.label}>ID (unik, cth: day14)</Text><TextInput testID="pkg-id" style={styles.input} autoCapitalize="none" value={id} onChangeText={setId} /></>) : null}
              <Text style={styles.label}>NAMA</Text>
              <TextInput testID="pkg-name" style={styles.input} value={name} onChangeText={setName} />
              <Text style={styles.label}>DURASI (hari)</Text>
              <TextInput testID="pkg-days" style={styles.input} keyboardType="number-pad" value={days} onChangeText={setDays} />
              <Text style={styles.label}>HARGA (Rp)</Text>
              <TextInput testID="pkg-price" style={styles.input} keyboardType="number-pad" value={price} onChangeText={setPrice} />
              <Text style={styles.label}>KUOTA (GB)</Text>
              <TextInput testID="pkg-bw" style={styles.input} keyboardType="number-pad" value={bw} onChangeText={setBw} />
              <Pressable onPress={() => setPopular((v) => !v)} style={styles.toggleRow}>
                <Icon name={popular ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={colors.brandPrimary} />
                <Text style={styles.toggleText}>Tandai sebagai POPULER</Text>
              </Pressable>
              <View style={styles.modalBtns}>
                <Pressable onPress={() => setModal(false)} style={[styles.mBtn, { borderColor: colors.divider, borderWidth: 1 }]}><Text style={[styles.smallText, { color: colors.onSurfaceSecondary }]}>BATAL</Text></Pressable>
                <Pressable testID="save-package-button" onPress={() => { if (!name.trim() || (!editing && !id.trim())) { toast.show("Isi ID & nama paket", "error"); return; } saveMut.mutate(); }} disabled={saveMut.isPending} style={[styles.mBtn, { backgroundColor: colors.brandPrimary }]}>
                  {saveMut.isPending ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Text style={[styles.smallText, { color: colors.onBrandPrimary }]}>SIMPAN</Text>}
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
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pname: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  popBadge: { backgroundColor: colors.brandPrimary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  popText: { color: colors.onBrandPrimary, fontSize: 9, fontWeight: "800" },
  pmeta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 3 },
  activeChip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  activeText: { fontSize: 10, fontWeight: "800" },
  actions: { flexDirection: "row", gap: spacing.sm },
  smallBtn: { flex: 1, borderWidth: 1, borderRadius: radius.sm, height: 40, alignItems: "center", justifyContent: "center" },
  smallText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, maxHeight: "85%" },
  sheetTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800", marginBottom: spacing.md },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, color: colors.onSurface, fontSize: font.base, paddingHorizontal: spacing.md, height: 50 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  toggleText: { color: colors.onSurfaceSecondary, fontSize: font.base, fontWeight: "600" },
  modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  mBtn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
}));
