import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CountryT, countryName, OrderT, PaymentInfoT, PlanT } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function fmtDate(v: string | null): string {
  if (!v) return "-";
  return new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<string, string> = { pending: "MENUNGGU KONFIRMASI", confirmed: "AKTIF", rejected: "DITOLAK" };

export default function BeliScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => api<PlanT[]>("/plans") });
  const countriesQ = useQuery({ queryKey: ["countries"], queryFn: () => api<CountryT[]>("/countries") });
  const payQ = useQuery({ queryKey: ["payment-info"], queryFn: () => api<{ payment_info: PaymentInfoT }>("/payment-info") });
  const ordersQ = useQuery({ queryKey: ["orders-mine"], queryFn: () => api<OrderT[]>("/orders/mine") });

  const plans = plansQ.data ?? [];
  const countries = countriesQ.data ?? [];
  const pay = payQ.data?.payment_info;
  const orders = ordersQ.data ?? [];
  const pending = orders.find((o) => o.status === "pending");

  const [pkgId, setPkgId] = useState("");
  const [country, setCountry] = useState("");

  const orderMut = useMutation({
    mutationFn: () => api<OrderT>("/orders", { method: "POST", json: { package_id: pkgId, country } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-mine"] });
      setPkgId("");
      toast.show("Pesanan dibuat. Silakan transfer & tunggu konfirmasi admin.", "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const copy = async (v: string, label: string) => {
    await Clipboard.setStringAsync(v);
    toast.show(`${label} disalin`, "success");
  };

  const selectedPlan = plans.find((p) => p.id === pkgId);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="beli-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>Beli Paket</Text>
          <Text style={styles.subtitle}>Pilih paket & negara, bayar manual</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {pending ? (
          <View style={[styles.card, { borderColor: colors.warning }]}>
            <Text style={[styles.cardLabel, { color: colors.warning }]}>PESANAN MENUNGGU KONFIRMASI</Text>
            <Text style={styles.pendingText}>{pending.package_name} · {countryName(pending.country, countries)} · {pending.price_label}</Text>
            <Text style={styles.pendingHint}>Transfer sesuai nominal ke rekening di bawah, lalu tunggu admin mengonfirmasi (1x24 jam).</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>1. Pilih Paket</Text>
        {plansQ.isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : (
          plans.map((p) => {
            const sel = p.id === pkgId;
            return (
              <Pressable key={p.id} testID={`plan-${p.id}`} onPress={() => setPkgId(p.id)} style={[styles.planCard, { borderColor: sel ? colors.borderStrong : colors.divider, backgroundColor: sel ? colors.brandTertiary : colors.surfaceSecondary }]}>
                <View style={styles.flex1}>
                  <View style={styles.planTitleRow}>
                    <Text style={styles.planName}>{p.name}</Text>
                    {p.popular ? <View style={styles.popBadge}><Text style={styles.popText}>POPULER</Text></View> : null}
                  </View>
                  <Text style={styles.planMeta}>{p.days} hari · {p.bandwidth_gb} GB · Residential Global</Text>
                </View>
                <View style={styles.planRight}>
                  <Text style={[styles.planPrice, { color: sel ? colors.onBrandTertiary : colors.brandPrimary }]}>{p.price_label}</Text>
                  <Icon name={sel ? "check-circle" : "circle-outline"} size={20} color={sel ? colors.brandPrimary : colors.muted} />
                </View>
              </Pressable>
            );
          })
        )}

        <Text style={styles.sectionTitle}>2. Pilih Negara Exit</Text>
        <View style={styles.countryWrap}>
          {countries.map((c) => {
            const sel = c.code === country;
            return (
              <Pressable key={c.code} testID={`country-${c.code}`} onPress={() => setCountry(c.code)} style={[styles.countryChip, { borderColor: sel ? colors.borderStrong : colors.divider, backgroundColor: sel ? colors.brandTertiary : "transparent" }]}>
                <Text style={[styles.countryText, { color: sel ? colors.onBrandTertiary : colors.muted }]}>{c.code} · {c.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          testID="beli-order-button"
          disabled={orderMut.isPending || !!pending}
          onPress={() => {
            if (!pkgId) { toast.show("Pilih paket dulu", "error"); return; }
            if (!country) { toast.show("Pilih negara dulu", "error"); return; }
            orderMut.mutate();
          }}
          style={[styles.orderBtn, { opacity: pending ? 0.5 : 1 }]}
        >
          {orderMut.isPending ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.orderText}>{pending ? "MENUNGGU KONFIRMASI" : `PESAN SEKARANG${selectedPlan ? ` · ${selectedPlan.price_label}` : ""}`}</Text>
          )}
        </Pressable>

        {pay ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>INFO PEMBAYARAN (TRANSFER MANUAL)</Text>
            <PayRow k="Bank" v={pay.bank_name} styles={styles} />
            <Pressable onPress={() => copy(pay.account_number, "No rekening")} style={styles.payRow} testID="copy-account">
              <Text style={styles.payKey}>No. Rekening</Text>
              <View style={styles.credValWrap}><Text style={styles.payValMono}>{pay.account_number}</Text><Icon name="content-copy" size={15} color={colors.muted} /></View>
            </Pressable>
            <PayRow k="Atas Nama" v={pay.account_holder} styles={styles} />
            {pay.ewallet ? <PayRow k="E-Wallet" v={pay.ewallet} styles={styles} /> : null}
            {pay.qris_note ? <Text style={styles.payNote}>{pay.qris_note}</Text> : null}
          </View>
        ) : null}

        {orders.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>RIWAYAT PESANAN</Text>
            {orders.map((o) => (
              <View key={o.id} style={styles.orderRow} testID={`order-${o.id}`}>
                <View style={styles.flex1}>
                  <Text style={styles.orderName}>{o.package_name} · {countryName(o.country, countries)}</Text>
                  <Text style={styles.orderMeta}>{o.price_label} · {fmtDate(o.created_at)}</Text>
                </View>
                <View style={[styles.statusChip, { borderColor: o.status === "confirmed" ? colors.brandPrimary : o.status === "rejected" ? colors.error : colors.warning }]}>
                  <Text style={[styles.statusText, { color: o.status === "confirmed" ? colors.brandPrimary : o.status === "rejected" ? colors.error : colors.warning }]}>{STATUS_LABEL[o.status]}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function PayRow({ k, v, styles }: any) {
  return (
    <View style={styles.payRow}>
      <Text style={styles.payKey}>{k}</Text>
      <Text style={styles.payVal}>{v}</Text>
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
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: font.base, fontWeight: "800", letterSpacing: 0.5, marginTop: spacing.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.xs },
  planCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  planName: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  popBadge: { backgroundColor: colors.brandPrimary, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  popText: { color: colors.onBrandPrimary, fontSize: 9, fontWeight: "800" },
  planMeta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 3 },
  planRight: { alignItems: "flex-end", gap: spacing.sm },
  planPrice: { fontSize: font.base, fontWeight: "800" },
  countryWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  countryChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  countryText: { fontSize: font.sm, fontWeight: "700" },
  orderBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  orderText: { color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "800", letterSpacing: 0.5 },
  payRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  payKey: { color: colors.muted, fontSize: font.sm, fontWeight: "700" },
  payVal: { color: colors.onSurface, fontSize: font.base, fontWeight: "600", flexShrink: 1, textAlign: "right", marginLeft: spacing.md },
  payValMono: { color: colors.onSurface, fontSize: font.base, fontFamily: mono, fontWeight: "700" },
  credValWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  payNote: { color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18, marginTop: spacing.sm },
  pendingText: { color: colors.onSurface, fontSize: font.base, fontWeight: "700", marginTop: spacing.xs },
  pendingHint: { color: colors.onSurfaceTertiary, fontSize: font.sm, lineHeight: 18, marginTop: spacing.xs },
  orderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  orderName: { color: colors.onSurface, fontSize: font.base, fontWeight: "600" },
  orderMeta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  statusChip: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
}));
