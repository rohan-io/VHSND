import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { BeneficiaryTab, makeBeneficiaryCardStyles, useBeneficiaryRecord } from "@/src/components/BeneficiaryTab";
import { isTrulyDelivered } from "@/src/utils/pregnancy";

/** Beneficiary Checkups tab — "Your Checkups & Advice" + "What's Coming Up" from Home, same data and cards. */
export default function CheckupsScreen() {
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const record = useBeneficiaryRecord();
  const { visits } = record;

  return (
    <BeneficiaryTab title={tr.nav.checkups} record={record} testID="beneficiary-checkups">
      {(pregnancy) => {
        const sorted = [...visits].sort((a, b) => a.visit_number - b.visit_number);
        const latestVisit = sorted.length ? sorted[sorted.length - 1] : null;
        const delivered = isTrulyDelivered(pregnancy);
        return (
          <>
            <Text style={[styles.sectionTitle, styles.firstSection]}>{tr.beneficiary.sectionCheckups}</Text>
            <View style={styles.card}>
              {sorted.length === 0 ? (
                <View style={styles.emptyState} testID="beneficiary-checkups-empty">
                  <Ionicons name="leaf-outline" size={28} color={t.colors.success} />
                  <Text style={styles.emptyTitle}>{tr.beneficiary.noCheckupsTitle}</Text>
                  <Text style={styles.emptyBody}>{tr.beneficiary.noCheckupsBody}</Text>
                </View>
              ) : (
                sorted.map((v, i) => (
                  <View key={v.id} testID={`checkups-visit-${v.visit_number}`} style={[styles.visitRow, i > 0 && styles.rowDivider]}>
                    <Text style={styles.visitTitle}>
                      {tr.beneficiary.visitLabel} #{v.visit_number} • {v.visit_date}
                    </Text>
                    {v.advice ? (
                      <Text style={styles.visitAdvice}>{tr.beneficiary.adviceLabel} {v.advice}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>

            <Text style={styles.sectionTitle}>{tr.beneficiary.sectionDueList}</Text>
            <View style={styles.card} testID="checkups-coming-up">
              {latestVisit?.next_visit_date ? (
                <View style={styles.dueRow}>
                  <Ionicons name="calendar-outline" size={18} color={t.colors.brandDark} />
                  <Text style={styles.dueLabel}>{tr.beneficiary.nextAncVisit}</Text>
                  <Text style={styles.dueValue}>{latestVisit.next_visit_date}</Text>
                </View>
              ) : null}
              {!delivered && pregnancy.edd ? (
                <View style={[styles.dueRow, latestVisit?.next_visit_date && styles.rowDivider]}>
                  <Ionicons name="flag-outline" size={18} color={t.colors.brandDark} />
                  <Text style={styles.dueLabel}>{tr.beneficiary.expectedDelivery}</Text>
                  <Text style={styles.dueValue}>{pregnancy.edd}</Text>
                </View>
              ) : null}
              {!latestVisit?.next_visit_date && (delivered || !pregnancy.edd) ? (
                <Text style={styles.emptyText}>{tr.beneficiary.nothingDue}</Text>
              ) : null}
            </View>
          </>
        );
      }}
    </BeneficiaryTab>
  );
}

// Visit/due-row values match app/(beneficiary)/index.tsx.
const makeStyles = (t: Theme) => ({
  ...makeBeneficiaryCardStyles(t),
  ...StyleSheet.create({
    visitRow: { gap: 4 },
    visitTitle: { fontSize: 13, fontWeight: "700", color: t.colors.textPrimary },
    visitAdvice: { fontSize: 12, color: t.colors.textSecondary, lineHeight: 17 },
    dueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    dueLabel: { flex: 1, fontSize: 13, color: t.colors.textPrimary, fontWeight: "600" },
    dueValue: { fontSize: 13, fontWeight: "800", color: t.colors.brandDark },
  }),
});
