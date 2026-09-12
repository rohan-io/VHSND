import React, { useEffect, useMemo } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import type { Theme } from "@/src/constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function Index() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        if (user.role === "Administrator") {
          router.replace("/(admin)");
        } else {
          router.replace("/(tabs)");
        }
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [user, isLoading]);

  return (
    <View style={styles.container} testID="splash-loading-screen">
      <View style={styles.logoBadge}>
        <Ionicons name="medical" size={36} color={t.colors.onBrand} />
      </View>
      <Text style={styles.title}>ମା ଓ ଶିଶୁ ସୁରକ୍ଷା</Text>
      <Text style={styles.tagline}>
        Digital Care for Every Mother, Protection for Every Child
      </Text>
      <ActivityIndicator
        size="large"
        color={t.colors.brand}
        style={{ marginTop: 24 }}
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.surfaceSecondary,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    logoBadge: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.brand,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      shadowColor: t.colors.brandDark,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    title: {
      fontFamily: "NotoSansOriya",
      fontSize: 26,
      lineHeight: 38,
      color: t.colors.textPrimary,
    },
    tagline: {
      fontSize: 13,
      color: t.colors.textSecondary,
      marginTop: 8,
      textAlign: "center",
      maxWidth: 300,
      lineHeight: 19,
    },
  });
