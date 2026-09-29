import { Platform } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";

/** Bottom tab bar styling shared by every role's tab layout (ANM, Admin, Beneficiary). */
export function useTabScreenOptions() {
  const t = useTheme();
  return {
    headerShown: false,
    tabBarActiveTintColor: t.colors.brandText,
    tabBarInactiveTintColor: t.colors.textMuted,
    tabBarStyle: {
      backgroundColor: t.colors.surfaceSecondary,
      borderTopColor: t.colors.border,
      borderTopWidth: 1,
      ...(Platform.OS === "web" ? { height: 64 } : {}),
    },
    tabBarItemStyle: { alignSelf: "center" as const },
    tabBarLabelStyle: { fontSize: 12, fontWeight: "700" as const },
  };
}
