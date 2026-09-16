import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { useOfflineSync } from "@/src/context/OfflineSyncContext";
import { useAuth } from "@/src/context/AuthContext";

const APP_NAME = "ମା ଓ ଶିଶୁ ସୁରକ୍ଷା";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showOfflineToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = APP_NAME,
  subtitle,
  showBack = false,
  showOfflineToggle = true,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { isSimulatedOffline, toggleSimulatedOffline, pendingCount } = useOfflineSync();
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      {/* Top Bar Banner with Government Identity */}
      <View style={[styles.govBar, { paddingTop: insets.top + 5 }]}>
        <View style={styles.govLogoContainer}>
          <View style={styles.emblemBadge}>
            <Ionicons name="medical" size={13} color={t.colors.onBrand} />
          </View>
          <Text style={styles.govText}>{APP_NAME}</Text>
        </View>
      </View>

      {/* Main Header Content */}
      <View style={styles.mainRow}>
        <View style={styles.leftCol}>
          {showBack ? (
            <Pressable
              testID="header-back-button"
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={t.colors.brandDark} />
            </Pressable>
          ) : (
            <View style={styles.avatarPill}>
              <Ionicons name="shield-checkmark" size={18} color={t.colors.brandText} />
            </View>
          )}

          <View style={styles.titleWrapper}>
            <Text
              style={[styles.titleText, title === APP_NAME && styles.titleOdia]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : user ? (
              <Text style={styles.subtitleText} numberOfLines={1}>
                {user.name}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Action Controls: Offline Switch & Notification Bell */}
        <View style={styles.actionsRow}>
          {showOfflineToggle && (
            <Pressable
              testID="header-offline-toggle-btn"
              onPress={toggleSimulatedOffline}
              style={[
                styles.offlinePill,
                isSimulatedOffline ? styles.offlinePillActive : styles.onlinePillActive,
              ]}
            >
              <Ionicons
                name={isSimulatedOffline ? "cloud-offline" : "cloud-done"}
                size={14}
                color={isSimulatedOffline ? t.colors.error : t.colors.success}
              />
              <Text
                style={[
                  styles.offlinePillText,
                  { color: isSimulatedOffline ? t.colors.error : t.colors.brandDark },
                ]}
              >
                {isSimulatedOffline ? tr.common.offline : tr.common.online}
              </Text>
            </Pressable>
          )}

          {/* Sync Queue Pill */}
          <Pressable
            testID="header-sync-queue-btn"
            onPress={() => router.push("/sync")}
            style={styles.iconButton}
            hitSlop={6}
          >
            <Ionicons name="sync-circle-outline" size={22} color={t.colors.brandDark} />
            {pendingCount > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </Pressable>

          {/* Notification Bell */}
          <Pressable
            testID="header-notifications-btn"
            onPress={() => router.push("/notifications")}
            style={styles.iconButton}
            hitSlop={6}
          >
            <Ionicons name="notifications-outline" size={22} color={t.colors.brandDark} />
            <View style={styles.notifDot} />
          </Pressable>
        </View>
      </View>

      {/* Simulated Offline Alert Ribbon if Offline */}
      {isSimulatedOffline && (
        <Pressable
          testID="offline-mode-warning-banner"
          onPress={() => router.push("/sync")}
          style={styles.offlineRibbon}
        >
          <Ionicons name="warning-outline" size={14} color={t.colors.error} />
          <Text style={styles.offlineRibbonText}>
            {tr.header.offlineRibbon.replace("{count}", String(pendingCount))}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: t.colors.surfaceSecondary,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    govBar: {
      backgroundColor: t.colors.inkBar,
      paddingHorizontal: 16,
      paddingVertical: 5,
      flexDirection: "row",
      alignItems: "center",
    },
    govLogoContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    emblemBadge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: t.colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    govText: {
      fontFamily: "NotoSansOriya",
      color: t.colors.onInkBar,
      fontSize: 12,
      fontWeight: "600",
    },
    mainRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 56,
    },
    leftCol: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    backButton: {
      padding: 4,
      marginRight: 2,
    },
    avatarPill: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.colors.brandLight,
      alignItems: "center",
      justifyContent: "center",
    },
    titleWrapper: {
      flex: 1,
    },
    titleText: {
      fontSize: 16,
      fontWeight: "700",
      color: t.colors.textPrimary,
    },
    titleOdia: {
      fontFamily: "NotoSansOriya",
      fontSize: 17,
      fontWeight: "400",
    },
    subtitleText: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginTop: 1,
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    offlinePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 12,
      borderWidth: 1,
    },
    onlinePillActive: {
      backgroundColor: t.colors.brandLight,
      borderColor: t.colors.borderStrong,
    },
    offlinePillActive: {
      backgroundColor: t.colors.errorLight,
      borderColor: t.colors.error,
    },
    offlinePillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: t.colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    badgeCount: {
      position: "absolute",
      top: -2,
      right: -2,
      backgroundColor: t.colors.error,
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    badgeText: {
      color: t.colors.onStatus,
      fontSize: 11,
      fontWeight: "800",
    },
    notifDot: {
      position: "absolute",
      top: 6,
      right: 8,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: t.colors.brand,
    },
    offlineRibbon: {
      backgroundColor: t.colors.errorLight,
      borderTopWidth: 1,
      borderTopColor: t.colors.error,
      paddingHorizontal: 16,
      paddingVertical: 5,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    offlineRibbonText: {
      fontSize: 12,
      fontWeight: "700",
      color: t.colors.error,
    },
  });
