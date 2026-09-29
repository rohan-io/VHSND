import React, { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { LoadError } from "@/src/components/LoadError";
import { getAdminKpis } from "@/src/api/mch";

/**
 * Admin Field Team tab — the roster + Notify sections from the Admin Home
 * screen (app/(admin)/index.tsx), replicated with the same card styling.
 * Names are text-only: there is no individual worker profile screen yet.
 */
export default function FieldTeamScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getAdminKpis();
      setWorkers(res?.worker_performance || []);
    } catch (e: any) {
      setError(e.message || tr.adminDashboard.loadFailed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title={tr.nav.fieldTeam} showOfflineToggle={false} />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={t.colors.brand} />
          <Text style={styles.loadingText}>{tr.adminDashboard.loading}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.root}>
        <Header title={tr.nav.fieldTeam} showOfflineToggle={false} />
        <LoadError message={error} onRetry={load} testID="field-team-error" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header title={tr.nav.fieldTeam} showOfflineToggle={false} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.colors.brand} />}
      >
        <Text style={[styles.sectionTitle, { marginTop: 4 }]}>{tr.adminDashboard.fieldTeamTitle}</Text>
        <View style={styles.rosterCard} testID="field-team-roster">
          {workers.map((w: any, i: number) => {
            const noActivity = !w.registered_pregnancies && !w.anc_visits_conducted && !w.children_covered;
            return (
            <View key={w.worker_id} testID={`field-team-worker-${w.worker_id}`} style={[styles.rosterRow, i > 0 && styles.rosterRowDivider, noActivity && styles.rosterRowMuted]}>
              <View style={[styles.rosterAvatar, noActivity && styles.rosterAvatarMuted]}><Text style={styles.rosterAvatarText}>{w.name.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rosterName} numberOfLines={1}>{w.name}</Text>
                <Text style={styles.rosterSector} numberOfLines={1}>{w.sector}</Text>
              </View>
              {noActivity ? (
                <Text style={styles.rosterNoActivity}>{tr.adminDashboard.noActivity}</Text>
              ) : (
              <View style={styles.rosterStats}>
                <View style={styles.rStat}><Text style={styles.rStatNum}>{w.registered_pregnancies}</Text><Text style={styles.rStatLabel}>{tr.adminDashboard.wpPregnancies}</Text></View>
                <View style={styles.rStat}><Text style={styles.rStatNum}>{w.anc_visits_conducted}</Text><Text style={styles.rStatLabel}>{tr.adminDashboard.wpAncVisits}</Text></View>
                <View style={styles.rStat}><Text style={styles.rStatNum}>{w.children_covered}</Text><Text style={styles.rStatLabel}>{tr.adminDashboard.wpChildren}</Text></View>
              </View>
              )}
            </View>
            );
          })}
        </View>

        <View style={styles.notifyCard}>
          <View style={styles.notifyIcon}><Ionicons name="megaphone" size={20} color={t.colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifyTitle}>{tr.adminDashboard.notifyTitle}</Text>
            <Text style={styles.notifyBody}>{tr.adminDashboard.notifyBody}</Text>
            <Pressable testID="field-team-notif-btn" onPress={() => router.push("/notifications")} style={styles.notifyBtn}>
              <Text style={styles.notifyBtnText}>{tr.adminDashboard.openNotifications}</Text>
              <Ionicons name="arrow-forward" size={14} color={t.colors.brandDark} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Same values as the roster/notify styles in app/(admin)/index.tsx.
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 40 },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    loadingText: { color: t.colors.textSecondary, fontSize: 13 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: t.colors.textPrimary, marginTop: 22, marginBottom: 10 },

    rosterCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, overflow: "hidden" },
    rosterRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
    rosterRowDivider: { borderTopWidth: 1, borderTopColor: t.colors.divider },
    rosterRowMuted: { opacity: 0.6 },
    rosterAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.brandLight, alignItems: "center", justifyContent: "center" },
    rosterAvatarMuted: { backgroundColor: t.colors.surfaceTertiary },
    rosterAvatarText: { fontSize: 14, fontWeight: "800", color: t.colors.brandDark },
    rosterName: { fontSize: 13, fontWeight: "700", color: t.colors.textPrimary },
    rosterSector: { fontSize: 11, color: t.colors.textSecondary, marginTop: 1 },
    rosterNoActivity: { fontSize: 11, fontWeight: "700", color: t.colors.textMuted, fontStyle: "italic" },
    rosterStats: { flexDirection: "row", gap: 14 },
    rStat: { alignItems: "center" },
    rStatNum: { fontSize: 14, fontWeight: "800", color: t.colors.textPrimary },
    rStatLabel: { fontSize: 10, color: t.colors.textMuted, fontWeight: "700", marginTop: 1 },

    notifyCard: { flexDirection: "row", gap: 12, backgroundColor: t.colors.brandLight, borderRadius: t.radius.md, padding: 16, marginTop: 22 },
    notifyIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
    notifyTitle: { fontSize: 14, fontWeight: "800", color: t.colors.brandDark },
    notifyBody: { fontSize: 12, color: t.colors.brandDark, opacity: 0.85, marginTop: 3, lineHeight: 16 },
    notifyBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
    notifyBtnText: { fontSize: 12, fontWeight: "800", color: t.colors.brandDark },
  });
