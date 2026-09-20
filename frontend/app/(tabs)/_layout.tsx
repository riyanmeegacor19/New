import Icon from "@react-native-vector-icons/material-design-icons";
import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";

import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { useT } from "@/src/settings";
import { makeStyles, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const { user, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="beranda">
          <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" />
          <NativeTabs.Trigger.Label>{t("tab_home")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="hunting">
          <NativeTabs.Trigger.Icon sf="scope" />
          <NativeTabs.Trigger.Label>{t("tab_hunting")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="cekip">
          <NativeTabs.Trigger.Icon sf="globe" />
          <NativeTabs.Trigger.Label>{t("tab_cekip")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="riwayat">
          <NativeTabs.Trigger.Icon sf="clock.fill" />
          <NativeTabs.Trigger.Label>{t("tab_history")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: [styles.tabBar, Platform.OS === "web" ? { height: 64 } : {}],
        tabBarItemStyle: { alignSelf: "center" },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="beranda"
        options={{ title: t("tab_home"), tabBarIcon: ({ color, size }) => <Icon name="account-circle" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="hunting"
        options={{ title: t("tab_hunting"), tabBarIcon: ({ color, size }) => <Icon name="target" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="cekip"
        options={{ title: t("tab_cekip"), tabBarIcon: ({ color, size }) => <Icon name="web" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="riwayat"
        options={{ title: t("tab_history"), tabBarIcon: ({ color, size }) => <Icon name="history" color={color} size={size} /> }}
      />
    </Tabs>
  );
}

const useStyles = makeStyles((colors) => ({
  loading: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  tabBar: {
    backgroundColor: colors.surfaceSecondary,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
}));
