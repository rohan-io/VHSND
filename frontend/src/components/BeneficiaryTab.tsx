import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { LoadError } from "@/src/components/LoadError";
import { useAuth } from "@/src/context/AuthContext";
import { getPregnancy } from "@/src/api/mch";
import { ANCVisit, PregnancyRecord } from "@/src/types";

/** The signed-in mother's own record — same load as the Beneficiary Home screen. */
export function useBeneficiaryRecord() {
  const { user } = useAuth();
  const tr = useTranslation();
  const [pregnancy, setPregnancy] = useState<PregnancyRecord | null>(null);
  const [visits, setVisits] = useState<ANCVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.beneficiary_pregnancy_id) {
      setError("No linked record for this account.");
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await getPregnancy(user.beneficiary_pregnancy_id);
      setPregnancy(res.pregnancy);
      setVisits(res.visits || []);
    } catch (e: any) {
      setError(e.message || tr.beneficiary.loadFailed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.beneficiary_pregnancy_id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = () => { setRefreshing(true); load(); };
  return { pregnancy, visits, loading, refreshing, error, load, refresh };
}

/**
 * Shell for a Beneficiary tab: title bar (the Beneficiary Profile header minus
 * its back button), loading / error states, and a pull-to-refresh scroll body.
 */
export function BeneficiaryTab({
  title,
  record,
  testID,
  children,
}: {
  title: string;
  record: ReturnType<typeof useBeneficiaryRecord>;
  testID: string;
  children: (p: PregnancyRecord) => React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { pregnancy, loading, refreshing, error, load, refresh } = record;

  let body: React.ReactNode;
  if (loading) {
    body = (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color={t.colors.brand} />
        <Text style={styles.loadingText}>{tr.beneficiary.loading}</Text>
      </View>
    );
  } else if (error || !pregnancy) {
    body = <LoadError message={error || undefined} onRetry={load} testID={`${testID}-error`} />;
  } else {
    body = (
      <ScrollView
        testID={testID}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.colors.brand} />}
      >
        {children(pregnancy)}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {body}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: t.colors.surfaceSecondary,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    headerTitle: { fontSize: 16, fontWeight: "800", color: t.colors.textPrimary },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    loadingText: { color: t.colors.textSecondary, fontSize: 13 },
    scroll: { padding: 16, paddingBottom: 40 },
  });

/** Card/section styles shared by the Beneficiary tabs — same values as app/(beneficiary)/index.tsx. */
export const makeBeneficiaryCardStyles = (t: Theme) =>
  StyleSheet.create({
    sectionTitle: { fontSize: 15, fontWeight: "800", color: t.colors.textPrimary, marginTop: 20, marginBottom: 10 },
    firstSection: { marginTop: 4 },
    card: {
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: "hidden",
      padding: 14,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: t.colors.divider, marginTop: 10, paddingTop: 10 },
    emptyText: { fontSize: 13, color: t.colors.textMuted, fontStyle: "italic" },
    emptyState: { alignItems: "center", gap: 6, paddingVertical: 12 },
    emptyTitle: { fontSize: 14, fontWeight: "800", color: t.colors.textPrimary },
    emptyBody: { fontSize: 12, color: t.colors.textSecondary, textAlign: "center", lineHeight: 17 },
  });
