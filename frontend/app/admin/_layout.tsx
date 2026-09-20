import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/src/auth";

export default function AdminLayout() {
  const { user, hydrated } = useAuth();
  if (!hydrated) return null;
  if (!user || user.role !== "admin") return <Redirect href="/beranda" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
