import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { signUp } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (username.trim().length < 3) {
      toast.show("Username minimal 3 karakter", "error");
      return;
    }
    if (password.length < 6) {
      toast.show("Password minimal 6 karakter", "error");
      return;
    }
    if (password !== confirm) {
      toast.show("Konfirmasi password tidak cocok", "error");
      return;
    }
    setLoading(true);
    try {
      await signUp(username.trim(), password);
      toast.show("Pendaftaran berhasil", "success");
      router.replace("/beranda");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Pendaftaran gagal", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable testID="register-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.logoBox}>
            <Icon name="account-plus" size={36} color={colors.brandPrimary} />
          </View>
          <Text style={styles.title}>DAFTAR AKUN</Text>
          <Text style={styles.subtitle}>Buat akun RIYANMEE PROXY baru</Text>

          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            testID="register-username-input"
            style={styles.input}
            placeholder="Pilih username"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            testID="register-password-input"
            style={styles.input}
            placeholder="Min. 6 karakter"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
          <Text style={styles.label}>KONFIRMASI PASSWORD</Text>
          <TextInput
            testID="register-confirm-input"
            style={styles.input}
            placeholder="Ulangi password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            value={confirm}
            onChangeText={setConfirm}
          />

          <Pressable testID="register-submit-button" onPress={onRegister} disabled={loading} style={styles.btn}>
            {loading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.btnText}>DAFTAR SEKARANG</Text>
            )}
          </Pressable>

          <Pressable testID="go-login-button" onPress={() => router.replace("/login")} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              Sudah punya akun? <Text style={styles.loginLinkAccent}>Masuk</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  back: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { color: colors.onSurface, fontSize: font.base, fontWeight: "600" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
  },
  logoBox: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 2 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  label: {
    alignSelf: "flex-start",
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    width: "100%",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    color: colors.onSurface,
    fontSize: font.base,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  btn: {
    width: "100%",
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  btnText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "800", letterSpacing: 2 },
  loginLink: { marginTop: spacing.lg },
  loginLinkText: { color: colors.onSurfaceTertiary, fontSize: font.sm },
  loginLinkAccent: { color: colors.brandPrimary, fontWeight: "700" },
}));
