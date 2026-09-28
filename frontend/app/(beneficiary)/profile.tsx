import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme, useThemeMode, type ThemeMode } from "@/src/context/ThemeContext";
import { useTranslation, useLanguage } from "@/src/context/LanguageContext";
import type { Lang } from "@/src/i18n/strings";
import type { Theme } from "@/src/constants/theme";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";

// Reuses the exact Appearance/Language segmented-control pattern from
// app/(tabs)/profile.tsx (the ANM/ASHA/Admin-reachable profile screen) rather
// than inventing a new settings UI for this role.
const THEME_ICONS: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
  light: "sunny-outline",
  dark: "moon-outline",
  system: "phone-portrait-outline",
};

export default function BeneficiaryProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const tr = useTranslation();
  const { lang, setLang } = useLanguage();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const { user, logout } = useAuth();
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable testID="beneficiary-profile-back-btn" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={t.colors.brandDark} />
        </Pressable>
        <Text style={styles.headerTitle}>{tr.profile.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <View style={styles.profileCard} testID="beneficiary-profile-card">
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{user?.name?.charAt(0) || "?"}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="heart" size={12} color={t.colors.brandSecondaryDark} />
            <Text style={styles.roleText}>{tr.common.roleBeneficiary}</Text>
          </View>
          {user?.mobile ? (
            <View style={styles.profileMetaItem}>
              <Ionicons name="call-outline" size={14} color={t.colors.textSecondary} />
              <Text style={styles.profileMetaText}>{user.mobile}</Text>
            </View>
          ) : null}
        </View>

        {/* Appearance — identical control to the worker/admin profile screen */}
        <Text style={styles.sectionTitle}>{tr.profile.appearance}</Text>
        <View style={styles.appearanceCard}>
          <View style={styles.segmented} testID="beneficiary-theme-mode-control">
            {THEME_OPTIONS.map((opt) => {
              const active = themeMode === opt.mode;
              return (
                <Pressable
                  key={opt.mode}
                  testID={`beneficiary-theme-mode-${opt.mode}`}
                  onPress={() => setThemeMode(opt.mode)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Ionicons name={opt.icon} size={16} color={active ? t.colors.brandText : t.colors.textSecondary} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.appearanceHint}>{tr.profile.appearanceHint}</Text>
        </View>

        {/* Language */}
        <Text style={styles.sectionTitle}>{tr.profile.language}</Text>
        <View style={styles.appearanceCard}>
          <View style={styles.segmented} testID="beneficiary-language-control">
            {LANG_OPTIONS.map((opt) => {
              const active = lang === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  testID={`beneficiary-language-${opt.code}`}
                  onPress={() => setLang(opt.code)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Ionicons name="language-outline" size={16} color={active ? t.colors.brandText : t.colors.textSecondary} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.appearanceHint}>{tr.profile.languageHint}</Text>
        </View>

        <Pressable testID="beneficiary-profile-logout-btn" onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={t.colors.error} />
          <Text style={styles.logoutText}>{tr.profile.signOut}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 12,
      backgroundColor: t.colors.surfaceSecondary,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 16, fontWeight: "800", color: t.colors.textPrimary },
    scroll: { padding: 16, paddingBottom: 32 },
    profileCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.lg, padding: 20, alignItems: "center", borderWidth: 1, borderColor: t.colors.border, gap: 4 },
    bigAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.brandSecondary, alignItems: "center", justifyContent: "center", marginBottom: 6 },
    bigAvatarText: { fontSize: 30, fontWeight: "800", color: t.colors.onBrand },
    profileName: { fontSize: 18, fontWeight: "800", color: t.colors.textPrimary },
    roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: t.colors.brandSecondaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: t.radius.pill, marginTop: 4 },
    roleText: { fontSize: 12, fontWeight: "800", color: t.colors.brandSecondaryDark },
    profileMetaItem: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
    profileMetaText: { fontSize: 12, color: t.colors.textSecondary, fontWeight: "600" },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: t.colors.textPrimary, marginTop: 20, marginBottom: 10 },
    appearanceCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, borderWidth: 1, borderColor: t.colors.border },
    segmented: { flexDirection: "row", backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.md, padding: 4, gap: 4 },
    segment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: t.radius.sm },
    segmentActive: { backgroundColor: t.colors.surfaceSecondary, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    segmentText: { fontSize: 13, fontWeight: "700", color: t.colors.textSecondary },
    segmentTextActive: { color: t.colors.brandText },
    appearanceHint: { fontSize: 12, color: t.colors.textMuted, marginTop: 10 },
    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.colors.errorLight, borderRadius: t.radius.md, paddingVertical: 14, marginTop: 20 },
    logoutText: { fontSize: 14, fontWeight: "800", color: t.colors.error },
  });
