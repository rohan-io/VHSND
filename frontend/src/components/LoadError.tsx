import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";

interface Props {
  message?: string;
  onRetry: () => void;
  testID?: string;
}

/**
 * Shown when a fetch failed — distinct from an empty result, so a dropped
 * connection never reads as "nothing here yet" and prompts a duplicate entry.
 */
export const LoadError: React.FC<Props> = ({
  message,
  onRetry,
  testID,
}) => {
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.wrap} testID={testID}>
      <Ionicons name="cloud-offline-outline" size={40} color={t.colors.textMuted} />
      <Text style={styles.title}>{tr.common.couldntLoad}</Text>
      <Text style={styles.sub}>{message ?? tr.common.loadErrorDefault}</Text>
      <Pressable
        onPress={onRetry}
        style={styles.btn}
        testID={testID ? `${testID}-retry` : undefined}
      >
        <Ionicons name="refresh" size={15} color={t.colors.onBrand} />
        <Text style={styles.btnText}>{tr.common.retry}</Text>
      </Pressable>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8, minHeight: 240 },
    title: { fontSize: 15, fontWeight: "700", color: t.colors.textPrimary, marginTop: 4 },
    sub: { fontSize: 12, color: t.colors.textSecondary, textAlign: "center" },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      backgroundColor: t.colors.brand,
      borderRadius: t.radius.md,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    btnText: { color: t.colors.onBrand, fontSize: 13, fontWeight: "700" },
  });
