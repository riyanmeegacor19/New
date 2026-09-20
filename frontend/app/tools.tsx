import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, IpCheckT, SpeedT, ToolHistoryT } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function fmtClock(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ToolsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const historyQ = useQuery({
    queryKey: ["tools"],
    queryFn: () => api<ToolHistoryT[]>("/tools/history"),
  });

  const lastIp = historyQ.data?.find((h) => h.kind === "ip")?.data as IpCheckT | undefined;
  const lastSpeed = historyQ.data?.find((h) => h.kind === "speed")?.data as SpeedT | undefined;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tools"] });

  const ipMut = useMutation({
    mutationFn: () => api<IpCheckT>("/tools/ip-check", { method: "POST" }),
    onSuccess: () => {
      invalidate();
      toast.show("Pemeriksaan IP selesai", "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const speedMut = useMutation({
    mutationFn: () => api<SpeedT>("/tools/speedtest", { method: "POST" }),
    onSuccess: () => {
      invalidate();
      toast.show("Tes kecepatan selesai", "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="tools-back-btn" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Alat Jaringan</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* IP checker */}
        <View testID="ip-check-card" style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="web" size={20} color={colors.info} />
            <Text style={styles.cardTitle}>CEK IP</Text>
          </View>
          {lastIp ? (
            <View style={styles.ipBlock}>
              <Text style={styles.ipLabel}>IP PUBLIK ANDA</Text>
              <Text testID="ip-direct" style={styles.ipValue}>
                {lastIp.direct_ip || "—"}
              </Text>
              <Text style={styles.ipMeta}>
                {[lastIp.direct_country, lastIp.direct_isp].filter(Boolean).join(" · ") || "—"}
              </Text>
              {lastIp.proxy_ip ? (
                <View style={styles.ipProxyBlock}>
                  <Text style={styles.ipLabel}>MELALUI SERVER · {lastIp.proxy_server}</Text>
                  <Text testID="ip-via-proxy" style={[styles.ipValue, { color: colors.brandPrimary }]}>
                    {lastIp.proxy_ip}
                  </Text>
                  <Text style={styles.ipMeta}>
                    {[lastIp.proxy_country, lastIp.proxy_isp].filter(Boolean).join(" · ") || "—"}
                  </Text>
                  <View
                    testID="ip-spoofed-badge"
                    style={[
                      styles.spoofBadge,
                      {
                        backgroundColor: lastIp.spoofed ? colors.brandTertiary : colors.surfaceTertiary,
                        borderColor: lastIp.spoofed ? colors.borderStrong : colors.divider,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.spoofText,
                        { color: lastIp.spoofed ? colors.onBrandTertiary : colors.muted },
                      ]}
                    >
                      {lastIp.spoofed ? "IP TERSAMAR" : "IP TIDAK TERSAMAR"}
                    </Text>
                  </View>
                </View>
              ) : lastIp.proxy_error ? (
                <Text testID="ip-proxy-error" style={styles.errorText}>
                  {lastIp.proxy_error}
                </Text>
              ) : lastIp.note ? (
                <Text style={styles.noteText}>{lastIp.note}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.noteText}>
              Ketuk 'Periksa Sekarang' untuk melihat IP publik dan status penyamaran.
            </Text>
          )}
          <Pressable
            testID="ip-check-btn"
            onPress={() => ipMut.mutate()}
            style={[styles.bigBtn, { backgroundColor: colors.brandTertiary, borderColor: colors.border }]}
            disabled={ipMut.isPending}
          >
            {ipMut.isPending ? (
              <ActivityIndicator size="small" color={colors.onBrandTertiary} />
            ) : (
              <Text style={[styles.bigBtnText, { color: colors.onBrandTertiary }]}>PERIKSA SEKARANG</Text>
            )}
          </Pressable>
        </View>

        {/* Speed test */}
        <View testID="speedtest-card" style={styles.card}>
          <View style={styles.cardHeader}>
            <Icon name="speedometer" size={20} color={colors.brandPrimary} />
            <Text style={styles.cardTitle}>TES KECEPATAN</Text>
          </View>
          <View style={styles.speedBlock}>
            <Text testID="speed-value" style={styles.speedValue}>
              {lastSpeed ? lastSpeed.mbps.toFixed(2) : "—"}
            </Text>
            <Text style={styles.speedUnit}>Mbps</Text>
          </View>
          <Text style={styles.noteText}>
            {lastSpeed
              ? `${lastSpeed.via_proxy ? `Via server ${lastSpeed.server_name}` : "Koneksi langsung"} · ${lastSpeed.seconds} detik`
              : "Ketuk 'Mulai Tes' untuk mengukur kecepatan unduh jaringan."}
          </Text>
          <Pressable
            testID="speedtest-btn"
            onPress={() => speedMut.mutate()}
            style={[styles.bigBtn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
            disabled={speedMut.isPending}
          >
            {speedMut.isPending ? (
              <View style={styles.speedLoadingRow}>
                <ActivityIndicator size="small" color={colors.onBrandPrimary} />
                <Text style={[styles.bigBtnText, { color: colors.onBrandPrimary }]}>MENGUNDUH...</Text>
              </View>
            ) : (
              <Text style={[styles.bigBtnText, { color: colors.onBrandPrimary }]}>MULAI TES</Text>
            )}
          </Pressable>
        </View>

        {/* History */}
        <Text style={styles.sectionLabel}>RIWAYAT TES</Text>
        {historyQ.data?.length ? (
          historyQ.data.slice(0, 8).map((h) => (
            <View key={h.id} testID={`history-row-${h.id}`} style={styles.historyRow}>
              <Icon
                name={h.kind === "speed" ? "speedometer" : "web"}
                size={18}
                color={h.kind === "speed" ? colors.brandPrimary : colors.info}
              />
              <Text style={styles.historyLabel}>
                {h.kind === "speed"
                  ? `Speed test · ${(h.data as SpeedT).mbps} Mbps`
                  : `Cek IP · ${(h.data as IpCheckT).direct_ip}`}
              </Text>
              <Text style={styles.historyTime}>{fmtClock(h.ts)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noteText}>Belum ada riwayat tes.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.onSurface,
    fontSize: font.xl,
    fontWeight: "800",
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.onSurface,
    fontSize: font.base,
    fontWeight: "800",
    letterSpacing: 2,
  },
  ipBlock: {
    gap: spacing.xs,
  },
  ipProxyBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.xs,
  },
  ipLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  ipValue: {
    color: colors.onSurface,
    fontSize: font.xxl,
    fontFamily: mono,
    fontWeight: "700",
  },
  ipMeta: {
    color: colors.onSurfaceTertiary,
    fontSize: font.sm,
  },
  spoofBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },
  spoofText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  errorText: {
    color: colors.error,
    fontSize: font.sm,
  },
  noteText: {
    color: colors.onSurfaceTertiary,
    fontSize: font.sm,
  },
  speedBlock: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  speedValue: {
    color: colors.brandPrimary,
    fontSize: 40,
    fontFamily: mono,
    fontWeight: "700",
  },
  speedUnit: {
    color: colors.muted,
    fontSize: font.lg,
  },
  speedLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bigBtn: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bigBtnText: {
    fontSize: font.base,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  historyLabel: {
    flex: 1,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
  },
  historyTime: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: mono,
  },
}));
