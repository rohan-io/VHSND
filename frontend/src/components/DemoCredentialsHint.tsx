import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";

/**
 * Demo-only login hint. Lists the seeded demo accounts so a reviewer can sign in
 * without being handed credentials separately.
 *
 * REMOVE FOR PRODUCTION: delete this file, plus its import and the single
 * `{DEMO_MODE && <DemoCredentialsHint />}` line in app/(auth)/login.tsx. It also
 * hides itself automatically whenever EXPO_PUBLIC_DEMO_MODE !== "true".
 */
const ACCOUNTS: { roleKey: "roleAnm" | "roleAsha" | "roleAdministrator"; username: string; password: string }[] = [
  { roleKey: "roleAnm", username: "worker01", password: "Worker@123" },
  { roleKey: "roleAsha", username: "worker02", password: "Worker@123" },
  { roleKey: "roleAdministrator", username: "admin", password: "Admin@123" },
];

// Beneficiary has no fixed password (mobile + mock OTP instead), so it's listed
// separately from the username/password ACCOUNTS table above.
const BENEFICIARY_DEMO_MOBILE = "9810010031";

export const DemoCredentialsHint: React.FC = () => {
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.callout} testID="demo-credentials-hint">
      <View style={styles.headerRow}>
        <Ionicons name="flask-outline" size={15} color={t.colors.infoText} />
        <Text style={styles.title}>{tr.login.demoAccounts}</Text>
        <Text style={styles.tag}>{tr.login.demoOnly}</Text>
      </View>
      {ACCOUNTS.map((a) => (
        <View key={a.username} style={styles.row}>
          <Text style={styles.role}>{tr.common[a.roleKey]}</Text>
          <Text style={styles.creds}>
            {a.username} / {a.password}
          </Text>
        </View>
      ))}
      <View style={styles.row}>
        <Text style={styles.role}>{tr.common.roleBeneficiary}</Text>
        <Text style={styles.creds}>{BENEFICIARY_DEMO_MOBILE} / {tr.login.anySixDigitOtp}</Text>
      </View>
      <Text style={styles.note}>
        {tr.login.demoNote}
      </Text>
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    callout: {
      backgroundColor: t.colors.infoLight,
      borderWidth: 1,
      borderColor: t.colors.infoBorder,
      borderRadius: t.radius.md,
      padding: 12,
      marginTop: 12,
      marginBottom: 4,
      gap: 6,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    title: {
      fontSize: 13,
      fontWeight: "800",
      color: t.colors.infoText,
      flex: 1,
    },
    tag: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.5,
      color: t.colors.onStatus,
      backgroundColor: t.colors.info,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: t.radius.sm,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    role: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.infoText,
    },
    creds: {
      fontSize: 13,
      fontWeight: "800",
      color: t.colors.infoText,
      fontFamily: "monospace",
    },
    note: {
      fontSize: 11,
      color: t.colors.infoText,
      opacity: 0.8,
      marginTop: 2,
    },
  });
