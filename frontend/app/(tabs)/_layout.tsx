import Icon from "@react-native-vector-icons/material-design-icons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform, StyleSheet } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const styles = useStyles();

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="beranda">
          <NativeTabs.Trigger.Icon sf="house.fill" />
          <NativeTabs.Trigger.Label>Beranda</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="server">
          <NativeTabs.Trigger.Icon sf="servercluster" />
          <NativeTabs.Trigger.Label>Server</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="config">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>Config</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="log">
          <NativeTabs.Trigger.Icon sf="terminal" />
          <NativeTabs.Trigger.Label>Log</NativeTabs.Trigger.Label>
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
        tabBarStyle: [
          styles.tabBar,
          Platform.OS === "web" ? { height: 64 } : {},
        ],
        tabBarItemStyle: { alignSelf: "center" },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="beranda"
        options={{
          title: "Beranda",
          tabBarIcon: ({ color, size }) => (
            <Icon name="home-variant" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="server"
        options={{
          title: "Server",
          tabBarIcon: ({ color, size }) => (
            <Icon name="server-network" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="config"
        options={{
          title: "Config",
          tabBarIcon: ({ color, size }) => (
            <Icon name="tune-vertical" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log",
          tabBarIcon: ({ color, size }) => (
            <Icon name="console" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const useStyles = makeStyles((colors) => ({
  tabBar: {
    backgroundColor: colors.surfaceSecondary,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
}));
