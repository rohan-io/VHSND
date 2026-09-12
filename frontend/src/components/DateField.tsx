import React, { useMemo } from "react";
import { Platform, TextInput, View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import type { Theme } from "@/src/constants/theme";
import { maskDateInput } from "@/src/utils/date";

interface Props {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (v: string) => void;
  min?: string; // "YYYY-MM-DD"
  max?: string;
  placeholder?: string;
  error?: string | null;
  testID?: string;
}

/**
 * Web gets the real platform date picker (react-native-web renders this subtree
 * as DOM, so a native <input type="date"> works). Native falls back to a masked,
 * numeric-keypad text field; the parent still validates the value either way.
 */
export const DateField: React.FC<Props> = ({
  value,
  onChange,
  min,
  max,
  placeholder = "YYYY-MM-DD",
  error,
  testID,
}) => {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View>
      {Platform.OS === "web"
        ? React.createElement("input", {
            type: "date",
            value: value || "",
            min,
            max,
            "data-testid": testID,
            onChange: (e: any) => onChange(e.target.value),
            style: {
              boxSizing: "border-box",
              width: "100%",
              height: 46,
              borderRadius: t.radius.md,
              border: `1px solid ${error ? t.colors.error : t.colors.border}`,
              padding: "0 12px",
              fontSize: 14,
              fontFamily: "inherit",
              color: t.colors.textPrimary,
              backgroundColor: t.colors.surfaceSecondary,
              accentColor: t.colors.brand,
              colorScheme: t.name,
            },
          })
        : (
          <TextInput
            testID={testID}
            style={[styles.input, error ? styles.inputError : null]}
            value={value}
            onChangeText={(txt) => onChange(maskDateInput(txt))}
            placeholder={placeholder}
            placeholderTextColor={t.colors.textMuted}
            keyboardType="number-pad"
            maxLength={10}
          />
        )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    input: {
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 12,
      height: 46,
      fontSize: 14,
      color: t.colors.textPrimary,
    },
    inputError: { borderColor: t.colors.error },
    errorText: {
      fontSize: 12,
      color: t.colors.error,
      fontWeight: "600",
      marginTop: 4,
    },
  });
