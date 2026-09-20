import Icon from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { useT } from "@/src/settings";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const { signUp } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (username.trim().length < 3) {
      toast.show(t("username_min3"), "error");
      return;
    }
    if (password.length < 6) {
      toast.show(t("password_min6"), "error");
      return;
    }
    if (password !== confirm) {
      toast.show(t("confirm_mismatch"), "error");
      return;
    }
    setLoading(true);
    try {
      await signUp(username.trim(), password);
      toast.show(t("register_ok"), "success");
      router.replace("/beranda");
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : t("register_failed"), "error");
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
          <Text style={styles.backText}>{t("back")}</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.logoBox}>
            <Icon name="account-plus" size={36} color={colors.brandPrimary} />
          </View>
          <Text style={styles.title}>{t("register_title")}</Text>
          <Text style={styles.subtitle}>{t("register_sub")}</Text>

          <Text style={styles.label}>{t("username")}</Text>
          <TextInput
            testID="register-username-input"
            style={styles.input}
            placeholder={t("choose_username")}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <Text style={styles.label}>{t("password")}</Text>
          <TextInput
            testID="register-password-input"
            style={styles.input}
            placeholder={t("min6")}
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />
          <Text style={styles.label}>{t("confirm_password")}</Text>
          <TextInput
            testID="register-confirm-input"
            style={styles.input}
            placeholder={t("repeat_password")}
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
              <Text style={styles.btnText}>{t("register_submit")}</Text>
            )}
          </Pressable>

          <Pressable testID="go-login-button" onPress={() => router.replace("/login")} style={styles.loginLink}>
            <Text style={styles.loginLinkText}>
              {t("have_account")}<Text style={styles.loginLinkAccent}>{t("sign_in")}</Text>
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
