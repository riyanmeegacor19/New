import Icon from "@react-native-vector-icons/material-design-icons";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CountryT, countryName, ProxyAccountT } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function fmtDate(v: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ProxyScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const accountQ = useQuery({ queryKey: ["proxy-account"], queryFn: () => api<ProxyAccountT>("/proxy-account") });
  const countriesQ = useQuery({ queryKey: ["countries"], queryFn: () => api<CountryT[]>("/countries") });

  const acc = accountQ.data;
  const countries = countriesQ.data ?? [];

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    toast.show(`${label} disalin`, "success");
  };

  const usedGb = acc ? acc.bandwidth_used_mb / 1024 : 0;
  const limitGb = acc ? acc.bandwidth_limit_mb / 1024 : 0;
  const pct = limitGb > 0 ? Math.min(100, (usedGb / limitGb) * 100) : 0;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="proxy-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>Proxy Saya</Text>
          <Text style={styles.subtitle}>Kredensial & masa aktif proxy Anda</Text>
        </View>
        {acc?.configured ? (
          <View style={[styles.badge, { borderColor: acc.active ? colors.brandPrimary : colors.error, backgroundColor: acc.active ? colors.brandTertiary : "transparent" }]}>
            <View style={[styles.dot, { backgroundColor: acc.active ? colors.brandPrimary : colors.error }]} />
            <Text style={[styles.badgeText, { color: acc.active ? colors.onBrandTertiary : colors.error }]}>{acc.active ? "AKTIF" : "TIDAK AKTIF"}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {accountQ.isLoading ? (
          <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : !acc?.configured ? (
          <View style={styles.card}>
            <Icon name="shield-off-outline" size={40} color={colors.muted} style={{ alignSelf: "center" }} />
            <Text style={styles.emptyText}>Anda belum punya paket proxy aktif. Beli paket untuk mendapatkan kredensial.</Text>
            <Pressable testID="proxy-buy-button" onPress={() => router.push("/beli")} style={styles.primaryBtn}>
              <Text style={styles.primaryText}>BELI PAKET</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>KREDENSIAL PROXY ({acc.protocol.toUpperCase()})</Text>
              <CredRow k="Host" v={acc.host} onCopy={() => copy(acc.host, "Host")} styles={styles} colors={colors} />
              <CredRow k="Port" v={String(acc.port)} onCopy={() => copy(String(acc.port), "Port")} styles={styles} colors={colors} accent />
              <CredRow k="Username" v={acc.username} onCopy={() => copy(acc.username, "Username")} styles={styles} colors={colors} />
              <CredRow k="Password" v={acc.password} onCopy={() => copy(acc.password, "Password")} styles={styles} colors={colors} />
              <Pressable testID="proxy-copy-all" onPress={() => copy(`${acc.host}:${acc.port}:${acc.username}:${acc.password}`, "Kredensial lengkap")} style={styles.primaryBtn}>
                <Icon name="content-copy" size={16} color={colors.onBrandPrimary} />
                <Text style={styles.primaryText}>  SALIN SEMUA (host:port:user:pass)</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Negara Exit</Text>
                <Text style={styles.metaVal}>{countryName(acc.country, countries)} {acc.country ? `(${acc.country})` : ""}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Paket</Text>
                <Text style={styles.metaVal}>{acc.package_name || "-"}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Aktif s/d</Text>
                <Text style={styles.metaVal}>{fmtDate(acc.expires_at)}</Text>
              </View>
              <View style={styles.quotaWrap}>
                <Text style={styles.metaKey}>Kuota Bandwidth</Text>
                <Text style={styles.quotaText}>{usedGb.toFixed(2)} GB / {limitGb > 0 ? `${limitGb.toFixed(0)} GB` : "Tanpa batas"}</Text>
                {limitGb > 0 ? (
                  <View style={styles.quotaBar}>
                    <View style={[styles.quotaFill, { width: `${pct}%`, backgroundColor: pct > 90 ? colors.error : colors.brandPrimary }]} />
                  </View>
                ) : null}
              </View>
            </View>

            <Pressable testID="proxy-renew-button" onPress={() => router.push("/beli")} style={styles.linkCard}>
              <Icon name="autorenew" size={22} color={colors.warning} />
              <View style={styles.flex1}>
                <Text style={styles.linkTitle}>Perpanjang / Ganti Paket</Text>
                <Text style={styles.linkSub}>Tambah masa aktif atau ubah negara</Text>
              </View>
              <Icon name="chevron-right" size={24} color={colors.muted} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CredRow({ k, v, onCopy, styles, colors, accent }: any) {
  return (
    <Pressable onPress={onCopy} style={styles.credRow} testID={`proxy-cred-${k.toLowerCase()}`}>
      <Text style={styles.credKey}>{k}</Text>
      <View style={styles.credValWrap}>
        <Text style={[styles.credVal, accent ? { color: colors.brandPrimary, fontWeight: "800" } : null]} numberOfLines={1}>{v}</Text>
        <Icon name="content-copy" size={15} color={colors.muted} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 36, height: 44, alignItems: "flex-start", justifyContent: "center" },
  flex1: { flex: 1 },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.xs },
  credRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  credKey: { color: colors.muted, fontSize: font.sm, fontWeight: "700" },
  credValWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1, marginLeft: spacing.md },
  credVal: { color: colors.onSurface, fontSize: font.base, fontFamily: mono, flexShrink: 1, textAlign: "right" },
  primaryBtn: { flexDirection: "row", height: 50, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  primaryText: { color: colors.onBrandPrimary, fontSize: font.sm, fontWeight: "800", letterSpacing: 0.5 },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: font.base, textAlign: "center", marginVertical: spacing.md, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  metaKey: { color: colors.muted, fontSize: font.sm, fontWeight: "700" },
  metaVal: { color: colors.onSurface, fontSize: font.base, fontWeight: "600" },
  quotaWrap: { marginTop: spacing.sm, gap: spacing.sm },
  quotaText: { color: colors.onSurfaceSecondary, fontSize: font.sm, fontFamily: mono },
  quotaBar: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  quotaFill: { height: 8, borderRadius: 4 },
  linkCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg },
  linkTitle: { color: colors.onSurface, fontSize: font.lg, fontWeight: "700" },
  linkSub: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
}));
