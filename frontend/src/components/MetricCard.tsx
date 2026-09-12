import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import type { Theme } from "@/src/constants/theme";

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  bgColor?: string;
  onPress?: () => void;
  testID?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  bgColor,
  onPress,
  testID,
}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const fg = color ?? t.colors.brandText;
  const bg = bgColor ?? t.colors.surfaceSecondary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: bg },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: `${fg}18` }]}>
          <Ionicons name={icon} size={18} color={fg} />
        </View>
        <Text style={[styles.valueText, { color: fg }]}>{value}</Text>
      </View>

      <Text style={styles.titleText} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitleText} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 100,
      borderRadius: t.radius.md,
      padding: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      marginBottom: 8,
    },
    pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    iconBox: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    valueText: {
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    titleText: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.textSecondary,
      lineHeight: 15,
    },
    subtitleText: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginTop: 2,
    },
  });
