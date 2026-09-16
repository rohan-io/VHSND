import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { LoadError } from "@/src/components/LoadError";
import { useAuth } from "@/src/context/AuthContext";
import { getAdminKpis, listAlerts } from "@/src/api/mch";
import { AlertItem } from "@/src/types";

const ESC_PREVIEW = 3;
type DetailView = "trimester" | "village";

/**
 * Admin role is Monitor, Escalate, Notify — never a write on operational data
 * (see src/utils/roles.ts + the guards on Alerts/pregnancy/child screens).
 * That policy also shapes this screen's layout: it leads with what needs
 * escalation, compresses "at a glance" numbers into a scannable strip rather
 * than the Worker dashboard's worklist-of-cards, and gives Notify its own
 * section instead of a trailing icon button — a different information
 * hierarchy for a different job, not the Worker screen with buttons removed.
 */
export default function AdminDashboardScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { user, logout } = useAuth();
  const [data, setData] = useState<any>(null);
  const [escalations, setEscalations] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<DetailView>("trimester");

  const load = useCallback(async () => {
    try {
      setError(null);
      const [res, esc] = await Promise.all([
        getAdminKpis(),
        listAlerts({ status_filter: "ACTIVE", category: "CRITICAL_PREGNANCY_ESCALATION" }),
      ]);
      setData(res);
      setEscalations(esc.items || []);
    } catch (e: any) {
      // A toast alone let this screen render every KPI as a silent zero,
      // indistinguishable from a genuinely quiet district — this is the one
      // screen built to give oversight of offline-sync-dependent data, so a
      // failed load needs its own state + retry, same as the Worker dashboard.
      setError(e.message || tr.adminDashboard.loadFailed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title={tr.adminDashboard.title} showOfflineToggle={false} />
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
        <Header title={tr.adminDashboard.title} showOfflineToggle={false} />
        <LoadError message={error} onRetry={load} testID="admin-dashboard-error" />
      </View>
    );
  }

  const k = data?.kpis || {};
  const trim = data?.trimester_breakdown || {};
  const trimData = [
    { label: tr.adminDashboard.firstTrimester, value: trim.first_trimester || 0 },
    { label: tr.adminDashboard.secondTrimester, value: trim.second_trimester || 0 },
    { label: tr.adminDashboard.thirdTrimester, value: trim.third_trimester || 0 },
  ];
  const trimMax = Math.max(1, ...trimData.map((d) => d.value));
  const villages = data?.village_stats || [];
  const villageMax = Math.max(1, ...villages.map((v: any) => v.active_pregnancies));
  const workers = data?.worker_performance || [];
  const hasEscalations = escalations.length > 0;

  // Last field is an optional onPress — PMSMA/ePMSMA drill into the dedicated
  // tracking list (see app/pmsma.tsx); the rest are read-only numbers.
  const SNAPSHOT: [string, number | string, keyof typeof Ionicons.glyphMap, (() => void)?][] = [
    [tr.adminDashboard.healthWorkers, k.total_health_workers ?? 0, "people"],
    [tr.adminDashboard.totalPregnancies, k.total_pregnancies ?? 0, "woman"],
    [tr.adminDashboard.activeLabel, k.active_pregnancies ?? 0, "pulse"],
    [tr.adminDashboard.highRisk, k.high_risk_pregnancies ?? 0, "warning"],
    [tr.adminDashboard.highRiskRate, `${k.high_risk_rate_percent ?? 0}%`, "trending-up"],
    [tr.adminDashboard.delivered, k.delivered_pregnancies ?? 0, "checkmark-done"],
    [tr.adminDashboard.totalChildren, k.total_children ?? 0, "body"],
    [tr.adminDashboard.immCoverage, `${k.immunization_coverage_percent ?? 0}%`, "shield-checkmark"],
    // PMSMA (9th-of-the-month ANC camp) — replaces the old Child Vaccines tile.
    [tr.dashboard.pmsma, k.pmsma_ontrack ?? 0, "calendar", () => router.push("/pmsma" as any)],
    [tr.dashboard.epmsma, k.pmsma_missed ?? 0, "calendar", () => router.push("/pmsma" as any)],
  ];

  const detailRows = detailView === "trimester"
    ? trimData.map((d, i) => ({ key: d.label, label: d.label, value: d.value, max: trimMax, color: [t.colors.brandDark, t.colors.brandText, t.colors.brandSecondaryText][i] }))
    : villages.map((v: any) => ({ key: v.village, label: v.village, value: v.active_pregnancies, max: villageMax, color: t.colors.brand }));

  return (
    <View style={styles.root}>
      <Header title={tr.adminDashboard.title} showOfflineToggle={false} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={t.colors.brand} />}
      >
        {/* Identity + live status — the one-line answer to "is everything okay". */}
        <View style={styles.heroBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroDistrict} numberOfLines={1}>{tr.adminDashboard.districtLine}</Text>
            <Text style={styles.heroBlock}>{tr.adminDashboard.blockLine}</Text>
          </View>
          <View testID="admin-status-pill" style={[styles.statusPill, hasEscalations ? styles.statusPillAlert : styles.statusPillClear]}>
            <Ionicons name={hasEscalations ? "warning" : "checkmark-circle"} size={13} color={hasEscalations ? t.colors.onStatus : t.colors.successText} />
            <Text style={[styles.statusPillText, { color: hasEscalations ? t.colors.onStatus : t.colors.successText }]}>
              {hasEscalations ? `${escalations.length} ${tr.adminDashboard.statusNeedsEscalation}` : tr.adminDashboard.statusAllClear}
            </Text>
          </View>
        </View>

        {/* ESCALATE — the reason this role exists, so it leads the page, full weight. */}
        <View style={styles.escHeaderRow}>
          <Text style={[styles.sectionTitle, styles.escHeading]}>{tr.adminDashboard.criticalEscalations}</Text>
          <Pressable testID="admin-alerts-btn" onPress={() => router.push("/alerts")} hitSlop={8}>
            <Text style={styles.allAlertsLink}>{tr.adminDashboard.allAlerts}</Text>
          </Pressable>
        </View>
        {!hasEscalations ? (
          <View style={styles.escEmpty} testID="admin-escalations-empty">
            <Ionicons name="checkmark-circle-outline" size={18} color={t.colors.success} />
            <Text style={styles.escEmptyText}>{tr.adminDashboard.noCriticalEscalations}</Text>
          </View>
        ) : (
          <View style={styles.escPanel}>
            {escalations.slice(0, ESC_PREVIEW).map((a, i) => (
              <Pressable
                key={a.id}
                testID={`admin-escalation-${a.id}`}
                onPress={() => router.push(`/pregnancy/${a.related_entity_id}` as any)}
                style={[styles.escRow, i > 0 && styles.escRowDivider]}
              >
                <Ionicons name="warning" size={19} color={t.colors.onStatus} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.escTitle} numberOfLines={2}>{a.title}</Text>
                  <Text style={styles.escMsg} numberOfLines={3}>{a.message}</Text>
                  <Text style={styles.escWorker} numberOfLines={1}>{tr.alerts.assignedPrefix} {a.assigned_worker_name || "—"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.colors.onStatus} />
              </Pressable>
            ))}
            {escalations.length > ESC_PREVIEW && (
              <Pressable testID="admin-escalations-view-all" onPress={() => router.push("/alerts?seg=escalations" as any)} style={styles.escMoreRow}>
                <Text style={styles.escMoreText}>{tr.common.viewAll} ({escalations.length})</Text>
                <Ionicons name="arrow-forward" size={14} color={t.colors.onStatus} />
              </Pressable>
            )}
          </View>
        )}

        {/* MONITOR — dense scannable strip, not a worklist of square cards. */}
        <Text style={styles.sectionTitle}>{tr.adminDashboard.snapshotTitle}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.snapshotRow}>
          {SNAPSHOT.map(([label, value, icon, onPress]) => (
            <Pressable key={label} testID={onPress ? `admin-snapshot-${label}` : undefined} disabled={!onPress} onPress={onPress} style={styles.snapshotChip}>
              <Ionicons name={icon} size={15} color={t.colors.brandText} />
              <Text style={styles.snapshotValue}>{value}</Text>
              <Text style={styles.snapshotLabel} numberOfLines={2}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* District detail — one panel, segmented, instead of two stacked charts. */}
        <View style={styles.detailHeaderRow}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>{tr.adminDashboard.districtDetailTitle}</Text>
          <View style={styles.segmentRow}>
            <Pressable testID="admin-detail-trimester" onPress={() => setDetailView("trimester")} style={[styles.segmentBtn, detailView === "trimester" && styles.segmentBtnActive]}>
              <Text style={[styles.segmentText, detailView === "trimester" && styles.segmentTextActive]}>{tr.adminDashboard.byTrimester}</Text>
            </Pressable>
            <Pressable testID="admin-detail-village" onPress={() => setDetailView("village")} style={[styles.segmentBtn, detailView === "village" && styles.segmentBtnActive]}>
              <Text style={[styles.segmentText, detailView === "village" && styles.segmentTextActive]}>{tr.adminDashboard.byVillage}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.chartCard}>
          {detailRows.map((d: any) => (
            <View key={d.key} style={styles.barRow}>
              <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(d.value / d.max) * 100}%`, backgroundColor: d.color }]} />
              </View>
              <Text style={styles.barValue}>{d.value}</Text>
            </View>
          ))}
        </View>

        {/* Field team — a roster to scan, not profile cards. */}
        <Text style={styles.sectionTitle}>{tr.adminDashboard.fieldTeamTitle}</Text>
        <View style={styles.rosterCard}>
          {workers.map((w: any, i: number) => {
            const noActivity = !w.registered_pregnancies && !w.anc_visits_conducted && !w.children_covered;
            return (
            <View key={w.worker_id} style={[styles.rosterRow, i > 0 && styles.rosterRowDivider, noActivity && styles.rosterRowMuted]}>
              <View style={[styles.rosterAvatar, noActivity && styles.rosterAvatarMuted]}><Text style={styles.rosterAvatarText}>{w.name.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rosterName} numberOfLines={1}>{w.name}</Text>
                <Text style={styles.rosterSector} numberOfLines={1}>{w.sector}</Text>
              </View>
              {noActivity ? (
                <Text testID={`admin-roster-noactivity-${w.worker_id}`} style={styles.rosterNoActivity}>{tr.adminDashboard.noActivity}</Text>
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

        {/* NOTIFY — a real section, not a trailing icon button. */}
        <View style={styles.notifyCard}>
          <View style={styles.notifyIcon}><Ionicons name="megaphone" size={20} color={t.colors.brandDark} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifyTitle}>{tr.adminDashboard.notifyTitle}</Text>
            <Text style={styles.notifyBody}>{tr.adminDashboard.notifyBody}</Text>
            <Pressable testID="admin-notif-btn" onPress={() => router.push("/notifications")} style={styles.notifyBtn}>
              <Text style={styles.notifyBtnText}>{tr.adminDashboard.openNotifications}</Text>
              <Ionicons name="arrow-forward" size={14} color={t.colors.brandDark} />
            </Pressable>
          </View>
        </View>

        <Pressable testID="admin-logout-btn" onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={t.colors.error} />
          <Text style={styles.logoutText}>{tr.adminDashboard.signOut}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 40 },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    loadingText: { color: t.colors.textSecondary, fontSize: 13 },

    heroBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: t.colors.heroPanel, borderRadius: t.radius.lg, padding: 16, marginBottom: 4 },
    heroDistrict: { color: t.colors.onHeroPanel, fontSize: 16, fontWeight: "800" },
    heroBlock: { color: t.colors.onHeroPanelMuted, fontSize: 12, marginTop: 3 },
    statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: t.radius.pill },
    statusPillAlert: { backgroundColor: t.colors.error },
    statusPillClear: { backgroundColor: t.colors.successLight },
    statusPillText: { fontSize: 12, fontWeight: "800" },

    sectionTitle: { fontSize: 15, fontWeight: "800", color: t.colors.textPrimary, marginTop: 22, marginBottom: 10 },
    escHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
    escHeading: { color: t.colors.errorText, marginTop: 0, marginBottom: 0 },
    allAlertsLink: { fontSize: 12, fontWeight: "700", color: t.colors.brandText },
    escEmpty: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.successLight, borderRadius: t.radius.md, padding: 12, marginTop: 10 },
    escEmptyText: { fontSize: 12, color: t.colors.successText, fontWeight: "600", flex: 1 },
    escPanel: { backgroundColor: t.colors.error, borderRadius: t.radius.md, marginTop: 10, overflow: "hidden" },
    escRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
    escRowDivider: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)" },
    escTitle: { fontSize: 14, fontWeight: "800", color: t.colors.onStatus },
    escMsg: { fontSize: 12, color: t.colors.onStatus, opacity: 0.9, marginTop: 2, lineHeight: 16 },
    escWorker: { fontSize: 12, color: t.colors.onStatus, opacity: 0.85, marginTop: 4, fontWeight: "700" },
    escMoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)" },
    escMoreText: { fontSize: 12, fontWeight: "800", color: t.colors.onStatus },

    // Narrower than a "natural" fit so the next chip always peeks at the
    // trailing edge — the visible sliver is the scroll affordance itself.
    snapshotRow: { gap: 8, paddingBottom: 4, paddingRight: 4 },
    snapshotChip: { width: 82, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, padding: 10, gap: 3 },
    snapshotValue: { fontSize: 18, fontWeight: "800", color: t.colors.textPrimary, marginTop: 2 },
    snapshotLabel: { fontSize: 11, color: t.colors.textSecondary, fontWeight: "600", lineHeight: 13 },

    detailHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10, gap: 8 },
    segmentRow: { flexDirection: "row", backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.sm, padding: 3 },
    // paddingVertical 11 (not the original 7) so the ~44px comfortable tap
    // target applies here too — this is a real control, not a static chip.
    segmentBtn: { paddingHorizontal: 10, paddingVertical: 11, borderRadius: t.radius.sm - 2 },
    segmentBtnActive: { backgroundColor: t.colors.surfaceSecondary },
    segmentText: { fontSize: 11, fontWeight: "700", color: t.colors.textSecondary },
    segmentTextActive: { color: t.colors.brandText },
    chartCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 16, borderWidth: 1, borderColor: t.colors.border },
    barRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    barLabel: { width: 96, fontSize: 12, fontWeight: "700", color: t.colors.textSecondary },
    barTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: t.colors.surfaceTertiary, overflow: "hidden" },
    barFill: { height: 14, borderRadius: 7 },
    barValue: { width: 28, fontSize: 12, fontWeight: "800", color: t.colors.textPrimary, textAlign: "right" },

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

    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.colors.errorLight, borderRadius: t.radius.md, paddingVertical: 14, marginTop: 20 },
    logoutText: { fontSize: 14, fontWeight: "800", color: t.colors.error },
  });
