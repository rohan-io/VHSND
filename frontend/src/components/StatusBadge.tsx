import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import { statusLabel } from "@/src/i18n/strings";
import type { Theme } from "@/src/constants/theme";

interface StatusBadgeProps {
  status: string;
  variant?: "solid" | "subtle";
  testID?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = "subtle",
  testID,
}) => {
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const norm = status?.toLowerCase() || "";

  let bg = t.colors.surfaceTertiary;
  let fg = t.colors.textSecondary;
  let border = t.colors.border;
  let solidBg = t.colors.info;
  let solidFg = t.colors.onStatus;

  if (
    norm.includes("completed") ||
    norm.includes("done") ||
    norm.includes("healthy") ||
    norm.includes("synced") ||
    norm.includes("normal")
  ) {
    bg = t.colors.successLight;
    fg = t.colors.successText;
    border = t.colors.successBorder;
    solidBg = t.colors.success;
    solidFg = t.colors.onStatus;
  } else if (
    norm.includes("due") ||
    norm.includes("upcoming") ||
    norm.includes("scheduled") ||
    norm.includes("pending")
  ) {
    bg = t.colors.warningLight;
    fg = t.colors.warningText;
    border = t.colors.warningBorder;
    solidBg = t.colors.warning;
    solidFg = t.colors.onWarning;
  } else if (
    norm.includes("overdue") ||
    norm.includes("critical") ||
    norm.includes("high risk") ||
    norm.includes("missed")
  ) {
    bg = t.colors.errorLight;
    fg = t.colors.errorText;
    border = t.colors.errorBorder;
    solidBg = t.colors.error;
    solidFg = t.colors.onStatus;
  }
  // Trimester is ordinal stage info, not a status — the label carries it.
  // Left neutral so colour stays reserved for done / due / risk.

  const isSolid = variant === "solid";

  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        {
          backgroundColor: isSolid ? solidBg : bg,
          borderColor: isSolid ? solidBg : border,
        },
      ]}
    >
      <View
        style={[styles.dot, { backgroundColor: isSolid ? solidFg : fg }]}
      />
      <Text style={[styles.text, { color: isSolid ? solidFg : fg }]}>
        {statusLabel(status, tr)}
      </Text>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      gap: 4,
      alignSelf: "flex-start",
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    text: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
  });
