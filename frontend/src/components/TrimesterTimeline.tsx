import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import type { Theme } from "@/src/constants/theme";

interface TrimesterTimelineProps {
  currentTrimester: 1 | 2 | 3;
  gestationalWeeks: number;
  gestationalDays?: number;
  edd: string;
}

export const TrimesterTimeline: React.FC<TrimesterTimelineProps> = ({
  currentTrimester,
  gestationalWeeks,
  gestationalDays = 0,
  edd,
}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const steps = [
    {
      num: 1,
      label: "1st tri",
      weeks: "Wk 1–12",
      desc: "Registration & ANC 1",
      icon: "leaf-outline" as const,
    },
    {
      num: 2,
      label: "2nd tri",
      weeks: "Wk 13–27",
      desc: "ANC 2 & TT Vaccines",
      icon: "pulse-outline" as const,
    },
    {
      num: 3,
      label: "3rd tri",
      weeks: "Wk 28–40",
      desc: "ANC 3/4 & Birth Plan",
      icon: "heart-circle-outline" as const,
    },
    {
      num: 4,
      label: "Delivery",
      weeks: "EDD",
      desc: "Institutional Birth",
      icon: "happy-outline" as const,
    },
  ];

  return (
    <View style={styles.container} testID="trimester-visual-timeline">
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>Gestational Timeline</Text>
          <Text style={styles.currentAge}>
            Currently:{" "}
            <Text style={styles.ageBold}>
              {gestationalWeeks} Weeks {gestationalDays} Days
            </Text>
          </Text>
        </View>

        <View style={styles.eddBadge}>
          <Ionicons name="calendar" size={13} color={t.colors.brandDark} />
          <Text style={styles.eddText}>EDD: {edd}</Text>
        </View>
      </View>

      {/* Progress Track */}
      <View style={styles.trackContainer}>
        {steps.map((step, idx) => {
          const isDone = currentTrimester > step.num;
          const isCurrent = currentTrimester === step.num;
          const isFuture = currentTrimester < step.num;

          return (
            <React.Fragment key={step.num}>
              {/* Step Node */}
              <View style={styles.nodeWrapper}>
                <View
                  style={[
                    styles.circleNode,
                    isDone && styles.circleDone,
                    isCurrent && styles.circleCurrent,
                    isFuture && styles.circleFuture,
                  ]}
                >
                  {isDone ? (
                    <Ionicons name="checkmark" size={14} color={t.colors.onStatus} />
                  ) : (
                    <Ionicons
                      name={step.icon}
                      size={14}
                      color={isCurrent ? t.colors.onBrand : t.colors.textMuted}
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.nodeLabel,
                    isCurrent && styles.nodeLabelCurrent,
                    isDone && styles.nodeLabelDone,
                  ]}
                  numberOfLines={1}
                >
                  {step.label}
                </Text>
                <Text style={styles.nodeWeeks} numberOfLines={1}>{step.weeks}</Text>
              </View>

              {/* Connecting Line */}
              {idx < steps.length - 1 && (
                <View
                  style={[
                    styles.connectorLine,
                    currentTrimester > step.num ? styles.connectorDone : styles.connectorPending,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      {/* Clinical Guidance Milestone Box — protocol reference, always neutral.
          Risk is signalled by the HIGH RISK banner above, not by recolouring this. */}
      <View style={styles.guidanceBox}>
        <Ionicons name="information-circle" size={18} color={t.colors.brandText} />
        <View style={styles.guidanceTextCol}>
          <Text style={styles.guidanceTitle}>
            {currentTrimester === 1
              ? "1st Trimester Protocols: Register early, baseline Hb & BP, IFA & TT1 start."
              : currentTrimester === 2
              ? "2nd Trimester Protocols: ANC 2 visit, TT2/Booster, Calcium tablets & Quickening check."
              : "3rd Trimester Protocols: ANC 3 & 4 visits, check fetal lie & BP, arrange 108 ambulance transport."}
          </Text>
        </View>
      </View>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.md,
      padding: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    titleCol: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: "700",
      color: t.colors.textPrimary,
    },
    currentAge: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
    ageBold: {
      fontWeight: "800",
      color: t.colors.brandText,
    },
    eddBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: t.colors.brandLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: t.radius.sm,
    },
    eddText: {
      fontSize: 12,
      fontWeight: "700",
      color: t.colors.brandDark,
    },
    trackContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    nodeWrapper: {
      alignItems: "center",
      width: 70,
    },
    circleNode: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    circleDone: {
      backgroundColor: t.colors.success,
    },
    circleCurrent: {
      backgroundColor: t.colors.brand,
      borderWidth: 2,
      borderColor: t.colors.brandDark,
    },
    circleFuture: {
      backgroundColor: t.colors.surfaceTertiary,
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
    },
    nodeLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.textSecondary,
      textAlign: "center",
    },
    nodeLabelCurrent: {
      color: t.colors.brandDark,
      fontWeight: "800",
    },
    nodeLabelDone: {
      color: t.colors.textSecondary,
      fontWeight: "700",
    },
    nodeWeeks: {
      fontSize: 11,
      color: t.colors.textMuted,
      marginTop: 2,
      textAlign: "center",
    },
    connectorLine: {
      flex: 1,
      height: 3,
      marginBottom: 26,
      marginHorizontal: -4,
    },
    connectorDone: {
      backgroundColor: t.colors.success,
    },
    connectorPending: {
      backgroundColor: t.colors.border,
    },
    guidanceBox: {
      backgroundColor: t.colors.surfaceTertiary,
      borderRadius: t.radius.sm,
      padding: 10,
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    guidanceTextCol: {
      flex: 1,
    },
    guidanceTitle: {
      fontSize: 12,
      color: t.colors.textPrimary,
      lineHeight: 17,
      fontWeight: "600",
    },
  });
