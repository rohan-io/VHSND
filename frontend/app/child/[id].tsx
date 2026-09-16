import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { StatusBadge } from "@/src/components/StatusBadge";
import { useToast } from "@/src/components/Toast";
import { LoadError } from "@/src/components/LoadError";
import { useArmConfirm } from "@/src/hooks/use-arm-confirm";
import { getChild, completeChildImm } from "@/src/api/mch";
import { ChildImmunization, ChildRecord, PregnancyRecord } from "@/src/types";
import { useAuth } from "@/src/context/AuthContext";
import { isAdmin } from "@/src/utils/roles";

const FILTERS = ["All", "Due", "Overdue", "Completed", "Upcoming"];

export default function ChildDetailScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();
  const { user } = useAuth();
  // Admin role is monitor/escalate/notify only — no write action here.
  const readOnly = isAdmin(user);

  const [child, setChild] = useState<ChildRecord | null>(null);
  const [imms, setImms] = useState<ChildImmunization[]>([]);
  const [mother, setMother] = useState<PregnancyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { armedId, confirm } = useArmConfirm();

  const load = useCallback(async () => {
    if (!id) return;
    setLoadFailed(false);
    try {
      const res = await getChild(id);
      setChild(res.child);
      setImms(res.immunizations);
      setMother(res.mother);
    } catch (e: any) {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markDone = async (immId: string) => {
    if (!id || readOnly) return; // point-of-action guard
    setBusyId(immId);
    try {
      await completeChildImm(id, immId);
      showToast("Vaccination marked completed.", "success");
      await load();
    } catch (e: any) {
      showToast(e.message || "Failed to update.", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title="Child Record" showBack showOfflineToggle={false} />
        <View style={styles.centerFill}><ActivityIndicator size="large" color={t.colors.brand} /></View>
      </View>
    );
  }
  if (loadFailed) {
    return (
      <View style={styles.root}>
        <Header title="Child Record" showBack showOfflineToggle={false} />
        <LoadError onRetry={() => { setLoading(true); load(); }} testID="child-detail-error" />
      </View>
    );
  }

  if (!child) {
    return (
      <View style={styles.root}>
        <Header title="Child Record" showBack showOfflineToggle={false} />
        <View style={styles.centerFill}><Text style={styles.emptyText}>This record could not be found. It may have been removed.</Text></View>
      </View>
    );
  }

  const st = child.vaccine_stats;
  const filtered = filter === "All" ? imms : imms.filter((im) => im.status === filter);
  // A near-full green bar reads as "on track" — don't imply that while doses are overdue.
  const progressColor = (st?.overdue ?? 0) > 0 ? t.colors.warning : t.colors.success;
  const isFemale = child.gender === "Female";

  return (
    <View style={styles.root}>
      <Header title="Child Record" showBack showOfflineToggle={false} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <View style={styles.bannerTop}>
            <View style={[styles.avatar, { backgroundColor: isFemale ? t.colors.femaleTint : t.colors.maleTint }]}>
              <Ionicons name={isFemale ? "female" : "male"} size={22} color={isFemale ? t.colors.onFemaleTint : t.colors.onMaleTint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{child.child_name}</Text>
              <Text style={styles.sub}>{child.age_label} • {child.gender}</Text>
              <Text style={styles.sub}>{child.child_id}</Text>
            </View>
          </View>
          <View style={styles.bannerMeta}>
            <View style={styles.metaChip}><Ionicons name="woman" size={12} color={t.colors.brandDark} /><Text style={styles.metaChipText}>{child.mother_name}</Text></View>
            <View style={styles.metaChip}><Ionicons name="location" size={12} color={t.colors.brandDark} /><Text style={styles.metaChipText}>{child.village}</Text></View>
            <View style={styles.metaChip}><Ionicons name="calendar" size={12} color={t.colors.brandDark} /><Text style={styles.metaChipText}>DOB {child.dob}</Text></View>
          </View>
        </View>

        {/* Vaccination progress summary */}
        {st && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Immunisation Progress</Text>
              <Text style={[styles.summaryPct, { color: progressColor }]}>{st.progress_percent}%</Text>
            </View>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${st.progress_percent}%`, backgroundColor: progressColor }]} /></View>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}><Text style={[styles.statNum, { color: t.colors.success }]}>{st.completed}</Text><Text style={styles.statLabel}>Done</Text></View>
              <View style={styles.statItem}><Text style={[styles.statNum, { color: t.colors.warning }]}>{st.due}</Text><Text style={styles.statLabel}>Due</Text></View>
              <View style={styles.statItem}><Text style={[styles.statNum, { color: t.colors.error }]}>{st.overdue}</Text><Text style={styles.statLabel}>Overdue</Text></View>
              <View style={styles.statItem}><Text style={[styles.statNum, { color: t.colors.textSecondary }]}>{st.total}</Text><Text style={styles.statLabel}>Total</Text></View>
            </View>
          </View>
        )}

        <Text style={styles.demoNote}>Sample schedule shown. Confirm against the approved national schedule before clinical use.</Text>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <Pressable key={f} testID={`child-imm-filter-${f}`} onPress={() => setFilter(f)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filtered.map((im) => {
          const armed = armedId === im.id;
          return (
            <View key={im.id} style={styles.vaxCard} testID={`child-imm-${im.id}`}>
              <View style={styles.vaxHeader}>
                <View style={styles.vaxCode}><Text style={styles.vaxCodeText}>{im.vaccine_code}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vaxName} numberOfLines={1}>{im.vaccine_name}</Text>
                  <Text style={styles.vaxSub}>{im.target_age_label} • Due {im.recommended_due_date}</Text>
                </View>
                <StatusBadge status={im.status} />
              </View>
              {im.status !== "Completed" && im.status !== "Upcoming" && !readOnly && (
                <Pressable
                  testID={`mark-child-imm-${im.id}`}
                  onPress={() => { if (confirm(im.id)) markDone(im.id); }}
                  disabled={busyId === im.id}
                  style={[styles.markBtn, armed && styles.markBtnArmed]}
                >
                  {busyId === im.id ? <ActivityIndicator size="small" color={t.colors.onStatus} /> : (
                    <>
                      <Ionicons
                        name={armed ? "checkmark-done-circle" : "checkmark-circle"}
                        size={15}
                        color={armed ? t.colors.onWarning : t.colors.onStatus}
                      />
                      <Text style={[styles.markBtnText, armed && { color: t.colors.onWarning }]}>
                        {armed ? "Tap to confirm" : "Mark Administered"}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
              {im.status === "Completed" && im.administered_date ? (
                <View style={styles.givenRow}>
                  <Ionicons name="checkmark-circle" size={13} color={t.colors.successText} />
                  <Text style={styles.givenText}>Given on {im.administered_date} • {im.route} • Batch {im.batch_no || "—"}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
        {filtered.length === 0 && <Text style={styles.emptyText}>No vaccines in this category.</Text>}
      </ScrollView>
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
    avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
    name: { fontSize: 17, fontWeight: "800", color: t.colors.textPrimary },
    sub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 1 },
    bannerMeta: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
    metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: t.colors.brandLight, paddingHorizontal: 8, paddingVertical: 5, borderRadius: t.radius.sm },
    metaChipText: { fontSize: 12, fontWeight: "700", color: t.colors.brandDark },
    summaryCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 16, borderWidth: 1, borderColor: t.colors.border, marginBottom: 12 },
    summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    summaryTitle: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    summaryPct: { fontSize: 18, fontWeight: "800", color: t.colors.success },
    progressBar: { height: 10, borderRadius: 5, backgroundColor: t.colors.surfaceTertiary, overflow: "hidden" },
    progressFill: { height: 10, borderRadius: 5, backgroundColor: t.colors.success },
    summaryStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    statItem: { alignItems: "center", flex: 1 },
    statNum: { fontSize: 18, fontWeight: "800" },
    statLabel: { fontSize: 12, color: t.colors.textMuted, fontWeight: "700", marginTop: 2 },
    demoNote: { fontSize: 12, color: t.colors.textMuted, fontStyle: "italic", marginBottom: 10 },
    chipRow: { gap: 8, paddingBottom: 12 },
    chip: { height: 44, flexShrink: 0, justifyContent: "center", paddingHorizontal: 16, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceTertiary, borderWidth: 1, borderColor: t.colors.border },
    chipActive: { backgroundColor: t.colors.brand, borderColor: t.colors.brand },
    chipText: { fontSize: 12, fontWeight: "700", color: t.colors.textSecondary },
    chipTextActive: { color: t.colors.onBrand },
    vaxCard: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: t.colors.border },
    vaxHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    vaxCode: { minWidth: 48, height: 30, borderRadius: t.radius.sm, backgroundColor: t.colors.brandLight, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    vaxCodeText: { fontSize: 11, fontWeight: "800", color: t.colors.brandDark },
    vaxName: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    vaxSub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    markBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: t.colors.success, borderRadius: t.radius.sm, paddingVertical: 12, marginTop: 10 },
    markBtnArmed: { backgroundColor: t.colors.warning },
    markBtnText: { color: t.colors.onStatus, fontSize: 13, fontWeight: "700" },
    givenRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
    givenText: { flex: 1, fontSize: 12, color: t.colors.successText, fontWeight: "700" },
  });
