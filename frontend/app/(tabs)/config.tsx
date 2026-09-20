import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Icon from "@react-native-vector-icons/material-design-icons";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ConfigT, Protocol } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

type TestResult = { ok: boolean; ping_ms: number | null; banner: string; error: string } | null;

export default function ConfigScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    protocol: "ssh" as Protocol,
    host: "",
    port: "443",
    username: "",
    password: "",
    payload: "",
  });
  const [importCode, setImportCode] = useState("");
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [exportBlob, setExportBlob] = useState<string | null>(null);

  const configsQ = useQuery({
    queryKey: ["configs"],
    queryFn: () => api<ConfigT[]>("/configs"),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["configs"] });
    qc.invalidateQueries({ queryKey: ["logs"] });
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { ...form, port: parseInt(form.port, 10) || 443 };
      return editingId
        ? api<ConfigT>(`/configs/${editingId}`, { method: "PUT", json: body })
        : api<ConfigT>("/configs", { method: "POST", json: body });
    },
    onSuccess: () => {
      invalidate();
      toast.show(editingId ? "Config diperbarui" : "Config disimpan", "success");
      resetForm();
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const testMut = useMutation({
    mutationFn: () =>
      api<TestResult>("/configs/test", {
        method: "POST",
        json: {
          host: form.host.trim() || "one.one.one.one",
          port: parseInt(form.port, 10) || 443,
          protocol: form.protocol,
        },
      }),
    onSuccess: (res) => setTestResult(res),
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/configs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.show("Config dihapus", "info");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const exportMut = useMutation({
    mutationFn: (id: string) =>
      api<{ blob: string }>("/configs/export", { method: "POST", json: { config_id: id } }),
    onSuccess: (res) => setExportBlob(res.blob),
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const importMut = useMutation({
    mutationFn: () =>
      api<ConfigT>("/configs/import", { method: "POST", json: { blob: importCode.trim() } }),
    onSuccess: () => {
      invalidate();
      setImportCode("");
      toast.show("Config berhasil diimpor", "success");
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const resetForm = () => {
    setEditingId(null);
    setTestResult(null);
    setForm({ name: "", protocol: "ssh", host: "", port: "443", username: "", password: "", payload: "" });
  };

  const loadConfig = (c: ConfigT) => {
    setEditingId(c.id);
    setTestResult(null);
    setForm({
      name: c.name,
      protocol: c.protocol,
      host: c.host,
      port: String(c.port),
      username: c.username,
      password: c.password,
      payload: c.payload,
    });
  };

  const copyBlob = async () => {
    if (!exportBlob) return;
    await Clipboard.setStringAsync(exportBlob);
    toast.show("Kode config disalin", "success");
  };

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Config Tunnel</Text>

        {/* Saved configs */}
        <Text style={styles.sectionLabel}>CONFIG TERSIMPAN</Text>
        {configsQ.data?.length ? (
          <View style={styles.configList}>
            {configsQ.data.map((c) => (
              <View key={c.id} style={styles.configCard}>
                <Pressable testID={`config-load-${c.id}`} style={styles.flex1} onPress={() => loadConfig(c)}>
                  <Text style={styles.configName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.configMeta} numberOfLines={1}>
                    {c.protocol.toUpperCase()} · {c.host || "—"}:{c.port}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`config-export-${c.id}`}
                  onPress={() => exportMut.mutate(c.id)}
                  style={styles.miniBtn}
                  hitSlop={6}
                >
                  <Icon name="export" size={20} color={colors.info} />
                </Pressable>
                <Pressable
                  testID={`config-delete-${c.id}`}
                  onPress={() => deleteMut.mutate(c.id)}
                  style={styles.miniBtn}
                  hitSlop={6}
                >
                  <Icon name="trash-can-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text testID="configs-empty" style={styles.emptyText}>
            Tidak ada konfigurasi tersimpan. Buat config baru di bawah.
          </Text>
        )}

        {/* Editor */}
        <Text style={styles.sectionLabel}>{editingId ? "EDIT CONFIG" : "CONFIG BARU"}</Text>
        <View style={styles.card}>
          <View style={styles.segRow}>
            {(["ssh", "socks5", "http"] as Protocol[]).map((p) => {
              const selected = form.protocol === p;
              return (
                <Pressable
                  key={p}
                  testID={`config-proto-${p}`}
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

          <Text style={styles.fieldLabel}>NAMA CONFIG</Text>
          <TextInput
            testID="config-name-input"
            style={styles.input}
            placeholder="cth: Config Utama"
            placeholderTextColor={colors.muted}
            value={form.name}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
          />
          <View style={styles.rowGap}>
            <View style={styles.flex2}>
              <Text style={styles.fieldLabel}>HOST</Text>
              <TextInput
                testID="config-host-input"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="host.server.com"
                placeholderTextColor={colors.muted}
                value={form.host}
                onChangeText={(v) => setForm((f) => ({ ...f, host: v }))}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.fieldLabel}>PORT</Text>
              <TextInput
                testID="config-port-input"
                style={styles.input}
                keyboardType="number-pad"
                value={form.port}
                onChangeText={(v) => setForm((f) => ({ ...f, port: v.replace(/[^0-9]/g, "") }))}
              />
            </View>
          </View>
          <View style={styles.rowGap}>
            <View style={styles.flex1}>
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <TextInput
                testID="config-user-input"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                value={form.username}
                onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TextInput
                testID="config-pass-input"
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
              />
            </View>
          </View>
          <Text style={styles.fieldLabel}>PAYLOAD (OPSIONAL)</Text>
          <TextInput
            testID="config-payload-input"
            style={[styles.input, styles.payloadInput]}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
            placeholder={"GET http://contoh.com/ HTTP/1.1\nHost: contoh.com"}
            placeholderTextColor={colors.muted}
            value={form.payload}
            onChangeText={(v) => setForm((f) => ({ ...f, payload: v }))}
          />

          <View style={styles.buttonRow}>
            <Pressable
              testID="config-test-btn"
              onPress={() => testMut.mutate()}
              style={[styles.actionBtn, { borderColor: colors.border }]}
              disabled={testMut.isPending}
            >
              {testMut.isPending ? (
                <ActivityIndicator size="small" color={colors.onBrandTertiary} />
              ) : (
                <Text style={[styles.actionBtnText, { color: colors.onBrandTertiary }]}>TES KONEKSI</Text>
              )}
            </Pressable>
            <Pressable
              testID="config-save-btn"
              onPress={() => {
                if (!form.name.trim()) {
                  toast.show("Nama config wajib diisi", "error");
                  return;
                }
                saveMut.mutate();
              }}
              style={[styles.actionBtn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? (
                <ActivityIndicator size="small" color={colors.onBrandPrimary} />
              ) : (
                <Text style={[styles.actionBtnText, { color: colors.onBrandPrimary }]}>
                  {editingId ? "PERBARUI" : "SIMPAN"}
                </Text>
              )}
            </Pressable>
          </View>

          {editingId ? (
            <Pressable testID="config-cancel-edit-btn" onPress={resetForm} style={styles.cancelEdit}>
              <Text style={styles.cancelEditText}>Batal edit, buat config baru</Text>
            </Pressable>
          ) : null}

          {testResult ? (
            <View testID="config-test-result" style={styles.testResult}>
              {testResult.ok ? (
                <>
                  <Icon name="check-circle" size={18} color={colors.success} />
                  <Text style={[styles.testResultText, { color: colors.success }]}>
                    OK · {testResult.ping_ms} ms
                    {testResult.banner ? ` · ${testResult.banner}` : ""}
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="alert-circle" size={18} color={colors.error} />
                  <Text style={[styles.testResultText, { color: colors.error }]}>{testResult.error}</Text>
                </>
              )}
            </View>
          ) : null}
        </View>

        {/* Import */}
        <Text style={styles.sectionLabel}>IMPOR CONFIG</Text>
        <View style={styles.card}>
          <Text style={styles.hintText}>
            Tempel kode config RIYANMEE (atau dari teman) lalu ketuk Impor.
          </Text>
          <TextInput
            testID="config-import-input"
            style={[styles.input, styles.payloadInput]}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
            placeholder="RIYANMEE::eyJ..."
            placeholderTextColor={colors.muted}
            value={importCode}
            onChangeText={setImportCode}
          />
          <Pressable
            testID="config-import-btn"
            onPress={() => {
              if (!importCode.trim()) {
                toast.show("Tempel kode config dulu", "error");
                return;
              }
              importMut.mutate();
            }}
            style={[styles.actionBtnFull, { backgroundColor: colors.brandTertiary, borderColor: colors.border }]}
            disabled={importMut.isPending}
          >
            {importMut.isPending ? (
              <ActivityIndicator size="small" color={colors.onBrandTertiary} />
            ) : (
              <Text style={[styles.actionBtnText, { color: colors.onBrandTertiary }]}>IMPOR</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAwareScrollView>

      {/* Export modal */}
      <Modal visible={exportBlob !== null} transparent animationType="fade" onRequestClose={() => setExportBlob(null)}>
        <View style={styles.exportBackdrop}>
          <View style={styles.exportCard}>
            <Text style={styles.sheetTitle}>Kode Ekspor Config</Text>
            <Text style={styles.hintText}>Bagikan kode ini untuk dipakai di perangkat lain.</Text>
            <ScrollView style={styles.exportScroll}>
              <TextInput
                testID="config-export-blob"
                style={[styles.input, styles.payloadInput]}
                multiline
                editable={false}
                value={exportBlob ?? ""}
              />
            </ScrollView>
            <View style={styles.buttonRow}>
              <Pressable
                testID="config-export-copy-btn"
                onPress={copyBlob}
                style={[styles.actionBtn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
              >
                <Text style={[styles.actionBtnText, { color: colors.onBrandPrimary }]}>SALIN</Text>
              </Pressable>
              <Pressable
                testID="config-export-close-btn"
                onPress={() => setExportBlob(null)}
                style={[styles.actionBtn, { borderColor: colors.divider }]}
              >
                <Text style={[styles.actionBtnText, { color: colors.onSurfaceSecondary }]}>TUTUP</Text>
              </Pressable>
            </View>
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
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.onSurface,
    fontSize: font.xl,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  configList: {
    gap: spacing.sm,
  },
  configCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  configName: {
    color: colors.onSurface,
    fontSize: font.base,
    fontWeight: "700",
  },
  configMeta: {
    color: colors.onSurfaceTertiary,
    fontSize: font.sm,
    fontFamily: mono,
    marginTop: 2,
  },
  miniBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.onSurfaceTertiary,
    fontSize: font.sm,
    paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.lg,
    padding: spacing.lg,
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
    paddingVertical: spacing.md,
    minHeight: 46,
  },
  payloadInput: {
    minHeight: 96,
    fontFamily: mono,
    fontSize: font.sm,
  },
  rowGap: {
    flexDirection: "row",
    gap: spacing.md,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnFull: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  actionBtnText: {
    fontSize: font.base,
    fontWeight: "800",
    letterSpacing: 1,
  },
  cancelEdit: {
    alignItems: "center",
    padding: spacing.md,
  },
  cancelEditText: {
    color: colors.muted,
    fontSize: font.sm,
  },
  testResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  testResultText: {
    flex: 1,
    fontSize: font.sm,
    fontFamily: mono,
  },
  hintText: {
    color: colors.onSurfaceTertiary,
    fontSize: font.sm,
    marginBottom: spacing.sm,
  },
  exportBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  exportCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  exportScroll: {
    maxHeight: 200,
  },
  sheetTitle: {
    color: colors.onSurface,
    fontSize: font.lg,
    fontWeight: "800",
    marginBottom: spacing.xs,
  },
}));
