import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Icon from "@react-native-vector-icons/material-design-icons";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, LogT } from "@/src/api";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function fmtClock(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function LogScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const logsQ = useQuery({
    queryKey: ["logs"],
    queryFn: () => api<LogT[]>("/logs?limit=300"),
    refetchInterval: 3000,
  });

  const clearMut = useMutation({
    mutationFn: () => api("/logs", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logs"] });
    },
  });

  const levelColor = (level: string) =>
    level === "success"
      ? colors.brandPrimary
      : level === "error"
        ? colors.error
        : level === "warn"
          ? colors.warning
          : colors.onSurfaceSecondary;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.flex1}>
            <Text style={styles.title}>Log Koneksi</Text>
            <Text testID="log-count" style={styles.subtitle}>
              BUFFER {logsQ.data?.length ?? 0} · LIVE
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View testID="log-live-badge" style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <Pressable
              testID="log-clear-btn"
              onPress={() => clearMut.mutate()}
              style={styles.iconButton}
              hitSlop={8}
            >
              <Icon name="delete-outline" size={22} color={colors.error} />
            </Pressable>
          </View>
        </View>
      </View>

      <FlatList
        testID="logs-list"
        data={logsQ.data ?? []}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        ListEmptyComponent={
          <View testID="logs-empty" style={styles.empty}>
            <Icon name="console" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>
              Belum ada log aktivitas. Hubungkan tunnel untuk melihat log koneksi.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View testID={`log-row-${item.id}`} style={styles.logRow}>
            <Text style={[styles.logText, { color: colors.onSurfaceTertiary }]}>
              [{fmtClock(item.ts)}]
            </Text>
            <Text style={[styles.logText, { color: levelColor(item.level) }]}>
              {" "}[{item.level.toUpperCase()}]
            </Text>
            <Text style={[styles.logText, { color: colors.onSurfaceSecondary }]}>
              {item.tag}: {item.message}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  title: {
    color: colors.onSurface,
    fontSize: font.xl,
    fontWeight: "800",
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: mono,
    letterSpacing: 1,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brandPrimary,
  },
  liveText: {
    color: colors.onBrandTertiary,
    fontSize: 10,
    fontWeight: "800",
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
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  logRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 4,
  },
  logText: {
    fontSize: 12,
    fontFamily: mono,
    lineHeight: 18,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingTop: 120,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    color: colors.onSurfaceTertiary,
    fontSize: font.base,
    textAlign: "center",
  },
}));
