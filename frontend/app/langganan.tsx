import Icon from "@react-native-vector-icons/material-design-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PlanT, UserT } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { useT } from "@/src/settings";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function LanggananScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const qc = useQueryClient();
  const { setUser } = useAuth();

  const plansQ = useQuery({ queryKey: ["plans"], queryFn: () => api<PlanT[]>("/plans") });

  const activateMut = useMutation({
    mutationFn: (planId: string) => api<UserT>("/subscription/activate", { method: "POST", json: { plan_id: planId } }),
    onSuccess: (u) => {
      qc.setQueryData(["profile"], u);
      setUser(u);
      toast.show(t("activated"), "success");
      router.back();
    },
    onError: (e: Error) => toast.show(e.message, "error"),
  });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="plans-back-button" onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={styles.flex1}>
          <Text style={styles.title}>{t("plans_title")}</Text>
          <Text style={styles.subtitle}>{t("plans_sub")}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.note}>
          <Icon name="information-outline" size={16} color={colors.warning} />
          <Text style={styles.noteText}>{t("buy_note")}</Text>
        </View>

        {plansQ.isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : (
          plansQ.data?.map((plan) => (
            <View
              key={plan.id}
              testID={`plan-card-${plan.id}`}
              style={[styles.card, plan.popular && { borderColor: colors.borderStrong }]}
            >
              {plan.popular ? (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>{t("popular")}</Text>
                </View>
              ) : null}
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{plan.price_label}</Text>
                <Text style={styles.days}>· {plan.days} hari</Text>
              </View>
              <View style={styles.features}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Icon name="check-circle" size={16} color={colors.brandPrimary} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
              <Pressable
                testID={`plan-activate-${plan.id}`}
                onPress={() => activateMut.mutate(plan.id)}
                style={[styles.activateBtn, plan.popular ? { backgroundColor: colors.brandPrimary } : { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border }]}
                disabled={activateMut.isPending}
              >
                {activateMut.isPending && activateMut.variables === plan.id ? (
                  <ActivityIndicator size="small" color={plan.popular ? colors.onBrandPrimary : colors.brandPrimary} />
                ) : (
                  <Text style={[styles.activateText, { color: plan.popular ? colors.onBrandPrimary : colors.onBrandTertiary }]}>
                    {t("activate")}
                  </Text>
                )}
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  back: { width: 40, height: 44, alignItems: "flex-start", justifyContent: "center" },
  flex1: { flex: 1 },
  title: { color: colors.onSurface, fontSize: font.xl, fontWeight: "800", letterSpacing: 1 },
  subtitle: { color: colors.muted, fontSize: font.sm, marginTop: 2 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  note: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md },
  noteText: { flex: 1, color: colors.onSurfaceTertiary, fontSize: font.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, padding: spacing.lg },
  popularBadge: { position: "absolute", top: spacing.lg, right: spacing.lg, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  popularText: { color: colors.onBrandTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  planName: { color: colors.onSurface, fontSize: font.lg, fontWeight: "800" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.sm },
  price: { color: colors.brandPrimary, fontSize: font.xxl, fontWeight: "800" },
  days: { color: colors.muted, fontSize: font.base },
  features: { gap: spacing.sm, marginTop: spacing.lg },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  featureText: { color: colors.onSurfaceSecondary, fontSize: font.base },
  activateBtn: { height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  activateText: { fontSize: font.base, fontWeight: "800", letterSpacing: 1 },
}));
