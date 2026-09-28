import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { BeneficiaryTab, makeBeneficiaryCardStyles, useBeneficiaryRecord } from "@/src/components/BeneficiaryTab";
import { isTrulyDelivered } from "@/src/utils/pregnancy";
import { buildBeneficiaryAlerts, mockVhsndSessions, type BeneficiaryAlert } from "@/src/utils/beneficiaryAlerts";

const ICONS: Record<BeneficiaryAlert["kind"], keyof typeof Ionicons.glyphMap> = {
  vhsnd: "people",
  anc: "calendar",
  pmsma: "medkit",
  edd: "heart",
};

// Where each reminder's chevron leads: VHSND lives on Home (with its feedback
// form); checkup, PMSMA and due-date reminders open the Checkups tab.
const TARGET: Record<BeneficiaryAlert["kind"], string> = {
  vhsnd: "/(beneficiary)",
  anc: "/(beneficiary)/checkups",
  pmsma: "/(beneficiary)/checkups",
  edd: "/(beneficiary)/checkups",
};

/**
 * Beneficiary Alerts tab — friendly reminders built from the same data Home
 * shows (VHSND sessions, next ANC date, EDD) plus the fixed 9th-of-month PMSMA
 * camp. Card layout follows the ANM dashboard's alert rows (icon · bold title ·
 * metadata · badge · chevron); tone comes from theme tokens so it tracks
 * light/dark: brand green = upcoming, brand brick = milestone, error = overdue.
 */
export default function BeneficiaryAlertsScreen() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const record = useBeneficiaryRecord();
  const vhsndSessions = useMemo(mockVhsndSessions, []);
  const b = tr.beneficiary;

  const tone = (a: BeneficiaryAlert) =>
    a.urgency === "overdue"
      ? { tint: t.colors.errorLight, fg: t.colors.errorText, tag: b.tagOverdue }
      : a.urgency === "upcoming"
      ? { tint: t.colors.brandSecondaryLight, fg: t.colors.brandSecondaryText, tag: b.vhsndUpcomingTag }
      : { tint: t.colors.brandLight, fg: t.colors.brandText, tag: b.tagMilestone };

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
            <View style={styles.emptyCard} testID="beneficiary-alerts-empty">
              <Ionicons name="checkmark-circle" size={32} color={t.colors.brandSecondaryText} />
              <Text style={styles.emptyTitle}>{b.allCaughtUp}</Text>
              <Text style={styles.emptyBody}>{b.allCaughtUpBody}</Text>
            </View>
          );
        }

        const groups: [string, BeneficiaryAlert[]][] = [
          [b.alertsCheckupSection, alerts.filter((a) => a.kind === "anc" || a.kind === "pmsma")],
          [b.alertsVhsndSection, alerts.filter((a) => a.kind === "vhsnd")],
          [b.alertsMilestoneSection, alerts.filter((a) => a.kind === "edd")],
        ];

        return groups.filter(([, items]) => items.length).map(([title, items], gi) => {
          // Section pill takes the most urgent tone in the group (overdue sorts first).
          const head = tone(items[0]);
          return (
            <View key={title}>
              <View style={[styles.sectionHeaderRow, gi === 0 && styles.sectionHeaderFirst]}>
                <Text style={styles.sectionTitleFlush}>{title}</Text>
                <View style={[styles.countPill, { backgroundColor: head.tint }]}>
                  <Text style={[styles.countText, { color: head.fg }]}>{items.length}</Text>
                </View>
              </View>
              {items.map((a) => {
                const c = tone(a);
                const [heading, body] = text(a, pregnancy.village);
                return (
                  <Pressable
                    key={a.id}
                    testID={`beneficiary-alert-${a.id}`}
                    onPress={() => router.navigate(TARGET[a.kind] as any)}
                    style={({ pressed }) => [styles.alertRow, pressed && styles.pressed]}
                  >
                    <View style={[styles.alertIcon, { backgroundColor: c.tint }]}>
                      <Ionicons name={ICONS[a.kind]} size={20} color={c.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.alertTopRow}>
                        <Text style={styles.alertTitle}>{heading}</Text>
                        <View style={[styles.badge, { backgroundColor: c.tint }]}>
                          <Text style={[styles.badgeText, { color: c.fg }]}>{c.tag}</Text>
                        </View>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={13} color={c.fg} />
                        <Text style={[styles.metaText, { color: c.fg }]}>{when(a.days)}</Text>
                      </View>
                      <Text style={styles.alertMsg}>{body}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          );
        });
      }}
    </BeneficiaryTab>
  );
}

// Sizes/weights follow the ANM dashboard (app/(tabs)/index.tsx): sectionHeaderRow,
// sectionTitleFlush, criticalCountPill, alertRow, alertTitle/alertMsg, priorityPill.
const makeStyles = (t: Theme) => {
  const base = makeBeneficiaryCardStyles(t);
  return {
    ...base,
    ...StyleSheet.create({
      sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 10 },
      sectionHeaderFirst: { marginTop: 4 },
      sectionTitleFlush: { fontSize: 15, fontWeight: "800", color: t.colors.textPrimary },
      countPill: { borderRadius: t.radius.pill, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
      countText: { fontSize: 12, fontWeight: "800" },

      alertRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: t.colors.surfaceSecondary,
        borderRadius: t.radius.md,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: t.colors.border,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
      pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
      alertIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
      alertTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
      alertTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: t.colors.textPrimary, lineHeight: 19 },
      badge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5 },
      badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
      metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
      metaText: { fontSize: 12, fontWeight: "700" },
      alertMsg: { fontSize: 12, color: t.colors.textSecondary, marginTop: 3, lineHeight: 17 },

      emptyCard: { ...base.card, alignItems: "center", gap: 6, paddingVertical: 24, marginTop: 4 },
    }),
  };
};
