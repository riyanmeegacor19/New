import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Icon from "@react-native-vector-icons/material-design-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  api,
  pingColor,
  Protocol,
  ServerT,
  SessionResp,
} from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

const FILTERS: { value: "all" | Protocol; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "ssh", label: "SSH" },
  { value: "socks5", label: "SOCKS5" },
  { value: "http", label: "HTTP" },
];

export default function ServerScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Protocol>("all");
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    host: "",
    port: "443",
    protocol: "ssh" as Protocol,
    location: "",
    username: "",
    password: "",
  });

  const serversQ = useQuery({
    queryKey: ["servers"],
    queryFn: () => api<ServerT[]>("/servers"),
    refetchInterval: 30000,
  });
  const sessionQ = useQuery({
    queryKey: ["session"],
    queryFn: () => api<SessionResp>("/session"),
    refetchInterval: 5000,
  });

  const session = sessionQ.data?.session;

  const filtered = useMemo(() => {
    let list = serversQ.data ?? [];
    if (filter !== "all") list = list.filter((s) => s.protocol === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        `${s.name} ${s.host} ${s.location}`.toLowerCase().includes(q),
      );
    }
    return list;
  }, [serversQ.data, filter, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["servers"] });
    qc.invalidateQueries({ queryKey: ["session"] });
    qc.invalidateQueries({ queryKey: ["logs"] });
  };

  const pingAllMut = useMutation({
    mutationFn: () => api<ServerT[]>("/servers/ping-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["servers"] });
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const selectMut = useMutation({
    mutationFn: (id: string) =>
      api<ServerT>("/session/select", { method: "POST", json: { server_id: id } }),
    onSuccess: () => {
      invalidate();
      toast.show("Server dipilih", "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/servers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.show("Server dihapus", "info");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api<ServerT>("/servers", {
        method: "POST",
        json: { ...form, port: parseInt(form.port, 10) || 443 },
      }),
    onSuccess: () => {
      invalidate();
      setModalOpen(false);
      setForm({ name: "", host: "", port: "443", protocol: "ssh", location: "", username: "", password: "" });
      toast.show("Server ditambahkan", "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const onSubmit = () => {
    if (!form.name.trim() || !form.host.trim()) {
      toast.show("Nama dan host wajib diisi", "error");
      return;
    }
    createMut.mutate();
  };

  const fabBottom = usesNativeTabs ? insets.bottom + 16 : 16;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Server</Text>
          <Pressable
            testID="ping-all-btn"
            onPress={() => pingAllMut.mutate()}
            style={styles.iconButton}
            hitSlop={8}
          >
            {pingAllMut.isPending ? (
              <ActivityIndicator size="small" color={colors.brandPrimary} />
            ) : (
              <Icon name="radar" size={22} color={colors.onSurfaceSecondary} />
            )}
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Icon name="magnify" size={20} color={colors.muted} />
          <TextInput
            testID="server-search-input"
            style={styles.searchInput}
            placeholder="Cari server, host, lokasi..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTERS.map((f) => {
            const selected = filter === f.value;
            return (
              <Pressable
                key={f.value}
                testID={`server-filter-${f.value}`}
                onPress={() => setFilter(f.value)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.borderStrong : colors.divider,
                    backgroundColor: selected ? colors.brandTertiary : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? colors.onBrandTertiary : colors.muted },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        testID="servers-list"
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: fabBottom + 72 },
        ]}
        refreshing={serversQ.isRefetching}
        onRefresh={() => serversQ.refetch()}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.empty} testID="servers-empty">
            <Icon name="server-network" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>
              {serversQ.isLoading
                ? "Memindai server dan ping..."
                : "Belum ada server. Ketuk tombol + untuk menambah server baru."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = session?.server_id === item.id;
          const pingC = pingColor(item.last_ping_ms, item.last_status, colors);
          return (
            <Pressable
              testID={`server-card-${item.id}`}
              onPress={() => selectMut.mutate(item.id)}
              style={[
                styles.card,
                { borderColor: isActive ? colors.borderStrong : colors.divider },
              ]}
            >
              <View style={styles.cardTop}>
                <View
                  testID={`server-status-${item.id}`}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        item.last_status === "online"
                          ? colors.brandPrimary
                          : item.last_status === "offline"
                            ? colors.error
                            : colors.muted,
                    },
                  ]}
                />
                <View style={styles.flex1}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.location || item.host} · {item.host}:{item.port}
                  </Text>
                </View>
                <View style={[styles.protoBadge, { borderColor: colors.border }]}>
                  <Text style={styles.protoText}>{item.protocol.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text testID={`server-ping-${item.id}`} style={[styles.pingText, { color: pingC }]}>
                  {item.last_status === "offline" || item.last_ping_ms == null
                    ? item.last_status === "offline"
                      ? "OFFLINE"
                      : "PING —"
                    : `PING ${item.last_ping_ms} ms`}
                </Text>
                <View style={styles.cardActions}>
                  {isActive ? (
                    <View style={[styles.activeBadge, { backgroundColor: colors.brandTertiary }]}>
                      <Text style={[styles.activeText, { color: colors.onBrandTertiary }]}>
                        {session?.state === "connected" ? "AKTIF" : "DIPILIH"}
                      </Text>
                    </View>
                  ) : null}
                  <Pressable
                    testID={`server-delete-${item.id}`}
                    onPress={() => deleteMut.mutate(item.id)}
                    style={styles.trashBtn}
                    hitSlop={8}
                  >
                    <Icon name="trash-can-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        testID="add-server-fab"
        onPress={() => setModalOpen(true)}
        style={[styles.fab, { bottom: fabBottom }]}
      >
        <Icon name="plus" size={26} color={colors.onBrandPrimary} />
      </Pressable>

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.sheetTitle}>Tambah Server Baru</Text>
            <KeyboardAwareScrollView bottomOffset={32} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>NAMA SERVER</Text>
              <TextInput
                testID="server-name-input"
                style={styles.input}
                placeholder="cth: VPS Hetzner Ashburn"
                placeholderTextColor={colors.muted}
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <Text style={styles.fieldLabel}>HOST</Text>
              <TextInput
                testID="server-host-input"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="cth: 103.150.10.20 atau host.domain.com"
                placeholderTextColor={colors.muted}
                value={form.host}
                onChangeText={(v) => setForm((f) => ({ ...f, host: v }))}
              />
              <View style={styles.rowGap}>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>PORT</Text>
                  <TextInput
                    testID="server-port-input"
                    style={styles.input}
                    keyboardType="number-pad"
                    value={form.port}
                    onChangeText={(v) => setForm((f) => ({ ...f, port: v.replace(/[^0-9]/g, "") }))}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>LOKASI</Text>
                  <TextInput
                    testID="server-location-input"
                    style={styles.input}
                    placeholder="cth: Jerman"
                    placeholderTextColor={colors.muted}
                    value={form.location}
                    onChangeText={(v) => setForm((f) => ({ ...f, location: v }))}
                  />
                </View>
              </View>
              <Text style={styles.fieldLabel}>PROTOKOL</Text>
              <View style={styles.segRow}>
                {(["ssh", "socks5", "http"] as Protocol[]).map((p) => {
                  const selected = form.protocol === p;
                  return (
                    <Pressable
                      key={p}
                      testID={`server-proto-${p}`}
                      onPress={() => setForm((f) => ({ ...f, protocol: p }))}
                      style={[
                        styles.seg,
                        {
                          borderColor: selected ? colors.borderStrong : colors.divider,
                          backgroundColor: selected ? colors.brandTertiary : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segText,
                          { color: selected ? colors.onBrandTertiary : colors.muted },
                        ]}
                      >
                        {p.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.rowGap}>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>USERNAME (OPSIONAL)</Text>
                  <TextInput
                    testID="server-user-input"
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={form.username}
                    onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.fieldLabel}>PASSWORD (OPSIONAL)</Text>
                  <TextInput
                    testID="server-pass-input"
                    style={styles.input}
                    secureTextEntry
                    autoCapitalize="none"
                    value={form.password}
                    onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                  />
                </View>
              </View>
              <View style={styles.sheetActions}>
                <Pressable
                  testID="add-server-cancel-btn"
                  onPress={() => setModalOpen(false)}
                  style={[styles.sheetBtn, { borderColor: colors.divider }]}
                >
                  <Text style={[styles.sheetBtnText, { color: colors.onSurfaceSecondary }]}>
                    BATAL
                  </Text>
                </Pressable>
                <Pressable
                  testID="add-server-save-btn"
                  onPress={onSubmit}
                  style={[styles.sheetBtn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                  disabled={createMut.isPending}
                >
                  {createMut.isPending ? (
                    <ActivityIndicator size="small" color={colors.onBrandPrimary} />
                  ) : (
                    <Text style={[styles.sheetBtnText, { color: colors.onBrandPrimary }]}>
                      SIMPAN
                    </Text>
                  )}
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
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.onSurface,
    fontSize: font.xl,
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.onSurface,
    fontSize: font.base,
    padding: 0,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  empty: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 64,
  },
  emptyText: {
    color: colors.onSurfaceTertiary,
    fontSize: font.base,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  flex1: {
    flex: 1,
  },
  cardName: {
    color: colors.onSurface,
    fontSize: font.lg,
    fontWeight: "700",
  },
  cardMeta: {
    color: colors.onSurfaceTertiary,
    fontSize: font.sm,
    fontFamily: mono,
    marginTop: 2,
  },
  protoBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  protoText: {
    color: colors.onBrandTertiary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pingText: {
    fontSize: font.sm,
    fontFamily: mono,
    fontWeight: "700",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  activeBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  trashBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandPrimary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: "92%",
  },
  sheetTitle: {
    color: colors.onSurface,
    fontSize: font.lg,
    fontWeight: "800",
    marginBottom: spacing.md,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    color: colors.onSurface,
    fontSize: font.base,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  rowGap: {
    flexDirection: "row",
    gap: spacing.md,
  },
  segRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  seg: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sheetActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  sheetBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnText: {
    fontSize: font.base,
    fontWeight: "800",
    letterSpacing: 1,
  },
}));
