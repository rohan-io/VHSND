import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { priorityLabel } from "@/src/i18n/strings";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { LoadError } from "@/src/components/LoadError";
import { useToast } from "@/src/components/Toast";
import { useArmConfirm } from "@/src/hooks/use-arm-confirm";
import { priorityColor } from "@/src/utils/priority";
import { listAlerts, acknowledgeAlert, recalcAlerts } from "@/src/api/mch";
import { AlertItem } from "@/src/types";
import { useAuth } from "@/src/context/AuthContext";
import { isAdmin } from "@/src/utils/roles";

const SEG_MATCH: Record<string, (a: AlertItem) => boolean> = {
  all: () => true,
  escalations: (a) => a.alert_type === "CRITICAL_PREGNANCY_ESCALATION",
  highrisk: (a) =>
    a.alert_type === "CRITICAL_PREGNANCY_ESCALATION" ||
    a.alert_type === "HIGH_RISK_PREGNANCY" ||
    a.alert_type === "EDD_APPROACHING",
  anc: (a) => a.alert_type === "MISSED_ANC",
  mat: (a) => a.alert_type.startsWith("MATERNAL_VACCINE"),
  child: (a) => a.alert_type.startsWith("CHILD_VACCINE"),
};

const VALID_SEGS = new Set(["all", "escalations", "highrisk", "anc", "mat", "child"]);

export default function AlertsScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const PRIORITY_COLOR = useMemo(() => priorityColor(t), [t]);
  const { showToast } = useToast();
  const { user } = useAuth();
  // Admin role is monitor/escalate/notify only — Alerts renders read-only:
  // view details, no Acknowledge. Checked here (render) AND in handleAck
  // (point of action) so this can't be bypassed.
  const readOnly = isAdmin(user);
  const SEGMENTS = [
    { key: "all", label: tr.alerts.segAll, match: SEG_MATCH.all },
    { key: "escalations", label: tr.alerts.segEscalations, match: SEG_MATCH.escalations },
    { key: "highrisk", label: tr.alerts.segHighRisk, match: SEG_MATCH.highrisk },
    { key: "anc", label: tr.alerts.segMissedAnc, match: SEG_MATCH.anc },
    { key: "mat", label: tr.alerts.segMaternalVaccine, match: SEG_MATCH.mat },
    { key: "child", label: tr.alerts.segChildVaccine, match: SEG_MATCH.child },
  ];
  const { seg: segParam } = useLocalSearchParams<{ seg?: string }>();
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [seg, setSeg] = useState(segParam && VALID_SEGS.has(segParam) ? segParam : "all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { armedId, confirm } = useArmConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await recalcAlerts();
      const res = await listAlerts({ status_filter: "ACTIVE" });
      setItems(res.items);
    } catch (e) {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAck = async (id: string) => {
    if (readOnly) return; // point-of-action guard — Admin can't acknowledge, button or not
    setBusyId(id);
    try {
      await acknowledgeAlert(id);
      setItems((prev) => prev.filter((a) => a.id !== id));
      showToast(tr.alerts.ackedToast, "success");
    } catch (e: any) {
      showToast(e.message || tr.alerts.ackFailedToast, "error");
    } finally {
      setBusyId(null);
    }
  };

  const segMatch = SEGMENTS.find((s) => s.key === seg)!.match;
  const filtered = items.filter(segMatch);

  const renderItem = ({ item }: { item: AlertItem }) => {
    const color = PRIORITY_COLOR[item.priority] || t.colors.info;
    const armed = armedId === item.id;
    const isEscalation = item.alert_type === "CRITICAL_PREGNANCY_ESCALATION";
    return (
      <View style={[styles.card, isEscalation && styles.cardEscalation]} testID={`alert-card-${item.id}`}>
        <Ionicons
          name="warning"
          size={20}
          color={isEscalation ? t.colors.onStatus : color}
          style={styles.priorityIcon}
        />
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            {isEscalation ? (
              <View style={styles.escTag}>
                <Text style={styles.escTagText}>{tr.alerts.escalationTag}</Text>
              </View>
            ) : (
              <View style={[styles.priorityPill, { backgroundColor: `${color}18` }]}>
                <Text style={[styles.priorityText, { color }]}>{priorityLabel(item.priority, tr)}</Text>
              </View>
            )}
            <Text style={[styles.dueDate, isEscalation && styles.textOnFillMuted]}>{tr.alerts.duePrefix} {item.due_date}</Text>
          </View>
          <Text style={[styles.title, isEscalation && styles.textOnFill]}>{item.title}</Text>
          <Text style={[styles.msg, isEscalation && styles.textOnFillMuted]}>{item.message}</Text>
          <Text style={[styles.worker, isEscalation && styles.textOnFillMuted]}>{tr.alerts.assignedPrefix} {item.assigned_worker_name || "—"}</Text>

          <View style={styles.actions}>
            <Pressable
              testID={`alert-view-${item.id}`}
              onPress={() =>
                item.related_entity_type === "pregnancy"
                  ? router.push(`/pregnancy/${item.related_entity_id}` as any)
                  : router.push(`/child/${item.related_entity_id}` as any)
              }
              style={styles.viewBtn}
            >
              <Ionicons name="eye-outline" size={15} color={t.colors.brandDark} />
              <Text style={styles.viewBtnText}>{tr.alerts.viewRecord}</Text>
            </Pressable>
            {readOnly ? (
              <View testID={`alert-viewonly-${item.id}`} style={styles.viewOnlyPill}>
                <Ionicons name="eye-outline" size={13} color={t.colors.textMuted} />
                <Text style={styles.viewOnlyText}>{tr.alerts.viewOnly}</Text>
              </View>
            ) : (
              <Pressable
                testID={`alert-ack-${item.id}`}
                onPress={() => { if (confirm(item.id)) handleAck(item.id); }}
                disabled={busyId === item.id}
                style={[styles.ackBtn, armed && styles.ackBtnArmed]}
              >
                {busyId === item.id ? (
                  <ActivityIndicator size="small" color={t.colors.onBrand} />
                ) : (
                  <>
                    <Ionicons
                      name={armed ? "checkmark-done" : "checkmark"}
                      size={15}
                      color={armed ? t.colors.onWarning : t.colors.onBrand}
                    />
                    <Text style={[styles.ackBtnText, armed && { color: t.colors.onWarning }]}>
                      {armed ? tr.alerts.tapToConfirm : tr.alerts.acknowledge}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Header title={tr.alerts.title} showOfflineToggle />

      <View style={styles.stickyHeader}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SEGMENTS.map((sgm) => {
            const active = seg === sgm.key;
            const count = items.filter(sgm.match).length;
            return (
              <Pressable key={sgm.key} testID={`alert-segment-${sgm.key}`} onPress={() => setSeg(sgm.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{sgm.label} ({count})</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={t.colors.brand} />
          <Text style={styles.loadingText}>{tr.alerts.loading}</Text>
        </View>
      ) : error ? (
        <LoadError onRetry={load} testID="alerts-load-error" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Ionicons name="checkmark-done-circle-outline" size={44} color={t.colors.success} />
              <Text style={styles.emptyText}>{tr.alerts.allClear}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    stickyHeader: { backgroundColor: t.colors.surfaceSecondary, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.colors.border },
    chipRow: { gap: 8, paddingHorizontal: 16 },
    chip: { height: 44, flexShrink: 0, justifyContent: "center", paddingHorizontal: 16, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceTertiary, borderWidth: 1, borderColor: t.colors.border },
    chipActive: { backgroundColor: t.colors.brand, borderColor: t.colors.brand },
    chipText: { fontSize: 12, fontWeight: "700", color: t.colors.textSecondary },
    chipTextActive: { color: t.colors.onBrand },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10, minHeight: 240 },
    loadingText: { color: t.colors.textSecondary, fontSize: 13 },
    emptyText: { fontSize: 13, color: t.colors.textSecondary, textAlign: "center" },
    listContent: { padding: 16, paddingBottom: 32 },
    card: { flexDirection: "row", gap: 12, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.colors.border },
    cardEscalation: { backgroundColor: t.colors.error, borderColor: t.colors.error },
    escTag: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    escTagText: { fontSize: 12, fontWeight: "800", color: t.colors.onStatus, letterSpacing: 0.5 },
    textOnFill: { color: t.colors.onStatus },
    textOnFillMuted: { color: t.colors.onStatus, opacity: 0.9 },
    priorityIcon: { marginTop: 1 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    priorityPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    priorityText: { fontSize: 12, fontWeight: "800" },
    dueDate: { fontSize: 12, color: t.colors.textMuted, fontWeight: "600" },
    title: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    msg: { fontSize: 12, color: t.colors.textSecondary, marginTop: 3, lineHeight: 17 },
    worker: { fontSize: 12, color: t.colors.textMuted, marginTop: 6, fontWeight: "600" },
    actions: { flexDirection: "row", gap: 8, marginTop: 12 },
    viewBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: t.colors.brandLight, borderRadius: t.radius.sm, paddingVertical: 12 },
    viewBtnText: { fontSize: 13, fontWeight: "700", color: t.colors.brandDark },
    ackBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: t.colors.brand, borderRadius: t.radius.sm, paddingVertical: 12 },
    ackBtnArmed: { backgroundColor: t.colors.warning },
    ackBtnText: { fontSize: 13, fontWeight: "700", color: t.colors.onBrand },
    viewOnlyPill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.sm, paddingVertical: 12 },
    viewOnlyText: { fontSize: 13, fontWeight: "700", color: t.colors.textMuted },
  });
