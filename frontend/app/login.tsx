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

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { signIn } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const onLogin = async () => {
    if (!username.trim() || !password) {
      toast.show("Isi username dan password", "error");
      return;
    }
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      router.replace("/beranda");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Login gagal", "error");
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
          { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.logoBox}>
            <Icon name="shield-lock" size={40} color={colors.brandPrimary} />
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.brand}>RIYANMEE </Text>
            <Text style={styles.brandAccent}>PROXY</Text>
          </View>
          <Text style={styles.subtitle}>HUNTER ENGINE ACCESS</Text>

          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            testID="login-username-input"
            style={styles.input}
            placeholder="Username"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />

          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.passWrap}>
            <TextInput
              testID="login-password-input"
              style={styles.passInput}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPass((s) => !s)} hitSlop={8} testID="login-toggle-pass">
              <Icon name={showPass ? "eye-off" : "eye"} size={20} color={colors.muted} />
            </Pressable>
          </View>

          <Pressable
            testID="login-submit-button"
            onPress={onLogin}
            disabled={loading}
            style={styles.loginBtn}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <View style={styles.loginRow}>
                <Text style={styles.loginText}>LOGIN</Text>
                <Icon name="arrow-right" size={20} color={colors.onBrandPrimary} />
              </View>
            )}
          </Pressable>

          <Pressable testID="go-register-button" onPress={() => router.push("/register")} style={styles.registerLink}>
            <Text style={styles.registerText}>
              Belum punya akun? <Text style={styles.registerTextAccent}>Daftar sekarang</Text>
            </Text>
          </Pressable>

          <Text style={styles.encrypted}>SYSTEM SECURELY ENCRYPTED</Text>
        </View>

        <View style={styles.demoHint}>
          <Icon name="information-outline" size={16} color={colors.muted} />
          <Text style={styles.demoText}>Akun demo — user: idmee · pass: riyanmee123</Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
  },
  logoBox: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  titleRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: colors.onSurface, fontSize: 26, fontWeight: "800", letterSpacing: 4 },
  brandAccent: { color: colors.brandPrimary, fontSize: 26, fontWeight: "800", letterSpacing: 4 },
  subtitle: {
    color: colors.muted,
    fontSize: font.sm,
    letterSpacing: 3,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
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
  passWrap: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  passInput: { flex: 1, color: colors.onSurface, fontSize: font.base, padding: 0 },
  loginBtn: {
    width: "100%",
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
    shadowColor: colors.brandPrimary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  loginRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  loginText: { color: colors.onBrandPrimary, fontSize: font.lg, fontWeight: "800", letterSpacing: 3 },
  registerLink: { marginTop: spacing.lg },
  registerText: { color: colors.onSurfaceTertiary, fontSize: font.sm },
  registerTextAccent: { color: colors.brandPrimary, fontWeight: "700" },
  encrypted: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: spacing.xl,
  },
  demoHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "center",
  },
  demoText: { color: colors.muted, fontSize: font.sm },
}));
