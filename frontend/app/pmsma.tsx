import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { LoadError } from "@/src/components/LoadError";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { useArmConfirm } from "@/src/hooks/use-arm-confirm";
import { isAdmin } from "@/src/utils/roles";
import { listPregnancies, markPmsmaAttended } from "@/src/api/mch";
import { pmsmaStatus, isActivePregnancy } from "@/src/utils/pmsma";
import type { PregnancyRecord } from "@/src/types";

/**
 * Missed-this-month leads (that's the actionable list); on-track follows.
 * Admin is view-only here, same policy as Alerts/pregnancy detail — the
 * Mark Attended action is gated at the point of action, not just hidden.
 */
export default function PmsmaScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { showToast } = useToast();
  const { user } = useAuth();
  const readOnly = isAdmin(user);
  const { armedId, confirm } = useArmConfirm();

  const [items, setItems] = useState<PregnancyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await listPregnancies({});
      setItems((res.items || []).filter(isActivePregnancy));
    } catch (e: any) {
      setError(e.message || tr.pmsmaScreen.loadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markAttended = async (id: string) => {
    if (readOnly) return; // point-of-action guard
    setBusyId(id);
    try {
      await markPmsmaAttended(id);
      showToast(tr.pmsmaScreen.markedToast, "success");
      await load();
    } catch (e: any) {
      showToast(e.message || "Failed to update.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const missed = items.filter((p) => pmsmaStatus(p.last_pmsma_check_date) === "epmsma");
  const onTrack = items.filter((p) => pmsmaStatus(p.last_pmsma_check_date) === "pmsma");

  const row = (p: PregnancyRecord, isMissed: boolean) => {
    const armed = armedId === p.id;
    return (
      <View key={p.id} testID={`pmsma-row-${p.id}`} style={[styles.card, isMissed && styles.cardMissed]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{p.full_name}</Text>
          <Text style={styles.sub} numberOfLines={1}>{p.village} • {p.gestational_age_label}</Text>
          <Text style={styles.checkLine}>
            {p.last_pmsma_check_date
              ? `${tr.pmsmaScreen.lastCheckPrefix} ${p.last_pmsma_check_date}`
              : tr.pmsmaScreen.notYetChecked}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable testID={`pmsma-view-${p.id}`} onPress={() => router.push(`/pregnancy/${p.id}` as any)} style={styles.viewBtn}>
            <Ionicons name="eye-outline" size={15} color={t.colors.brandDark} />
            <Text style={styles.viewBtnText}>{tr.alerts.viewRecord}</Text>
          </Pressable>
          {isMissed && (
            readOnly ? (
              <View testID={`pmsma-viewonly-${p.id}`} style={styles.viewOnlyPill}>
                <Ionicons name="eye-outline" size={13} color={t.colors.textMuted} />
                <Text style={styles.viewOnlyText}>{tr.alerts.viewOnly}</Text>
              </View>
            ) : (
              <Pressable
                testID={`pmsma-mark-${p.id}`}
                onPress={() => { if (confirm(p.id)) markAttended(p.id); }}
                disabled={busyId === p.id}
                style={[styles.markBtn, armed && styles.markBtnArmed]}
              >
                {busyId === p.id ? (
                  <ActivityIndicator size="small" color={t.colors.onBrand} />
                ) : (
                  <>
                    <Ionicons name={armed ? "checkmark-done" : "checkmark"} size={15} color={armed ? t.colors.onWarning : t.colors.onBrand} />
                    <Text style={[styles.markBtnText, armed && { color: t.colors.onWarning }]}>
                      {armed ? tr.alerts.tapToConfirm : tr.pmsmaScreen.markAttended}
                    </Text>
                  </>
                )}
              </Pressable>
            )
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title={tr.pmsmaScreen.title} showBack showOfflineToggle={false} />
        <View style={styles.centerFill}><ActivityIndicator size="large" color={t.colors.brand} /></View>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.root}>
        <Header title={tr.pmsmaScreen.title} showBack showOfflineToggle={false} />
        <LoadError message={error} onRetry={load} testID="pmsma-load-error" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header title={tr.pmsmaScreen.title} showBack showOfflineToggle={false} />
      <FlatList
        data={[{ key: "body" }]}
        keyExtractor={(x) => x.key}
        contentContainerStyle={styles.scroll}
        renderItem={() => (
          <View>
            <Text style={styles.subtitle}>{tr.pmsmaScreen.subtitle}</Text>

            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, styles.missedHeading]}>{tr.pmsmaScreen.missedTitle}</Text>
              <View style={styles.countPill}><Text style={styles.countPillText}>{missed.length}</Text></View>
            </View>
            {missed.length === 0 ? (
              <View style={styles.emptyCard} testID="pmsma-missed-empty">
                <Ionicons name="checkmark-circle-outline" size={18} color={t.colors.success} />
                <Text style={styles.emptyText}>{tr.pmsmaScreen.missedEmpty}</Text>
              </View>
            ) : (
              missed.map((p) => row(p, true))
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{tr.pmsmaScreen.onTrackTitle}</Text>
              <View style={[styles.countPill, styles.countPillOk]}><Text style={[styles.countPillText, styles.countPillOkText]}>{onTrack.length}</Text></View>
            </View>
            {onTrack.length === 0 ? (
              <Text style={styles.emptyText}>{tr.pmsmaScreen.onTrackEmpty}</Text>
            ) : (
              onTrack.map((p) => row(p, false))
            )}
          </View>
        )}
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 40 },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
    subtitle: { fontSize: 12, color: t.colors.textMuted, fontStyle: "italic", marginBottom: 4 },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 10 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: t.colors.textPrimary, flex: 1 },
    missedHeading: { color: t.colors.errorText },
    countPill: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: t.colors.error, alignItems: "center", justifyContent: "center" },
    countPillText: { fontSize: 12, fontWeight: "800", color: t.colors.onStatus },
    countPillOk: { backgroundColor: t.colors.successLight },
    countPillOkText: { color: t.colors.successText },
    emptyCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.successLight, borderRadius: t.radius.md, padding: 12 },
    emptyText: { fontSize: 12, color: t.colors.textSecondary, fontWeight: "600", flex: 1 },
    card: { backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.colors.border },
    cardMissed: { borderColor: t.colors.errorBorder, backgroundColor: t.colors.errorLight },
    name: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    sub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    checkLine: { fontSize: 12, color: t.colors.textMuted, marginTop: 4, fontWeight: "600" },
    actions: { flexDirection: "row", gap: 8, marginTop: 12 },
    viewBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: t.colors.brandLight, borderRadius: t.radius.sm, paddingVertical: 11 },
    viewBtnText: { fontSize: 13, fontWeight: "700", color: t.colors.brandDark },
    markBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: t.colors.brand, borderRadius: t.radius.sm, paddingVertical: 11 },
    markBtnArmed: { backgroundColor: t.colors.warning },
    markBtnText: { fontSize: 13, fontWeight: "700", color: t.colors.onBrand },
    viewOnlyPill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.sm, paddingVertical: 11 },
    viewOnlyText: { fontSize: 13, fontWeight: "700", color: t.colors.textMuted },
  });
