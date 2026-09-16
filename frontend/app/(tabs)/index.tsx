import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { MetricCard } from "@/src/components/MetricCard";
import { LoadError } from "@/src/components/LoadError";
import { ChatAssistant } from "@/src/components/ChatAssistant";
import { useAuth } from "@/src/context/AuthContext";
import { useOfflineSync } from "@/src/context/OfflineSyncContext";
import { getDashboard, DashboardResponse, getSupervisedTeam } from "@/src/api/mch";
import { priorityColor } from "@/src/utils/priority";
import { priorityLabel } from "@/src/i18n/strings";
import type { SupervisedTeamResponse } from "@/src/types";

// Keep the dashboard preview short; the full list lives on the Alerts screen.
const CRITICAL_PREVIEW = 4;

export default function DashboardScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const PRIORITY_COLOR = useMemo(() => priorityColor(t), [t]);
  const QUICK_ACTIONS = useMemo(
    // "Register Child" removed while the Children section is hidden from navigation.
    () => [
      { key: "reg-preg", label: tr.dashboard.qaRegisterPregnancy, icon: "add-circle" as const, route: "/pregnancy/register", color: t.colors.brandText },
      { key: "anc", label: tr.dashboard.qaRecordAnc, icon: "clipboard" as const, route: "/pregnancy", color: t.colors.warning },
      { key: "sync", label: tr.dashboard.qaSyncCenter, icon: "sync-circle" as const, route: "/sync", color: t.colors.success },
    ],
    [t, tr],
  );
  const { user } = useAuth();
  const { pendingCount, lastSyncTime } = useOfflineSync();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCaseload, setShowCaseload] = useState(false);

  // ANM supervisory view over her ASHAs — a separate fetch from her own
  // dashboard data above, gated to worker_type "ANM" so it's a no-op for ASHA.
  const isAnm = user?.worker_type === "ANM";
  const [team, setTeam] = useState<SupervisedTeamResponse | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getDashboard();
      setData(res);
    } catch (e: any) {
      setError(e.message || tr.dashboard.loadFailed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    if (!isAnm || !user) return;
    setTeamLoading(true);
    try {
      setTeamError(null);
      setTeam(await getSupervisedTeam(user.id));
    } catch (e: any) {
      setTeamError(e.message || tr.supervisedTeam.loadFailed);
    } finally {
      setTeamLoading(false);
    }
  }, [isAnm, user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
      loadTeam();
    }, [load, loadTeam])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const s = data?.summary || {};

  return (
    <View style={styles.root}>
      <Header subtitle={user ? `${user.name}` : undefined} />

      {loading ? (
        <View style={styles.centerFill} testID="dashboard-loading">
          <ActivityIndicator size="large" color={t.colors.brand} />
          <Text style={styles.loadingText}>{tr.dashboard.loading}</Text>
        </View>
      ) : error ? (
        <LoadError message={error} onRetry={load} testID="dashboard-error" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.brand} />
          }
        >
          {/* Context strip: where you are, whether your data is current */}
          <View style={styles.greetBanner}>
            <View style={styles.greetText}>
              <Text style={styles.greetPlace} numberOfLines={2}>{user?.phc_center || tr.dashboard.fallbackPhc}</Text>
              <Text style={styles.greetSector} numberOfLines={1}>{user?.sector || tr.dashboard.fallbackArea}</Text>
            </View>
            <View style={styles.syncChip}>
              <Ionicons name="time-outline" size={12} color={t.colors.brandDark} />
              <Text style={styles.syncChipText}>{tr.common.syncedAt} {lastSyncTime || "—"}</Text>
            </View>
          </View>

          {pendingCount > 0 && (
            <Pressable
              testID="dashboard-pending-sync-banner"
              onPress={() => router.push("/sync")}
              style={styles.pendingBanner}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={t.colors.warningText} />
              <Text style={styles.pendingText}>
                {pendingCount} {tr.dashboard.recordsWaiting}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={t.colors.warningText} />
            </Pressable>
          )}

          {/* HIGHEST PRIORITY: critical pregnancies needing follow-up. Sits above
              everything else — this is the single most important thing on screen. */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitleFlush, { color: t.colors.errorText }]}>{tr.dashboard.criticalFollowUp}</Text>
            {(data?.critical_pregnancies || []).length > 0 && (
              <View style={styles.criticalCountPill}>
                <Text style={styles.criticalCountText}>{(data?.critical_pregnancies || []).length}</Text>
              </View>
            )}
          </View>
          {(data?.critical_pregnancies || []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color={t.colors.success} />
              <Text style={styles.emptyText}>{tr.dashboard.noCritical}</Text>
            </View>
          ) : (
            <>
              {(data?.critical_pregnancies || []).slice(0, CRITICAL_PREVIEW).map((cp) => (
                <Pressable
                  key={cp.id}
                  testID={`dashboard-critical-${cp.id}`}
                  onPress={() => router.push(`/pregnancy/${cp.id}` as any)}
                  style={styles.criticalRow}
                >
                  <Ionicons name="warning" size={20} color={t.colors.onStatus} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.criticalName} numberOfLines={1}>{cp.full_name}</Text>
                    <Text style={styles.criticalSub} numberOfLines={1}>{cp.village} • {cp.gestational_age_label}</Text>
                    {(cp.high_risk_reasons || []).length > 0 && (
                      <Text style={styles.criticalReasons} numberOfLines={2}>
                        {(cp.high_risk_reasons || []).slice(0, 2).join(" · ")}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={t.colors.onStatus} />
                </Pressable>
              ))}
              <Pressable
                testID="dashboard-critical-view-all"
                onPress={() => router.push("/alerts?seg=escalations" as any)}
                style={styles.criticalViewAll}
              >
                <Text style={styles.criticalViewAllText}>
                  {tr.common.viewAll} ({(data?.critical_pregnancies || []).length})
                </Text>
                <Ionicons name="arrow-forward" size={15} color={t.colors.errorText} />
              </Pressable>
            </>
          )}

          {/* LEAD: today's priority alerts */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleFlush}>{tr.dashboard.priorityAlerts}</Text>
            <Pressable testID="dashboard-view-all-alerts" onPress={() => router.push("/alerts")} hitSlop={8}>
              <Text style={styles.viewAll}>{tr.common.viewAll}</Text>
            </Pressable>
          </View>
          {(data?.todays_alerts || []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color={t.colors.success} />
              <Text style={styles.emptyText}>{tr.dashboard.allUpToDate}</Text>
            </View>
          ) : (
            (data?.todays_alerts || []).slice(0, 5).map((al) => (
              <Pressable
                key={al.id}
                testID={`dashboard-alert-${al.id}`}
                onPress={() =>
                  al.related_entity_type === "pregnancy"
                    ? router.push(`/pregnancy/${al.related_entity_id}` as any)
                    : router.push(`/child/${al.related_entity_id}` as any)
                }
                style={styles.alertRow}
              >
                <Ionicons name="alert-circle" size={18} color={PRIORITY_COLOR[al.priority] || t.colors.info} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle} numberOfLines={1}>{al.title}</Text>
                  <Text style={styles.alertMsg} numberOfLines={2}>{al.message}</Text>
                </View>
                <View style={[styles.priorityPill, { backgroundColor: `${PRIORITY_COLOR[al.priority]}18` }]}>
                  <Text style={[styles.priorityText, { color: PRIORITY_COLOR[al.priority] }]}>{priorityLabel(al.priority, tr)}</Text>
                </View>
              </Pressable>
            ))
          )}

          {/* Needs attention: the visit worklist, one grouping instead of three.
              (High-risk count card removed — the critical section above supersedes it.) */}
          <Text style={styles.sectionTitle}>{tr.dashboard.needsAttention}</Text>
          <View style={styles.grid}>
            <MetricCard testID="metric-anc-due" title={tr.dashboard.ancDue} value={s.anc_due ?? 0} icon="calendar" color={t.colors.warning} onPress={() => router.push("/pregnancy")} />
            <MetricCard testID="metric-anc-overdue" title={tr.dashboard.ancOverdue} value={s.anc_overdue ?? 0} icon="calendar-clear" color={t.colors.error} onPress={() => router.push("/pregnancy")} />
          </View>
          <View style={styles.grid}>
            <MetricCard testID="metric-mat-vaccine-due" title={tr.dashboard.matVaccineDue} value={s.maternal_vaccine_due ?? 0} icon="medkit" color={t.colors.warning} />
            <MetricCard testID="metric-mat-vaccine-overdue" title={tr.dashboard.matVaccineOverdue} value={s.maternal_vaccine_overdue ?? 0} icon="medkit" color={t.colors.error} />
          </View>
          <View style={styles.grid}>
            {/* PMSMA (9th-of-the-month ANC camp) — replaces the old Child Vaccines due/overdue pair. */}
            <MetricCard testID="metric-pmsma" title={tr.dashboard.pmsma} value={s.pmsma_ontrack ?? 0} icon="calendar" color={t.colors.success} onPress={() => router.push("/pmsma" as any)} />
            <MetricCard testID="metric-epmsma" title={tr.dashboard.epmsma} value={s.pmsma_missed ?? 0} icon="calendar" color={t.colors.error} onPress={() => router.push("/pmsma" as any)} />
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>{tr.dashboard.quickActions}</Text>
          <View style={styles.actionRow}>
            {QUICK_ACTIONS.map((a) => (
              <Pressable
                key={a.key}
                testID={`quick-action-${a.key}`}
                onPress={() => router.push(a.route as any)}
                style={({ pressed }) => [styles.actionTile, pressed && styles.pressed]}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${a.color}18` }]}>
                  <Ionicons name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Recent Registrations */}
          <Text style={styles.sectionTitle}>{tr.dashboard.recentRegistrations}</Text>
          {(data?.recent_pregnancies || []).slice(0, 4).map((p) => (
            <Pressable
              key={p.id}
              testID={`recent-preg-${p.id}`}
              onPress={() => router.push(`/pregnancy/${p.id}` as any)}
              style={styles.recentRow}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{p.full_name?.charAt(0) || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentName} numberOfLines={1}>{p.full_name}</Text>
                <Text style={styles.recentSub} numberOfLines={1}>{p.village} • {p.gestational_age_label}</Text>
              </View>
              {p.is_high_risk && (
                <Ionicons name="warning" size={18} color={t.colors.error} />
              )}
              <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
            </Pressable>
          ))}

          {/* ANM supervisory view — separate from her own worklist above.
              Read-only: view her ASHAs' work, never act on their behalf. */}
          {isAnm && (
            <View testID="supervised-team-section">
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitleFlush}>{tr.supervisedTeam.title}</Text>
              </View>
              <Text style={styles.teamSubtitle}>{tr.supervisedTeam.subtitle}</Text>

              {teamError ? (
                <LoadError message={teamError} onRetry={loadTeam} testID="supervised-team-error" />
              ) : teamLoading && !team ? (
                <View style={styles.teamLoadingRow}>
                  <ActivityIndicator color={t.colors.brand} />
                </View>
              ) : (
                <>
                  <View style={styles.rosterCard} testID="supervised-team-card">
                    {(team?.ashas || []).length === 0 ? (
                      <Text style={styles.emptyMuted} testID="supervised-team-empty">{tr.supervisedTeam.empty}</Text>
                    ) : (
                      team!.ashas.map((a, i) => {
                        const noActivity = !a.registered_pregnancies && !a.anc_visits_conducted && !a.children_covered;
                        return (
                          <View
                            key={a.worker_id}
                            testID={`supervised-asha-${a.worker_id}`}
                            style={[styles.rosterRow, i > 0 && styles.rosterRowDivider, noActivity && styles.rosterRowMuted]}
                          >
                            <View style={[styles.rosterAvatar, noActivity && styles.rosterAvatarMuted]}>
                              <Text style={styles.rosterAvatarText}>{a.name.charAt(0)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.rosterName} numberOfLines={1}>{a.name}</Text>
                              <Text style={styles.rosterSector} numberOfLines={1}>{a.sector}</Text>
                            </View>
                            {noActivity ? (
                              <Text style={styles.rosterNoActivity}>{tr.adminDashboard.noActivity}</Text>
                            ) : (
                              <View style={styles.rosterStats}>
                                <View style={styles.rStat}>
                                  <Text style={styles.rStatNum}>{a.registered_pregnancies}</Text>
                                  <Text style={styles.rStatLabel}>{tr.adminDashboard.wpPregnancies}</Text>
                                </View>
                                <View style={styles.rStat}>
                                  <Text style={styles.rStatNum}>{a.anc_visits_conducted}</Text>
                                  <Text style={styles.rStatLabel}>{tr.adminDashboard.wpAncVisits}</Text>
                                </View>
                                <View style={styles.rStat}>
                                  <Text style={styles.rStatNum}>{a.children_covered}</Text>
                                  <Text style={styles.rStatLabel}>{tr.adminDashboard.wpChildren}</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>

                  <Text style={styles.sectionTitle}>{tr.supervisedTeam.escalationsTitle}</Text>
                  {(team?.critical_escalations || []).length === 0 ? (
                    <View style={styles.emptyCard} testID="supervised-escalations-empty">
                      <Ionicons name="checkmark-circle-outline" size={22} color={t.colors.success} />
                      <Text style={styles.emptyText}>{tr.supervisedTeam.escalationsEmpty}</Text>
                    </View>
                  ) : (
                    team!.critical_escalations.map((a) => (
                      <Pressable
                        key={a.id}
                        testID={`supervised-escalation-${a.id}`}
                        onPress={() => router.push(`/pregnancy/${a.related_entity_id}` as any)}
                        style={styles.criticalRow}
                      >
                        <Ionicons name="warning" size={20} color={t.colors.onStatus} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.criticalName} numberOfLines={1}>{a.title}</Text>
                          <Text style={styles.criticalSub} numberOfLines={2}>{a.message}</Text>
                          <Text style={styles.criticalReasons} numberOfLines={1}>
                            {tr.alerts.assignedPrefix} {a.assigned_worker_name || "—"}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={t.colors.onStatus} />
                      </Pressable>
                    ))
                  )}
                </>
              )}
            </View>
          )}

          {/* Caseload overview: reference numbers, collapsed by default so the
              screen leads with work, not statistics */}
          <Pressable
            testID="dashboard-caseload-toggle"
            onPress={() => setShowCaseload((v) => !v)}
            style={styles.caseloadHeader}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitleFlush}>{tr.dashboard.caseloadOverview}</Text>
              {!showCaseload && (
                <Text style={styles.caseloadSummary}>
                  {s.total_pregnancies ?? 0} {tr.common.dashCaseloadPregnancies} • {s.total_children ?? 0} {tr.common.dashCaseloadChildren}
                </Text>
              )}
            </View>
            <Ionicons
              name={showCaseload ? "chevron-up" : "chevron-down"}
              size={18}
              color={t.colors.textMuted}
            />
          </Pressable>
          {showCaseload && (
            <View style={styles.caseloadBody}>
              <View style={styles.grid}>
                <MetricCard testID="metric-total-pregnancies" title={tr.dashboard.totalPregnancies} value={s.total_pregnancies ?? 0} icon="woman" color={t.colors.brandText} onPress={() => router.push("/pregnancy")} />
                <MetricCard testID="metric-children" title={tr.dashboard.registeredChildren} value={s.total_children ?? 0} icon="body" color={t.colors.brandText} onPress={() => router.push("/children")} />
              </View>
              <View style={styles.grid}>
                <MetricCard testID="metric-trimester-1" title={tr.dashboard.trimester1} value={s.trimester_1 ?? 0} icon="ellipse-outline" color={t.colors.brandDark} />
                <MetricCard testID="metric-trimester-2" title={tr.dashboard.trimester2} value={s.trimester_2 ?? 0} icon="contrast" color={t.colors.brandText} />
                <MetricCard testID="metric-trimester-3" title={tr.dashboard.trimester3} value={s.trimester_3 ?? 0} icon="ellipse" color={t.colors.brandSecondaryText} />
              </View>
            </View>
          )}

          <View style={styles.disclaimerBox}>
            <Ionicons name="shield-checkmark-outline" size={14} color={t.colors.textMuted} />
            <Text style={styles.disclaimerText}>
              {tr.dashboard.immDisclaimer}
            </Text>
          </View>
        </ScrollView>
      )}

      <ChatAssistant />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 32 },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
    loadingText: { color: t.colors.textSecondary, fontSize: 13, marginTop: 8 },
    greetBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: t.colors.heroPanel,
      borderRadius: t.radius.lg,
      padding: 16,
      marginBottom: 4,
    },
    greetText: { flex: 1 },
    greetPlace: { color: t.colors.onHeroPanel, fontSize: 15, fontWeight: "800", lineHeight: 20 },
    greetSector: { color: t.colors.onHeroPanelMuted, fontSize: 12, marginTop: 4 },
    syncChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: t.colors.brandLight, paddingHorizontal: 8, paddingVertical: 6, borderRadius: t.radius.sm },
    syncChipText: { fontSize: 12, fontWeight: "700", color: t.colors.brandDark },
    pendingBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: t.colors.warningLight,
      borderRadius: t.radius.md,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.colors.warningBorder,
    },
    pendingText: { flex: 1, fontSize: 12, fontWeight: "700", color: t.colors.warningText },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: t.colors.textPrimary, marginTop: 24, marginBottom: 10 },
    sectionTitleFlush: { fontSize: 15, fontWeight: "800", color: t.colors.textPrimary },
    sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 10 },
    viewAll: { fontSize: 12, fontWeight: "700", color: t.colors.brandText },
    caseloadHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24, paddingVertical: 6 },
    caseloadSummary: { fontSize: 12, color: t.colors.textSecondary, marginTop: 3 },
    caseloadBody: { marginTop: 8 },
    grid: { flexDirection: "row", gap: 8 },
    actionRow: { flexDirection: "row", gap: 8 },
    actionTile: {
      flex: 1,
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.md,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 6 },
    actionLabel: { fontSize: 12, fontWeight: "700", color: t.colors.textPrimary, textAlign: "center", lineHeight: 15 },
    emptyCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.successLight, borderRadius: t.radius.md, padding: 14 },
    emptyText: { fontSize: 12, color: t.colors.successText, fontWeight: "600" },
    alertRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.md,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    alertTitle: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    alertMsg: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    criticalCountPill: { backgroundColor: t.colors.error, borderRadius: 999, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
    criticalCountText: { color: t.colors.onStatus, fontSize: 12, fontWeight: "800" },
    criticalRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: t.colors.error, borderRadius: t.radius.md, padding: 12, marginBottom: 8 },
    criticalName: { fontSize: 14, fontWeight: "800", color: t.colors.onStatus },
    criticalSub: { fontSize: 12, color: t.colors.onStatus, opacity: 0.9, marginTop: 1 },
    criticalReasons: { fontSize: 12, color: t.colors.onStatus, opacity: 0.85, marginTop: 3, fontWeight: "600" },
    criticalViewAll: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: t.colors.errorLight, borderRadius: t.radius.md, paddingVertical: 11, marginTop: 2 },
    criticalViewAllText: { fontSize: 13, fontWeight: "800", color: t.colors.errorText },
    priorityPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5 },
    priorityText: { fontSize: 12, fontWeight: "800" },
    recentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.md,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    avatarCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.brandLight, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 15, fontWeight: "800", color: t.colors.brandDark },
    recentName: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    recentSub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 1 },
    disclaimerBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, paddingHorizontal: 4 },
    disclaimerText: { flex: 1, fontSize: 12, color: t.colors.textMuted, fontStyle: "italic" },

    // ANM supervisory section — roster styles mirror app/(admin)/index.tsx's
    // field-team panel so the same "who's active, who isn't" language reads
    // the same for an ANM's smaller team as it does for the district roster.
    teamSubtitle: { fontSize: 12, color: t.colors.textSecondary, marginTop: -4, marginBottom: 10 },
    teamLoadingRow: { alignItems: "center", paddingVertical: 20 },
    emptyMuted: { fontSize: 12, color: t.colors.textMuted, fontStyle: "italic", padding: 14 },
    rosterCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, overflow: "hidden" },
    rosterRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
    rosterRowDivider: { borderTopWidth: 1, borderTopColor: t.colors.divider },
    rosterRowMuted: { opacity: 0.6 },
    rosterAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.brandSecondaryLight, alignItems: "center", justifyContent: "center" },
    rosterAvatarMuted: { backgroundColor: t.colors.surfaceTertiary },
    rosterAvatarText: { fontSize: 14, fontWeight: "800", color: t.colors.brandSecondaryDark },
    rosterName: { fontSize: 13, fontWeight: "700", color: t.colors.textPrimary },
    rosterSector: { fontSize: 11, color: t.colors.textSecondary, marginTop: 1 },
    rosterNoActivity: { fontSize: 11, fontWeight: "700", color: t.colors.textMuted, fontStyle: "italic" },
    rosterStats: { flexDirection: "row", gap: 14 },
    rStat: { alignItems: "center" },
    rStatNum: { fontSize: 14, fontWeight: "800", color: t.colors.textPrimary },
    rStatLabel: { fontSize: 10, color: t.colors.textMuted, fontWeight: "700", marginTop: 1 },
  });
