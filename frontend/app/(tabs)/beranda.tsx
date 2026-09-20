import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fetchSession, ServerT, SessionT, ToolHistoryT } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function fmtDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export default function BerandaScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sessionQ = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    refetchInterval: 5000,
  });
  const historyQ = useQuery({
    queryKey: ["tools"],
    queryFn: () => api<ToolHistoryT[]>("/tools/history"),
    refetchInterval: 15000,
  });

  const session: SessionT | undefined = sessionQ.data?.session;
  const server: ServerT | undefined = sessionQ.data?.server;
  const state = session?.state ?? "disconnected";

  const lastSpeed = historyQ.data?.find((h) => h.kind === "speed")?.data as
    | { mbps: number }
    | undefined;

  const connectedSeconds =
    state === "connected" && session?.connected_at
      ? Math.max(0, Math.floor((tick - new Date(session.connected_at).getTime()) / 1000))
      : 0;

  const pulse = useRef(new Animated.Value(0)).current;
  const active = state !== "disconnected";
  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const connectMut = useMutation({
    mutationFn: (serverId: string) =>
      api<SessionT>("/session/connect", { method: "POST", json: { server_id: serverId } }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: ["logs"] });
      toast.show(
        s.error ? `Koneksi gagal: ${s.error}` : `Terhubung ke ${s.server_name}`,
        s.error ? "error" : "success",
      );
    },
    onError: (e: Error) => {
      qc.invalidateQueries({ queryKey: ["session"] });
      toast.show(e.message, "error");
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => api<SessionT>("/session/disconnect", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: ["logs"] });
      toast.show("Tunnel diputus", "info");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const doConnect = () => {
    if (state === "connected") {
      disconnectMut.mutate();
      return;
    }
    if (!session?.server_id) {
      toast.show("Pilih server dulu di tab Server", "error");
      return;
    }
    connectMut.mutate(session.server_id);
  };

  const statusText =
    state === "connected" ? "TERHUBUNG" : state === "connecting" ? "MENGHUBUNGKAN..." : "TERPUTUS";
  const statusColor =
    state === "connected" ? colors.brandPrimary : state === "connecting" ? colors.warning : colors.error;

  const bottomPad = usesNativeTabs ? insets.bottom + 24 : 24;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: bottomPad + 56 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.flex1}>
            <Text style={styles.brandTitle}>RIYANMEE PROXY</Text>
            <View style={styles.statusRow}>
              <View testID="session-status-dot" style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text testID="session-status" style={[styles.statusText, { color: statusColor }]}>
                {statusText}
              </Text>
            </View>
          </View>
          <Pressable
            testID="tools-link"
            onPress={() => router.push("/tools")}
            style={styles.iconButton}
            hitSlop={8}
          >
            <Icon name="speedometer" size={22} color={colors.onSurfaceSecondary} />
          </Pressable>
        </View>

        {/* Connect ring */}
        <View style={styles.ringZone}>
          {active ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseRing,
                {
                  transform: [
                    { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) },
                  ],
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                  borderColor: statusColor,
                },
              ]}
            />
          ) : null}
          <Pressable
            testID="connect-button"
            onPress={doConnect}
            style={[
              styles.connectCircle,
              { borderColor: active ? statusColor : colors.border },
            ]}
          >
            <Icon
              name="power"
              size={52}
              color={active ? statusColor : colors.onSurfaceTertiary}
            />
            <Text style={[styles.connectLabel, { color: active ? statusColor : colors.onSurfaceTertiary }]}>
              {state === "connected" ? "PUTUSKAN" : "HUBUNGKAN"}
            </Text>
          </Pressable>
          <Text testID="timer-text" style={styles.timer}>
            {state === "connected" ? fmtDuration(connectedSeconds) : "00:00:00"}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View testID="stat-ping" style={styles.statCard}>
            <Text style={styles.statLabel}>PING</Text>
            <Text style={styles.statValue}>
              {session?.ping_ms != null ? `${session.ping_ms}` : "—"}
              {session?.ping_ms != null ? <Text style={styles.statUnit}> ms</Text> : null}
            </Text>
          </View>
          <View testID="stat-speed" style={styles.statCard}>
            <Text style={styles.statLabel}>UNDUH</Text>
            <Text style={styles.statValue}>
              {lastSpeed ? `${lastSpeed.mbps}` : "—"}
              {lastSpeed ? <Text style={styles.statUnit}> Mbps</Text> : null}
            </Text>
          </View>
          <View testID="stat-time" style={styles.statCard}>
            <Text style={styles.statLabel}>WAKTU</Text>
            <Text style={styles.statValue}>
              {state === "connected" ? fmtDuration(connectedSeconds) : "—"}
            </Text>
          </View>
        </View>

        {/* Selected server card */}
        <Pressable
          testID="selected-server-card"
          style={({ pressed }) => [styles.serverCard, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/server")}
        >
          <View style={styles.flex1}>
            <Text style={styles.serverCardLabel}>SERVER AKTIF</Text>
            <Text style={styles.serverCardName}>
              {server ? server.name : "Belum ada server dipilih"}
            </Text>
            <Text style={styles.serverCardMeta}>
              {server ? `${server.host}:${server.port} · ${server.protocol.toUpperCase()}` : "Pilih server dari daftar untuk mulai tunneling"}
            </Text>
          </View>
          <View testID="change-server-btn" style={styles.changeBadge}>
            <Text style={styles.changeText}>GANTI</Text>
          </View>
        </Pressable>

        {/* Tools card */}
        <Pressable
          testID="tools-card"
          style={({ pressed }) => [styles.serverCard, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/tools")}
        >
          <View style={styles.flex1}>
            <Text style={styles.serverCardLabel}>ALAT JARINGAN</Text>
            <Text style={styles.serverCardName}>Tes Kecepatan & Cek IP</Text>
            <Text style={styles.serverCardMeta}>Uji performa tunnel dan periksa penyamaran IP</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.muted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  flex1: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  brandTitle: {
    color: colors.onSurface,
    fontSize: font.xl,
    fontWeight: "800",
    letterSpacing: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: font.sm,
    fontWeight: "700",
    letterSpacing: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  ringZone: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  pulseRing: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 2,
  },
  connectCircle: {
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 2,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  connectLabel: {
    fontSize: font.base,
    fontWeight: "800",
    letterSpacing: 2,
  },
  timer: {
    marginTop: spacing.lg,
    color: colors.onSurface,
    fontSize: font.xxl,
    fontFamily: mono,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  statValue: {
    color: colors.onSurface,
    fontSize: font.lg,
    fontFamily: mono,
    fontWeight: "700",
  },
  statUnit: {
    fontSize: font.sm,
  },
  serverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  serverCardLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  serverCardName: {
    color: colors.onSurface,
    fontSize: font.lg,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  serverCardMeta: {
    color: colors.onSurfaceTertiary,
    fontSize: font.sm,
    marginTop: spacing.xs,
  },
  changeBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  changeText: {
    color: colors.onBrandTertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
}));
