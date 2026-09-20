import Icon from "@react-native-vector-icons/material-design-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, AdminStatsT, GatewayStatusT } from "@/src/api";
import { SectionHeader } from "@/src/components/hud";
import { font, glow, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function AdminHome() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const statsQ = useQuery({ queryKey: ["admin-stats"], queryFn: () => api<AdminStatsT>("/admin/stats"), refetchInterval: 15000 });
  const s = statsQ.data;

  const gwQ = useQuery({ queryKey: ["admin-gateway-status"], queryFn: () => api<GatewayStatusT>("/admin/gateway-status"), refetchInterval: 20000 });
  const gw = gwQ.data;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="admin-back-button" onPress={() => router.replace("/beranda")} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>Panel Admin</Text>
          <Text style={styles.subtitle}>RIYANMEE PROXY Reseller</Text>
        </View>
        <Icon name="shield-crown" size={26} color={colors.brandPrimary} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Ringkasan" icon="chart-box" />
        {statsQ.isLoading ? (
          <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: 30 }} />
        ) : (
          <View style={styles.statsGrid}>
            <Stat icon="account-multiple" label="Total Pelanggan" value={String(s?.total_customers ?? 0)} styles={styles} colors={colors} accent={colors.info} />
            <Stat icon="account-check" label="Pelanggan Aktif" value={String(s?.active_customers ?? 0)} styles={styles} colors={colors} accent={colors.brandPrimary} />
            <Stat icon="clock-alert-outline" label="Pesanan Pending" value={String(s?.pending_orders ?? 0)} styles={styles} colors={colors} accent={s?.pending_orders ? colors.warning : colors.muted} />
            <Stat icon="cash-multiple" label="Total Pendapatan" value={s?.revenue_label ?? "Rp 0"} styles={styles} colors={colors} accent={colors.brandPrimary} />
          </View>
        )}

        <SectionHeader title="Status Gateway" icon="access-point-network" />
        <GatewayCard gw={gw} loading={gwQ.isLoading} styles={styles} colors={colors} />

        <SectionHeader title="Manajemen" icon="tune-variant" />
        <NavCard icon="receipt-text" title="Pesanan" sub="Konfirmasi pembayaran pelanggan" badge={s?.pending_orders} onPress={() => router.push("/admin/orders")} styles={styles} colors={colors} />
        <NavCard icon="account-group" title="Pelanggan" sub="Kelola akun, paket & kredensial" onPress={() => router.push("/admin/customers")} styles={styles} colors={colors} />
        <NavCard icon="package-variant" title="Paket" sub="Atur harga, durasi & kuota" onPress={() => router.push("/admin/packages")} styles={styles} colors={colors} />
        <NavCard icon="cog" title="Pengaturan" sub="Pembayaran, host proxy & upstream" onPress={() => router.push("/admin/settings")} styles={styles} colors={colors} />
      </ScrollView>
    </View>
  );
}

function Stat({ icon, label, value, styles, colors, accent }: any) {
  const c = accent ?? colors.onSurface;
  return (
    <View style={styles.statCard}>
      <View style={[styles.statTopBar, { backgroundColor: c }, glow(c, 8)]} />
      <View style={[styles.statIconBox, { borderColor: c }, glow(c, 5)]}>
        <Icon name={icon} size={18} color={c} />
      </View>
      <Text style={[styles.statValue, { color: c }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NavCard({ icon, title, sub, badge, onPress, styles, colors }: any) {
  return (
    <Pressable testID={`admin-nav-${title.toLowerCase()}`} onPress={onPress} style={styles.navCard}>
      <View style={[styles.navIconBox, { borderColor: colors.brandPrimary }, glow(colors.brandPrimary, 6)]}>
        <Icon name={icon} size={22} color={colors.brandPrimary} />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navSub}>{sub}</Text>
      </View>
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
      <Icon name="chevron-right" size={24} color={colors.muted} />
    </Pressable>
  );
}

function StatusPill({ online, styles, colors }: any) {
  const c = online ? colors.brandPrimary : colors.error;
  return (
    <View style={[styles.pill, { borderColor: c }, glow(c, 6)]}>
      <View style={[styles.pillDot, { backgroundColor: c }]} />
      <Text style={[styles.pillText, { color: c }]}>{online ? "ONLINE" : "OFFLINE"}</Text>
    </View>
  );
}

function GatewayCard({ gw, loading, styles, colors }: any) {
  if (loading) {
    return (
      <View style={styles.gwCard}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  const configured = gw?.configured;
  return (
    <View style={styles.gwCard}>
      <View style={styles.gwRow}>
        <View style={[styles.gwIconBox, { borderColor: colors.brandPrimary }, glow(colors.brandPrimary, 5)]}>
          <Icon name="server-network" size={18} color={colors.brandPrimary} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.gwTitle}>VPS Gateway</Text>
          <Text style={styles.gwMeta}>{configured ? `${gw.host}:${gw.port} · ${String(gw.protocol).toUpperCase()}` : "Belum diatur di Pengaturan"}</Text>
        </View>
        {configured ? <StatusPill online={gw.online} styles={styles} colors={colors} /> : (
          <View style={[styles.pill, { borderColor: colors.muted }]}><Text style={[styles.pillText, { color: colors.muted }]}>N/A</Text></View>
        )}
      </View>
      <View style={styles.gwDivider} />
      <View style={styles.gwRow}>
        <View style={[styles.gwIconBox, { borderColor: colors.info }, glow(colors.info, 5)]}>
          <Icon name="earth" size={18} color={colors.info} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.gwTitle}>Upstream Bright Data</Text>
          <Text style={styles.gwMeta}>{gw?.upstream ? `${gw.upstream.host}:${gw.upstream.port}` : "-"}</Text>
        </View>
        <StatusPill online={gw?.upstream?.online} styles={styles} colors={colors} />
      </View>
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
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, overflow: "hidden" },
  statTopBar: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  statIconBox: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  statValue: { fontSize: font.xxl, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: font.sm, marginTop: spacing.xs },
  navCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.md },
  navIconBox: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  navTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "700" },
  navSub: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  gwCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  gwRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  gwIconBox: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  gwTitle: { color: colors.onSurface, fontSize: font.base, fontWeight: "700" },
  gwMeta: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  gwDivider: { height: 1, backgroundColor: colors.divider },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.warning, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: colors.onWarning, fontSize: font.sm, fontWeight: "800" },
}));
