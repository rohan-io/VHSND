import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTabScreenOptions } from "@/src/hooks/use-tab-screen-options";
import { useTranslation } from "@/src/context/LanguageContext";

export default function TabsLayout() {
  const tr = useTranslation();
  return (
    <Tabs screenOptions={useTabScreenOptions()}>
      <Tabs.Screen
        name="index"
        options={{
          title: tr.nav.home,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pregnancy"
        options={{
          title: tr.nav.pregnancy,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="woman" size={size} color={color} />
          ),
        }}
      />
      {/* Children section hidden from navigation (reversible): the route, screen,
          components and data model are all intact — only the tab is removed.
          Restore by giving this back its title + tabBarIcon and dropping href. */}
      <Tabs.Screen
        name="children"
        options={{
          href: null,
          title: tr.nav.children,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="body" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: tr.nav.alerts,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: tr.nav.profile,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
