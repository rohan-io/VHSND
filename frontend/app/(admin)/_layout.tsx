import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTabScreenOptions } from "@/src/hooks/use-tab-screen-options";
import { useTranslation } from "@/src/context/LanguageContext";

export default function AdminLayout() {
  const tr = useTranslation();
  return (
    <Tabs screenOptions={useTabScreenOptions()}>
      <Tabs.Screen
        name="index"
        options={{
          title: tr.nav.home,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="field-team"
        options={{
          title: tr.nav.fieldTeam,
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin-alerts"
        options={{
          title: tr.nav.alerts,
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin-profile"
        options={{
          title: tr.nav.profile,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
