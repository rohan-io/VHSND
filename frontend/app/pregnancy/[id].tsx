import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { StatusBadge } from "@/src/components/StatusBadge";
import { TrimesterTimeline } from "@/src/components/TrimesterTimeline";
import { useToast } from "@/src/components/Toast";
import { LoadError } from "@/src/components/LoadError";
import { useArmConfirm } from "@/src/hooks/use-arm-confirm";
import { isTrulyDelivered } from "@/src/utils/pregnancy";
import { getPregnancy, completeMaternalImm, markPmsmaAttended } from "@/src/api/mch";
import { ANCVisit, MaternalImmunization, PregnancyRecord, ChildRecord } from "@/src/types";
import { useAuth } from "@/src/context/AuthContext";
import { isAdmin } from "@/src/utils/roles";
import { pmsmaStatus } from "@/src/utils/pmsma";

type Tab = "visits" | "vaccines" | "vitals";

export default function PregnancyDetailScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const { user } = useAuth();
  // Admin role is monitor/escalate/notify only — this screen stays fully
  // viewable (history, vitals, RCN card, risk factors) but its two write
  // actions (Record ANC Visit, Mark Administered) are gated at the point of
  // action below, not just hidden.
  const readOnly = isAdmin(user);

  const [pregnancy, setPregnancy] = useState<PregnancyRecord | null>(null);
  const [visits, setVisits] = useState<ANCVisit[]>([]);
  const [imms, setImms] = useState<MaternalImmunization[]>([]);
  const [children, setChildren] = useState<ChildRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("visits");
  const [slipFull, setSlipFull] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pmsmaBusy, setPmsmaBusy] = useState(false);
  const { armedId, confirm } = useArmConfirm();

  const load = useCallback(async () => {
    if (!id) return;
    setLoadFailed(false);
    try {
      const res = await getPregnancy(id);
      setPregnancy(res.pregnancy);
      setVisits(res.visits);
      setImms(res.immunizations);
      setChildren(res.children);
    } catch (e: any) {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const markImm = async (immId: string) => {
    if (!id || readOnly) return; // point-of-action guard
    setBusyId(immId);
    try {
      await completeMaternalImm(id, immId);
      showToast(tr.pregnancyDetail.toastAncSaved, "success");
      await load();
    } catch (e: any) {
      showToast(e.message || tr.pregnancyDetail.toastAncFailed, "error");
    } finally {
      setBusyId(null);
    }
  };

  const markPmsma = async () => {
    if (!id || readOnly) return; // point-of-action guard
    setPmsmaBusy(true);
    try {
      const updated = await markPmsmaAttended(id);
      setPregnancy(updated);
      showToast(tr.pmsmaScreen.markedToast, "success");
    } catch (e: any) {
      showToast(e.message || "Failed to update.", "error");
    } finally {
      setPmsmaBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title={tr.pregnancyDetail.title} showBack showOfflineToggle={false} />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={t.colors.brand} />
        </View>
      </View>
    );
  }

  if (loadFailed) {
    return (
      <View style={styles.root}>
        <Header title={tr.pregnancyDetail.title} showBack showOfflineToggle={false} />
        <LoadError onRetry={() => { setLoading(true); load(); }} testID="pregnancy-detail-error" />
      </View>
    );
  }

  if (!pregnancy) {
    return (
      <View style={styles.root}>
        <Header title={tr.pregnancyDetail.title} showBack showOfflineToggle={false} />
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>{tr.pregnancyDetail.notFound}</Text>
        </View>
      </View>
    );
  }

  const p = pregnancy;
  const delivered = isTrulyDelivered(p);

  return (
    <View style={styles.root}>
      <Header title={tr.pregnancyDetail.title} showBack showOfflineToggle={false} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile banner */}
        <View style={styles.banner}>
          <View style={styles.bannerTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{p.full_name?.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{p.full_name}</Text>
              <Text style={styles.sub} numberOfLines={1}>{tr.pregnancyDetail.wifeOf} {p.husband_name} • {tr.pregnancyDetail.age} {p.age} • {p.blood_group}</Text>
              <Text style={styles.sub}>{p.beneficiary_id}</Text>
            </View>
          </View>
          <View style={styles.bannerMeta}>
            <View style={styles.metaChip}><Ionicons name="call" size={12} color={t.colors.brandDark} /><Text style={styles.metaChipText}>{p.mobile_number}</Text></View>
            <View style={styles.metaChip}><Ionicons name="location" size={12} color={t.colors.brandDark} /><Text style={styles.metaChipText}>{p.village}, {p.block}</Text></View>
            {delivered ? (
              <View style={[styles.metaChip, styles.deliveredChip]} testID="pregnancy-delivered-chip">
                <Ionicons name="checkmark-circle" size={12} color={t.colors.successText} />
                <Text style={[styles.metaChipText, { color: t.colors.successText }]}>{tr.pregnancyDetail.deliveredYes}</Text>
              </View>
            ) : (
              <View style={[styles.metaChip, styles.notDeliveredChip]} testID="pregnancy-delivered-chip">
                <Ionicons name="ellipse-outline" size={12} color={t.colors.textMuted} />
                <Text style={[styles.metaChipText, { color: t.colors.textMuted }]}>{tr.pregnancyDetail.deliveredNo}</Text>
              </View>
            )}
            {!delivered && (
              pmsmaStatus(p.last_pmsma_check_date) === "epmsma" ? (
                <View testID="pregnancy-pmsma-chip" style={[styles.metaChip, styles.pmsmaMissedChip]}>
                  <Ionicons name="alert-circle" size={12} color={t.colors.errorText} />
                  <Text style={[styles.metaChipText, { color: t.colors.errorText }]}>{tr.dashboard.epmsma}</Text>
                </View>
              ) : (
                <View testID="pregnancy-pmsma-chip" style={[styles.metaChip, styles.deliveredChip]}>
                  <Ionicons name="checkmark-circle" size={12} color={t.colors.successText} />
                  <Text style={[styles.metaChipText, { color: t.colors.successText }]}>{tr.dashboard.pmsma}</Text>
                </View>
              )
            )}
          </View>
          {p.is_high_risk && (
            <View style={styles.riskBanner}>
              <Ionicons name="warning" size={15} color={t.colors.errorText} />
              <Text style={styles.riskBannerText}>
                {tr.pregnancyDetail.highRiskPrefix} {(p.high_risk_reasons || []).join(", ") || tr.pregnancyDetail.highRiskFallback}
              </Text>
            </View>
          )}
        </View>

        {/* Trimester Timeline */}
        <TrimesterTimeline
          currentTrimester={p.trimester}
          gestationalWeeks={p.gestational_weeks}
          gestationalDays={p.gestational_days}
          edd={p.edd}
        />

        {/* Action buttons. "Register Child" entry point intentionally removed
            while the Children section is hidden from navigation. Admin role
            is monitor/escalate/notify only — no write actions here. */}
        {!readOnly && (
          <View style={styles.actionRow}>
            <Pressable
              testID="record-anc-btn"
              onPress={() => router.push(`/anc/record?pregnancyId=${p.id}&visitNumber=${visits.length + 1}` as any)}
              style={styles.primaryAction}
            >
              <Ionicons name="clipboard" size={16} color={t.colors.onBrand} />
              <Text style={styles.primaryActionText}>{tr.pregnancyDetail.recordAncVisit}</Text>
            </Pressable>
            <Pressable
              testID="mark-pmsma-btn"
              onPress={markPmsma}
              disabled={pmsmaBusy}
              style={styles.secondaryAction}
            >
              {pmsmaBusy ? (
                <ActivityIndicator color={t.colors.brandDark} />
              ) : (
                <>
                  <Ionicons name="calendar" size={16} color={t.colors.brandDark} />
                  <Text style={styles.secondaryActionText}>{tr.pmsmaScreen.markAttended}</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabBar}>
          {([["visits", tr.pregnancyDetail.tabVisits], ["vaccines", tr.pregnancyDetail.tabVaccines], ["vitals", tr.pregnancyDetail.tabVitals]] as [Tab, string][]).map(([key, label]) => (
            <Pressable key={key} testID={`detail-tab-${key}`} onPress={() => setTab(key)} style={[styles.tabBtn, tab === key && styles.tabBtnActive]}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "visits" && (
          <View>
            {visits.length === 0 ? (
              <Text style={styles.emptyText}>{tr.pregnancyDetail.noVisits}</Text>
            ) : (
              visits.map((v) => (
                <View key={v.id} style={styles.recordCard} testID={`anc-visit-${v.id}`}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordTitle}>{tr.pregnancyDetail.ancVisitNo}{v.visit_number}</Text>
                    <StatusBadge status={v.status} />
                  </View>
                  <Text style={styles.recordSub}>{v.visit_date} • {v.gestational_weeks_at_visit} {tr.pregnancyDetail.weeksSuffix}</Text>
                  {v.bp_systolic != null || v.weight != null || v.hemoglobin != null ? (
                    <View style={styles.vitalGrid}>
                      <View style={styles.vitalItem}><Text style={styles.vitalLabel}>{tr.pregnancyDetail.vBp}</Text><Text style={styles.vitalVal}>{v.bp_systolic ?? "—"}/{v.bp_diastolic ?? "—"}</Text></View>
                      <View style={styles.vitalItem}><Text style={styles.vitalLabel}>{tr.pregnancyDetail.vWeight}</Text><Text style={styles.vitalVal}>{v.weight != null ? `${v.weight} kg` : "—"}</Text></View>
                      <View style={styles.vitalItem}><Text style={styles.vitalLabel}>{tr.pregnancyDetail.vHb}</Text><Text style={styles.vitalVal}>{v.hemoglobin != null ? `${v.hemoglobin} g/dL` : "—"}</Text></View>
                      <View style={styles.vitalItem}><Text style={styles.vitalLabel}>{tr.pregnancyDetail.vFhr}</Text><Text style={styles.vitalVal}>{v.fetal_heart_rate ?? "—"}</Text></View>
                    </View>
                  ) : null}
                  {v.risk_status === "High Risk" ? (
                    <View style={styles.visitRiskChip}>
                      <Ionicons name="warning" size={12} color={t.colors.errorText} />
                      <Text style={styles.visitRiskChipText}>{tr.status.highRisk}</Text>
                    </View>
                  ) : null}
                  {v.advice ? (
                    <View style={styles.adviceRow}>
                      <Ionicons name="chatbubble-ellipses-outline" size={13} color={t.colors.textMuted} />
                      <Text style={styles.advice}>{v.advice}</Text>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}

        {tab === "vaccines" && (
          <View>
            <Text style={styles.demoNote}>{tr.pregnancyDetail.vaccineDemoNote}</Text>
            {imms.map((im) => {
              const armed = armedId === im.id;
              return (
                <View key={im.id} style={styles.recordCard} testID={`mat-imm-${im.id}`}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordTitle} numberOfLines={1}>{im.vaccine_name}</Text>
                    <StatusBadge status={im.status} />
                  </View>
                  <Text style={styles.recordSub}>{im.dose} • {tr.pregnancyDetail.doseDuePrefix} {im.due_date}</Text>
                  <Text style={styles.recordDesc}>{im.description}</Text>
                  {im.status !== "Completed" && im.status !== "Upcoming" && !readOnly && (
                    <Pressable
                      testID={`complete-mat-imm-${im.id}`}
                      onPress={() => { if (confirm(im.id)) markImm(im.id); }}
                      disabled={busyId === im.id}
                      style={[styles.markBtn, armed && styles.markBtnArmed]}
                    >
                      {busyId === im.id ? (
                        <ActivityIndicator size="small" color={t.colors.onStatus} />
                      ) : (
                        <>
                          <Ionicons
                            name={armed ? "checkmark-done-circle" : "checkmark-circle"}
                            size={15}
                            color={armed ? t.colors.onWarning : t.colors.onStatus}
                          />
                          <Text style={[styles.markBtnText, armed && { color: t.colors.onWarning }]}>
                            {armed ? tr.pregnancyDetail.tapToConfirm : tr.pregnancyDetail.markAdministered}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                  {im.status === "Completed" && im.administration_date ? (
                    <View style={styles.givenRow}>
                      <Ionicons name="checkmark-circle" size={13} color={t.colors.successText} />
                      <Text style={styles.givenText}>{tr.pregnancyDetail.givenOn} {im.administration_date} • {tr.pregnancyDetail.batch} {im.batch_number || "—"}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {tab === "vitals" && (
          <View>
            {/* RCN Card photo (no OCR — stored image only) */}
            <View style={styles.recordCard}>
              <Text style={styles.vitalsSectionTitle}>{tr.pregnancyDetail.rcnCardLabel}</Text>
              {p.health_slip_uri ? (
                <Pressable testID="vitals-slip-thumb" onPress={() => setSlipFull(true)} style={styles.slipThumbWrap}>
                  <Image source={{ uri: p.health_slip_uri }} style={styles.slipThumb} resizeMode="cover" />
                  <View style={styles.slipThumbHint}>
                    <Ionicons name="expand" size={12} color={t.colors.onStatus} />
                    <Text style={styles.slipThumbHintText}>{tr.pregnancyDetail.viewFullSlip}</Text>
                  </View>
                </Pressable>
              ) : (
                <Text style={styles.emptyLine}>{tr.pregnancyDetail.noRcnCard}</Text>
              )}
            </View>

            {/* Flagged risk factors + Critical determination */}
            <View style={styles.recordCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{tr.pregnancyDetail.criticalPregnancy}</Text>
                <Text
                  testID="vitals-critical-value"
                  style={[styles.infoVal, { color: p.is_high_risk ? t.colors.errorText : t.colors.successText }]}
                >
                  {p.is_high_risk ? tr.riskFactors.criticalYes : tr.riskFactors.criticalNo}
                </Text>
              </View>
              <Text style={[styles.vitalsSectionTitle, { marginTop: 12 }]}>{tr.pregnancyDetail.flaggedFactors}</Text>
              {(p.high_risk_reasons || []).length === 0 ? (
                <Text style={styles.emptyLine}>{tr.pregnancyDetail.noFlaggedFactors}</Text>
              ) : (
                (p.high_risk_reasons || []).map((r) => (
                  <View key={r} style={styles.flagRow} testID="vitals-flagged-factor">
                    <Ionicons name="warning" size={15} color={t.colors.errorText} />
                    <Text style={styles.flagRowText}>{r}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Record particulars (no numeric vitals) */}
            <View style={styles.recordCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{tr.pregnancyDetail.delivered}</Text>
                <Text testID="vitals-delivered-value" style={styles.infoVal}>
                  {delivered ? tr.pregnancyDetail.deliveredYes : tr.pregnancyDetail.deliveredNo}
                </Text>
              </View>
              {delivered && p.delivery_details ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{tr.pregnancyDetail.deliveryDate}</Text>
                    <Text style={styles.infoVal}>{p.delivery_details.date || "—"}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{tr.pregnancyDetail.deliveryOutcome}</Text>
                    <Text style={styles.infoVal}>{p.delivery_details.outcome || "—"}</Text>
                  </View>
                </>
              ) : null}
              {[
                [tr.pregnancyDetail.gravidaPara, `G${p.gravida} P${p.para}`],
                [tr.pregnancyDetail.bloodGroup, p.blood_group || "—"],
                [tr.pregnancyDetail.lmp, p.lmp],
                [tr.pregnancyDetail.registrationDate, p.registration_date || "—"],
                [tr.pregnancyDetail.allergies, p.allergies || tr.pregnancyDetail.none],
                [tr.pregnancyDetail.assignedWorker, p.assigned_worker_name || "—"],
              ].map(([label, val], i) => (
                <View key={i} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoVal}>{val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {children.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.sectionTitle}>{tr.pregnancyDetail.linkedChildren}</Text>
            {children.map((c) => (
              <Pressable key={c.id} testID={`linked-child-${c.id}`} onPress={() => router.push(`/child/${c.id}` as any)} style={styles.childLink}>
                <Ionicons name="people-outline" size={18} color={t.colors.info} />
                <Text style={styles.childLinkText}>{c.child_name} • {c.age_label}</Text>
                <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={slipFull} transparent animationType="fade" onRequestClose={() => setSlipFull(false)}>
        <Pressable testID="slip-full-overlay" style={styles.slipModalBg} onPress={() => setSlipFull(false)}>
          {p.health_slip_uri ? (
            <Image source={{ uri: p.health_slip_uri }} style={styles.slipFull} resizeMode="contain" />
          ) : null}
          <Pressable style={styles.slipCloseBtn} onPress={() => setSlipFull(false)}>
            <Ionicons name="close" size={22} color={t.colors.onStatus} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 40 },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
    emptyText: { fontSize: 13, color: t.colors.textSecondary, textAlign: "center", padding: 16 },
    banner: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.lg, padding: 16, borderWidth: 1, borderColor: t.colors.border, marginBottom: 12 },
    bannerTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: t.colors.brandLight, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 20, fontWeight: "800", color: t.colors.brandDark },
    name: { fontSize: 17, fontWeight: "800", color: t.colors.textPrimary },
    sub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 1 },
    bannerMeta: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: t.colors.brandLight, paddingHorizontal: 8, paddingVertical: 5, borderRadius: t.radius.sm },
    metaChipText: { fontSize: 12, fontWeight: "700", color: t.colors.brandDark },
    deliveredChip: { backgroundColor: t.colors.successLight },
    notDeliveredChip: { backgroundColor: t.colors.surfaceTertiary },
    pmsmaMissedChip: { backgroundColor: t.colors.errorLight },
    riskBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.colors.errorLight, borderRadius: t.radius.sm, padding: 12, marginTop: 12 },
    riskBannerText: { flex: 1, fontSize: 13, fontWeight: "700", color: t.colors.errorText },
    actionRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
    primaryAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: t.colors.brand, borderRadius: t.radius.md, paddingVertical: 12 },
    primaryActionText: { color: t.colors.onBrand, fontSize: 13, fontWeight: "700" },
    secondaryAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: t.colors.brandLight, borderRadius: t.radius.md, paddingVertical: 12 },
    secondaryActionText: { color: t.colors.brandDark, fontSize: 13, fontWeight: "700" },
    tabBar: { flexDirection: "row", backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.md, padding: 4, marginBottom: 14 },
    tabBtn: { flex: 1, paddingVertical: 12, borderRadius: t.radius.sm, alignItems: "center" },
    tabBtnActive: { backgroundColor: t.colors.surfaceSecondary, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    tabText: { fontSize: 12, fontWeight: "700", color: t.colors.textSecondary },
    tabTextActive: { color: t.colors.brandText },
    recordCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.colors.border },
    recordHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
    recordTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    recordSub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 3 },
    recordDesc: { fontSize: 12, color: t.colors.textMuted, marginTop: 4 },
    vitalGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.sm, padding: 10 },
    vitalItem: { alignItems: "center" },
    vitalLabel: { fontSize: 12, color: t.colors.textMuted, fontWeight: "700" },
    vitalVal: { fontSize: 14, color: t.colors.textPrimary, fontWeight: "800", marginTop: 2 },
    adviceRow: { flexDirection: "row", gap: 6, marginTop: 8, alignItems: "flex-start" },
    advice: { flex: 1, fontSize: 12, color: t.colors.textSecondary, lineHeight: 17 },
    demoNote: { fontSize: 12, color: t.colors.textMuted, fontStyle: "italic", marginBottom: 10 },
    markBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: t.colors.success, borderRadius: t.radius.sm, paddingVertical: 12, marginTop: 10 },
    markBtnArmed: { backgroundColor: t.colors.warning },
    markBtnText: { color: t.colors.onStatus, fontSize: 13, fontWeight: "700" },
    givenRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
    givenText: { flex: 1, fontSize: 12, color: t.colors.successText, fontWeight: "700" },
    infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.colors.divider, gap: 12 },
    infoLabel: { fontSize: 12, color: t.colors.textSecondary, fontWeight: "600" },
    infoVal: { fontSize: 12, color: t.colors.textPrimary, fontWeight: "700", flex: 1, textAlign: "right" },
    reasonRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.colors.divider },
    reasonText: { fontSize: 12, color: t.colors.errorText, fontWeight: "600", lineHeight: 17 },
    vitalsSectionTitle: { fontSize: 12, fontWeight: "800", color: t.colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 },
    emptyLine: { fontSize: 13, color: t.colors.textMuted, paddingVertical: 4 },
    slipThumbWrap: { alignSelf: "flex-start", borderRadius: t.radius.sm, overflow: "hidden", borderWidth: 1, borderColor: t.colors.border },
    slipThumb: { width: 150, height: 200, backgroundColor: t.colors.surfaceTertiary },
    slipThumbHint: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 4 },
    slipThumbHintText: { fontSize: 11, fontWeight: "700", color: t.colors.onStatus },
    flagRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: t.colors.divider },
    flagRowText: { flex: 1, fontSize: 12, fontWeight: "600", color: t.colors.textPrimary, lineHeight: 17 },
    visitRiskChip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: t.colors.errorLight, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginTop: 8 },
    visitRiskChipText: { fontSize: 11, fontWeight: "800", color: t.colors.errorText },
    slipModalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center" },
    slipFull: { width: "92%", height: "80%" },
    slipCloseBtn: { position: "absolute", top: 48, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    sectionTitle: { fontSize: 14, fontWeight: "800", color: t.colors.textPrimary, marginBottom: 10 },
    childLink: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: t.colors.border },
    childLinkText: { flex: 1, fontSize: 13, fontWeight: "700", color: t.colors.textPrimary },
  });
