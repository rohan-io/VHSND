import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, useThemeMode, type ThemeMode } from "@/src/context/ThemeContext";
import { useTranslation, useLanguage } from "@/src/context/LanguageContext";
import type { Lang } from "@/src/i18n/strings";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { useAuth } from "@/src/context/AuthContext";
import { useOfflineSync } from "@/src/context/OfflineSyncContext";
import { useToast } from "@/src/components/Toast";

const THEME_ICONS: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
  light: "sunny-outline",
  dark: "moon-outline",
  system: "phone-portrait-outline",
};

export default function ProfileScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const { lang, setLang } = useLanguage();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const { user, logout } = useAuth();
  const { isSimulatedOffline, toggleSimulatedOffline, pendingCount, lastSyncTime } = useOfflineSync();
  const { showToast } = useToast();

  const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { mode: "light", label: tr.profile.themeLight, icon: THEME_ICONS.light },
    { mode: "dark", label: tr.profile.themeDark, icon: THEME_ICONS.dark },
    { mode: "system", label: tr.profile.themeSystem, icon: THEME_ICONS.system },
  ];
  const LANG_OPTIONS: { code: Lang; label: string }[] = [
    { code: "en", label: tr.profile.langEnglish },
    { code: "or", label: tr.profile.langOdia },
  ];

  const handleLogout = async () => {
    await logout();
    showToast(tr.profile.signedOutToast, "info");
    router.replace("/(auth)/login");
  };

  const rows = [
    { icon: "sync-circle-outline" as const, label: tr.profile.offlineSyncCenter, sub: `${pendingCount} ${tr.profile.pendingLastSynced} ${lastSyncTime || "—"}`, action: () => router.push("/sync") },
    { icon: "notifications-outline" as const, label: tr.profile.notifications, sub: tr.profile.notificationsSub, action: () => router.push("/notifications") },
    { icon: "shield-checkmark-outline" as const, label: tr.profile.assignedVillages, sub: (user?.assigned_villages || []).join(", ") || "—", action: () => {} },
  ];

  return (
    <View style={styles.root}>
      <Header title={tr.profile.title} showOfflineToggle={false} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard} testID="profile-card">
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{user?.name?.charAt(0) || "?"}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="ribbon" size={12} color={t.colors.brandDark} />
            <Text style={styles.roleText}>
              {user?.role === "Administrator"
                ? tr.common.roleAdministrator
                : user?.role === "Health Worker"
                ? tr.common.roleHealthWorker
                : user?.role}
            </Text>
          </View>
          <View style={styles.profileMetaRow}>
            <View style={styles.profileMetaItem}>
              <Ionicons name="call-outline" size={14} color={t.colors.textSecondary} />
              <Text style={styles.profileMetaText}>{user?.mobile || "—"}</Text>
            </View>
            <View style={styles.profileMetaItem}>
              <Ionicons name="business-outline" size={14} color={t.colors.textSecondary} />
              <Text style={styles.profileMetaText}>{user?.phc_center || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Simulated Offline Toggle */}
        <Text style={styles.sectionTitle}>{tr.profile.fieldConnectivity}</Text>
        <View style={styles.toggleCard}>
          <View style={[styles.toggleIcon, { backgroundColor: isSimulatedOffline ? t.colors.errorLight : t.colors.brandLight }]}>
            <Ionicons name={isSimulatedOffline ? "cloud-offline" : "cloud-done"} size={20} color={isSimulatedOffline ? t.colors.error : t.colors.brandText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>{tr.profile.simulatedOffline}</Text>
            <Text style={styles.toggleSub}>
              {isSimulatedOffline ? tr.profile.simulatedOfflineOn : tr.profile.simulatedOfflineOff}
            </Text>
          </View>
          <Switch
            testID="profile-offline-switch"
            value={isSimulatedOffline}
            onValueChange={toggleSimulatedOffline}
            trackColor={{ false: t.colors.borderStrong, true: t.colors.error }}
            thumbColor={isSimulatedOffline ? t.colors.errorLight : "#FFFFFF"}
          />
        </View>

        {/* Appearance */}
        <Text style={styles.sectionTitle}>{tr.profile.appearance}</Text>
        <View style={styles.appearanceCard}>
          <View style={styles.segmented} testID="theme-mode-control">
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.mode;
              return (
                <Pressable
                  key={opt.mode}
                  testID={`theme-mode-${opt.mode}`}
                  onPress={() => setThemeMode(opt.mode)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={active ? t.colors.brandText : t.colors.textSecondary}
                  />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.appearanceHint}>
            {tr.profile.appearanceHint}
          </Text>
        </View>

        {/* Language */}
        <Text style={styles.sectionTitle}>{tr.profile.language}</Text>
        <View style={styles.appearanceCard}>
          <View style={styles.segmented} testID="language-control">
            {LANG_OPTIONS.map((opt) => {
              const active = lang === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  testID={`language-${opt.code}`}
                  onPress={() => setLang(opt.code)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Ionicons
                    name="language-outline"
                    size={16}
                    color={active ? t.colors.brandText : t.colors.textSecondary}
                  />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.appearanceHint}>
            {tr.profile.languageHint}
          </Text>
        </View>

        {/* Menu rows */}
        <Text style={styles.sectionTitle}>{tr.profile.tools}</Text>
        {rows.map((r, i) => (
          <Pressable key={i} testID={`profile-row-${i}`} onPress={r.action} style={styles.menuRow}>
            <View style={styles.menuIcon}>
              <Ionicons name={r.icon} size={20} color={t.colors.brandDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{r.label}</Text>
              <Text style={styles.menuSub} numberOfLines={1}>{r.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
          </Pressable>
        ))}

        <Pressable testID="profile-logout-btn" onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={t.colors.error} />
          <Text style={styles.logoutText}>{tr.profile.signOut}</Text>
        </Pressable>

        <Text style={styles.footerText}>ମା ଓ ଶିଶୁ ସୁରକ୍ଷା · v2.6.4</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 32 },
    profileCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.lg, padding: 20, alignItems: "center", borderWidth: 1, borderColor: t.colors.border },
    bigAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.brand, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    bigAvatarText: { fontSize: 30, fontWeight: "800", color: t.colors.onBrand },
    profileName: { fontSize: 18, fontWeight: "800", color: t.colors.textPrimary },
    roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: t.colors.brandLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: t.radius.pill, marginTop: 6 },
    roleText: { fontSize: 12, fontWeight: "800", color: t.colors.brandDark },
    profileMetaRow: { flexDirection: "row", gap: 16, marginTop: 12, flexWrap: "wrap", justifyContent: "center" },
    profileMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    profileMetaText: { fontSize: 12, color: t.colors.textSecondary, fontWeight: "600" },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: t.colors.textPrimary, marginTop: 20, marginBottom: 10 },
    toggleCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, borderWidth: 1, borderColor: t.colors.border },
    toggleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    toggleLabel: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    toggleSub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    appearanceCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, borderWidth: 1, borderColor: t.colors.border },
    segmented: { flexDirection: "row", backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.md, padding: 4, gap: 4 },
    segment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: t.radius.sm },
    segmentActive: { backgroundColor: t.colors.surfaceSecondary, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    segmentText: { fontSize: 13, fontWeight: "700", color: t.colors.textSecondary },
    segmentTextActive: { color: t.colors.brandText },
    appearanceHint: { fontSize: 12, color: t.colors.textMuted, marginTop: 10 },
    menuRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: t.colors.border },
    menuIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
    menuLabel: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    menuSub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.colors.errorLight, borderRadius: t.radius.md, paddingVertical: 14, marginTop: 20 },
    logoutText: { fontSize: 14, fontWeight: "800", color: t.colors.error },
    footerText: { fontFamily: "NotoSansOriya", textAlign: "center", fontSize: 12, color: t.colors.textMuted, fontWeight: "400", marginTop: 20 },
  });
