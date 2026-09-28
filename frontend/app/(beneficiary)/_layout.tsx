import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTabScreenOptions } from "@/src/hooks/use-tab-screen-options";
import { useTranslation } from "@/src/context/LanguageContext";

export default function BeneficiaryLayout() {
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
        name="checkups"
        options={{
          title: tr.nav.checkups,
          tabBarIcon: ({ color, size }) => <Ionicons name="medkit" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="beneficiary-alerts"
        options={{
          title: tr.nav.alerts,
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: tr.nav.profile,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
