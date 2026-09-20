import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, SettingsT } from "@/src/api";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, mono, radius, spacing, useTheme } from "@/src/theme";

export default function AdminSettings() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const settingsQ = useQuery({ queryKey: ["admin-settings"], queryFn: () => api<SettingsT>("/admin/settings") });

  const [bank, setBank] = useState("");
  const [acc, setAcc] = useState("");
  const [holder, setHolder] = useState("");
  const [ewallet, setEwallet] = useState("");
  const [note, setNote] = useState("");
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [upHost, setUpHost] = useState("");
  const [upPort, setUpPort] = useState("");
  const [upZone, setUpZone] = useState("");
  const [upUser, setUpUser] = useState("");
  const [upPass, setUpPass] = useState("");

  useEffect(() => {
    const s = settingsQ.data;
    if (!s) return;
    setBank(s.payment_info.bank_name); setAcc(s.payment_info.account_number); setHolder(s.payment_info.account_holder);
    setEwallet(s.payment_info.ewallet); setNote(s.payment_info.qris_note);
    setProxyHost(s.proxy_host); setProxyPort(String(s.proxy_port));
    setUpHost(s.upstream.host); setUpPort(String(s.upstream.port)); setUpZone(s.upstream.zone);
    setUpUser(s.upstream.username); setUpPass(s.upstream.password);
  }, [settingsQ.data]);

  const saveMut = useMutation({
    mutationFn: () => api<SettingsT>("/admin/settings", { method: "PUT", json: {
      payment_info: { bank_name: bank, account_number: acc, account_holder: holder, ewallet, qris_note: note },
      proxy_host: proxyHost.trim(), proxy_port: Number(proxyPort) || 0,
      upstream: { provider: "brightdata", host: upHost.trim(), port: Number(upPort) || 0, zone: upZone.trim(), username: upUser.trim(), password: upPass },
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-settings"] }); qc.invalidateQueries({ queryKey: ["payment-info"] }); toast.show("Pengaturan disimpan", "success"); },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  const countries = settingsQ.data?.countries ?? [];

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="settings-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>Pengaturan</Text>
          <Text style={styles.subtitle}>Pembayaran, host proxy & upstream</Text>
        </View>
      </View>

      {settingsQ.isLoading ? (
        <ActivityIndicator size="large" color={colors.brandPrimary} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>INFO PEMBAYARAN</Text>
            <Field label="Nama Bank" value={bank} onChange={setBank} styles={styles} colors={colors} tid="set-bank" />
            <Field label="No. Rekening" value={acc} onChange={setAcc} styles={styles} colors={colors} tid="set-account" keyboard="number-pad" />
            <Field label="Atas Nama" value={holder} onChange={setHolder} styles={styles} colors={colors} tid="set-holder" />
            <Field label="E-Wallet (opsional)" value={ewallet} onChange={setEwallet} styles={styles} colors={colors} tid="set-ewallet" />
            <Field label="Catatan Pembayaran" value={note} onChange={setNote} styles={styles} colors={colors} tid="set-note" multiline />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>HOST PROXY (yang diberikan ke pelanggan)</Text>
            <Field label="Proxy Host" value={proxyHost} onChange={setProxyHost} styles={styles} colors={colors} tid="set-proxyhost" />
            <Field label="Proxy Port" value={proxyPort} onChange={setProxyPort} styles={styles} colors={colors} tid="set-proxyport" keyboard="number-pad" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>UPSTREAM POOL (BRIGHT DATA · Fase 2)</Text>
            <Text style={styles.hint}>Kredensial ini dipakai saat otomatisasi routing diaktifkan. Aman dikosongkan dulu.</Text>
            <Field label="Host" value={upHost} onChange={setUpHost} styles={styles} colors={colors} tid="set-uphost" />
            <Field label="Port" value={upPort} onChange={setUpPort} styles={styles} colors={colors} tid="set-upport" keyboard="number-pad" />
            <Field label="Zone" value={upZone} onChange={setUpZone} styles={styles} colors={colors} tid="set-upzone" />
            <Field label="Username" value={upUser} onChange={setUpUser} styles={styles} colors={colors} tid="set-upuser" />
            <Field label="Password" value={upPass} onChange={setUpPass} styles={styles} colors={colors} tid="set-uppass" secure />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>NEGARA TERSEDIA ({countries.length})</Text>
            <View style={styles.chipWrap}>
              {countries.map((c) => (
                <View key={c.code} style={styles.chip}><Text style={styles.chipText}>{c.code} · {c.name}</Text></View>
              ))}
            </View>
          </View>

          <Pressable testID="save-settings-button" onPress={() => saveMut.mutate()} disabled={saveMut.isPending} style={styles.saveBtn}>
            {saveMut.isPending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveText}>SIMPAN PENGATURAN</Text>}
          </Pressable>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

function Field({ label, value, onChange, styles, colors, tid, keyboard, secure, multiline }: any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={tid}
        style={[styles.input, multiline ? { height: 76, textAlignVertical: "top", paddingTop: spacing.md } : null]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard || "default"}
        secureTextEntry={!!secure}
        multiline={!!multiline}
        autoCapitalize="none"
        placeholderTextColor={colors.muted}
      />
    </>
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
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  hint: { color: colors.onSurfaceTertiary, fontSize: font.sm, marginTop: spacing.sm, lineHeight: 18 },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, color: colors.onSurface, fontSize: font.base, fontFamily: mono, paddingHorizontal: spacing.md, height: 50 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  chip: { borderWidth: 1, borderColor: colors.divider, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { color: colors.onSurfaceSecondary, fontSize: font.sm, fontWeight: "700" },
  saveBtn: { height: 54, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  saveText: { color: colors.onBrandPrimary, fontSize: font.base, fontWeight: "800", letterSpacing: 0.5 },
}));
