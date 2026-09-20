import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, HistoryT } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { useT } from "@/src/settings";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

function fmt(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ICONS: Record<string, string> = {
  hunt: "target",
  ipinfo: "web",
  connect: "lan-connect",
};

export default function RiwayatScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const t = useT();
  const qc = useQueryClient();

  const historyQ = useQuery({
    queryKey: ["history"],
    queryFn: () => api<HistoryT[]>("/history"),
    refetchInterval: 8000,
  });

  const clearMut = useMutation({
    mutationFn: () => api("/history", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.show(t("history_cleared"), "info");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const bottomPad = usesNativeTabs ? insets.bottom + 16 : 16;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.flex1}>
          <Text style={styles.title}>{t("history_title")}</Text>
          <Text style={styles.subtitle}>{historyQ.data?.length ?? 0} {t("activities_logged")}</Text>
        </View>
        <Pressable testID="riwayat-clear-button" onPress={() => clearMut.mutate()} style={styles.iconBtn} hitSlop={8}>
          <Icon name="delete-outline" size={22} color={colors.error} />
        </Pressable>
      </View>

      <FlatList
        testID="history-list"
        data={historyQ.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 16 }]}
        refreshing={historyQ.isRefetching}
        onRefresh={() => historyQ.refetch()}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <View testID="history-empty" style={styles.empty}>
            <Icon name="history" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>{t("history_empty")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View testID={`history-row-${item.id}`} style={styles.row}>
            <View style={styles.iconWrap}>
              <Icon
                name={ICONS[item.kind] ?? "history"}
                size={20}
                color={item.kind === "hunt" ? colors.brandPrimary : colors.info}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              {item.subtitle ? (
                <Text style={styles.rowSub} numberOfLines={1}>{item.subtitle}</Text>
              ) : null}
            </View>
            <Text style={styles.time}>{fmt(item.ts)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  flex1: { flex: 1 },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: colors.onSurface, fontSize: font.base, fontWeight: "700" },
  rowSub: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: 2 },
  time: { color: colors.muted, fontSize: 11, fontFamily: mono },
  empty: { alignItems: "center", gap: spacing.md, paddingTop: 100, paddingHorizontal: spacing.xl },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: font.base, textAlign: "center" },
}));
