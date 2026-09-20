import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CountryT, countryName, OrderT } from "@/src/api";
import { Segmented } from "@/src/components/segmented";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

function fmtDate(v: string | null): string {
  if (!v) return "-";
  return new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminOrders() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [filter, setFilter] = useState("pending");
  const ordersQ = useQuery({ queryKey: ["admin-orders", filter], queryFn: () => api<OrderT[]>(`/admin/orders?status=${filter}`) });
  const countriesQ = useQuery({ queryKey: ["countries"], queryFn: () => api<CountryT[]>("/countries") });
  const countries = countriesQ.data ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const confirmMut = useMutation({
    mutationFn: (id: string) => api<OrderT>(`/admin/orders/${id}/confirm`, { method: "POST" }),
    onSuccess: () => { invalidate(); toast.show("Pesanan dikonfirmasi & pelanggan diaktifkan", "success"); },
    onError: (e: Error) => toast.show(e.message, "error"),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => api<OrderT>(`/admin/orders/${id}/reject`, { method: "POST" }),
    onSuccess: () => { invalidate(); toast.show("Pesanan ditolak", "info"); },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const orders = ordersQ.data ?? [];

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="orders-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>Pesanan</Text>
          <Text style={styles.subtitle}>Konfirmasi pembayaran manual</Text>
        </View>
      </View>

      <View style={styles.filterWrap}>
        <Segmented testIdPrefix="order-filter" value={filter} onChange={setFilter} options={[{ value: "pending", label: "PENDING" }, { value: "confirmed", label: "AKTIF" }, { value: "rejected", label: "DITOLAK" }]} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {ordersQ.isLoading ? (
          <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: 30 }} />
        ) : orders.length === 0 ? (
          <Text style={styles.empty}>Tidak ada pesanan.</Text>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={styles.card} testID={`admin-order-${o.id}`}>
              <View style={styles.rowTop}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{o.username.charAt(0).toUpperCase()}</Text></View>
                <View style={styles.flex1}>
                  <Text style={styles.uname}>{o.username}</Text>
                  <Text style={styles.meta}>{o.package_name} · {countryName(o.country, countries)} · {o.days} hari</Text>
                  <Text style={styles.meta}>{o.price_label} · {fmtDate(o.created_at)}</Text>
                </View>
              </View>
              {o.status === "pending" ? (
                <View style={styles.actions}>
                  <Pressable testID={`confirm-${o.id}`} onPress={() => confirmMut.mutate(o.id)} disabled={confirmMut.isPending} style={[styles.btn, { backgroundColor: colors.brandPrimary }]}>
                    <Text style={[styles.btnText, { color: colors.onBrandPrimary }]}>KONFIRMASI</Text>
                  </Pressable>
                  <Pressable testID={`reject-${o.id}`} onPress={() => rejectMut.mutate(o.id)} disabled={rejectMut.isPending} style={[styles.btn, { borderWidth: 1, borderColor: colors.error }]}>
                    <Text style={[styles.btnText, { color: colors.error }]}>TOLAK</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={[styles.statusChip, { borderColor: o.status === "confirmed" ? colors.brandPrimary : colors.error }]}>
                  <Text style={[styles.statusText, { color: o.status === "confirmed" ? colors.brandPrimary : colors.error }]}>{o.status === "confirmed" ? "AKTIF" : "DITOLAK"}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
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
  filterWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40, fontSize: font.base },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  rowTop: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "800" },
  uname: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  meta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.md },
  btn: { flex: 1, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: font.sm, fontWeight: "800", letterSpacing: 0.5 },
  statusChip: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: "800" },
}));
