import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { BeneficiaryTab, makeBeneficiaryCardStyles, useBeneficiaryRecord } from "@/src/components/BeneficiaryTab";
import { isTrulyDelivered } from "@/src/utils/pregnancy";
import { buildBeneficiaryAlerts, mockVhsndSessions, type BeneficiaryAlert } from "@/src/utils/beneficiaryAlerts";

const ICONS: Record<BeneficiaryAlert["kind"], keyof typeof Ionicons.glyphMap> = {
  vhsnd: "people-outline",
  anc: "calendar-outline",
  pmsma: "medkit-outline",
  edd: "heart-outline",
};

/**
 * Beneficiary Alerts tab — friendly reminders built from the same data Home
 * shows (VHSND sessions, next ANC date, EDD) plus the fixed 9th-of-month PMSMA
 * camp. Green = upcoming, red = overdue, brand = milestone.
 */
export default function BeneficiaryAlertsScreen() {
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const record = useBeneficiaryRecord();
  const vhsndSessions = useMemo(mockVhsndSessions, []);
  const b = tr.beneficiary;

  const tone = (a: BeneficiaryAlert) =>
    a.urgency === "overdue"
      ? { bg: t.colors.errorLight, fg: t.colors.errorText, tag: b.tagOverdue }
      : a.urgency === "upcoming"
      ? { bg: t.colors.successLight, fg: t.colors.successText, tag: b.vhsndUpcomingTag }
      : { bg: t.colors.brandLight, fg: t.colors.brandDark, tag: b.tagMilestone };

  const when = (days: number) =>
    days < 0 ? b.whenOverdue.replace("{n}", String(-days))
    : days === 0 ? b.whenToday
    : days === 1 ? b.whenTomorrow
    : b.whenInDays.replace("{n}", String(days));

  const text = (a: BeneficiaryAlert, village: string): [string, string] => {
    switch (a.kind) {
      case "vhsnd": return [b.vhsndMessage.replace("{village}", village), b.alertVhsndBody.replace("{date}", a.date)];
      case "anc": return a.urgency === "overdue"
        ? [b.alertAncOverdue.replace("{date}", a.date), b.alertAncOverdueBody]
        : [b.alertAncUpcoming.replace("{date}", a.date), b.alertAncUpcomingBody];
      case "pmsma": return [b.alertPmsma.replace("{date}", a.date), b.alertPmsmaBody];
      case "edd": return [b.alertEdd.replace("{date}", a.date), b.alertEddBody.replace("{weeks}", String(Math.max(0, Math.round(a.days / 7))))];
    }
  };

  return (
    <BeneficiaryTab title={tr.nav.alerts} record={record} testID="beneficiary-alerts">
      {(pregnancy) => {
        const latest = [...record.visits].sort((x, y) => y.visit_number - x.visit_number)[0];
        const alerts = buildBeneficiaryAlerts({
          vhsndSessions,
          nextVisitDate: latest?.next_visit_date,
          edd: pregnancy.edd,
          delivered: isTrulyDelivered(pregnancy),
        });

        if (alerts.length === 0) {
          return (
            <View style={[styles.card, styles.firstSection]}>
              <View style={styles.emptyState} testID="beneficiary-alerts-empty">
                <Ionicons name="checkmark-circle" size={32} color={t.colors.success} />
                <Text style={styles.emptyTitle}>{b.allCaughtUp}</Text>
                <Text style={styles.emptyBody}>{b.allCaughtUpBody}</Text>
              </View>
            </View>
          );
        }

        const groups: [string, BeneficiaryAlert[]][] = [
          [b.alertsCheckupSection, alerts.filter((a) => a.kind === "anc" || a.kind === "pmsma")],
          [b.alertsVhsndSection, alerts.filter((a) => a.kind === "vhsnd")],
          [b.alertsMilestoneSection, alerts.filter((a) => a.kind === "edd")],
        ];

        return groups.filter(([, items]) => items.length).map(([title, items], gi) => (
          <View key={title}>
            <Text style={[styles.sectionTitle, gi === 0 && styles.firstSection]}>{title}</Text>
            {items.map((a) => {
              const c = tone(a);
              const [heading, body] = text(a, pregnancy.village);
              return (
                <View key={a.id} testID={`beneficiary-alert-${a.id}`} style={[styles.card, styles.alertCard, { borderLeftColor: c.fg }]}>
                  <View style={[styles.alertIcon, { backgroundColor: c.bg }]}>
                    <Ionicons name={ICONS[a.kind]} size={18} color={c.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.alertTopRow}>
                      <Text style={[styles.alertTag, { backgroundColor: c.bg, color: c.fg }]}>{c.tag}</Text>
                      <Text style={[styles.alertWhen, { color: c.fg }]}>{when(a.days)}</Text>
                    </View>
                    <Text style={styles.alertTitle}>{heading}</Text>
                    <Text style={styles.alertBody}>{body}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ));
      }}
    </BeneficiaryTab>
  );
}

const makeStyles = (t: Theme) => ({
  ...makeBeneficiaryCardStyles(t),
  ...StyleSheet.create({
    alertCard: { flexDirection: "row", gap: 12, borderLeftWidth: 4, marginBottom: 10 },
    alertIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    alertTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
    alertTag: { fontSize: 10, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 4, borderRadius: t.radius.pill, overflow: "hidden" },
    alertWhen: { fontSize: 12, fontWeight: "800" },
    alertTitle: { fontSize: 13, fontWeight: "700", color: t.colors.textPrimary, lineHeight: 18 },
    alertBody: { fontSize: 12, color: t.colors.textSecondary, marginTop: 3, lineHeight: 17 },
  }),
});
