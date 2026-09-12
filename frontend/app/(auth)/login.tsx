import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";
import { useAuth } from "@/src/context/AuthContext";
import { DEMO_MODE } from "@/src/api/client";
import { DemoCredentialsHint } from "@/src/components/DemoCredentialsHint";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { login, isLoading } = useAuth();

  const roleTitle = (role: "Health Worker" | "Administrator") =>
    role === "Administrator" ? tr.login.adminLogin : tr.login.healthWorkerLogin;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"Health Worker" | "Administrator" | null>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg(tr.login.needBoth);
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const u = await login(username.trim(), password.trim());
      if (u.role === "Administrator") {
        router.replace("/(admin)");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      setErrorMsg(err.message || tr.login.invalidCreds);
    } finally {
      setSubmitting(false);
    }
  };

  const selectRole = (role: "Health Worker" | "Administrator") => {
    setSelectedRole(role);
    setUsername("");
    setPassword("");
    setErrorMsg(null);
  };

  const resetRole = () => {
    setSelectedRole(null);
    setUsername("");
    setPassword("");
    setErrorMsg(null);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top Government Branding Bar */}
      <View style={styles.topGovBar}>
        <View style={styles.emblemBadge}>
          <Ionicons name="medical" size={14} color={t.colors.onBrand} />
        </View>
        <Text style={styles.topGovText}>{tr.login.govPortal}</Text>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App Title & Disclaimer Card */}
        <View style={styles.brandingHeader}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark" size={38} color={t.colors.brandText} />
          </View>
          <Text style={styles.appTitle}>ମା ଓ ଶିଶୁ ସୁରକ୍ଷା</Text>
          <Text style={styles.appTagline}>
            {tr.login.tagline}
          </Text>
          <View style={styles.disclaimerPill}>
            <Ionicons name="information-circle" size={13} color={t.colors.brandDark} />
            <Text style={styles.disclaimerText}>
              {tr.login.officialPortalFor}
            </Text>
          </View>
        </View>

        {/* Demo-only credentials hint — remove for production (see component) */}
        {DEMO_MODE && <DemoCredentialsHint />}

        {/* Role selection (shown until a role is chosen) */}
        {!selectedRole && (
          <View style={styles.credSection}>
            <Text style={styles.sectionLabel}>{tr.login.selectRole}</Text>
            <View style={styles.credGrid}>
              <Pressable
                testID="role-health-worker"
                onPress={() => selectRole("Health Worker")}
                style={({ pressed }) => [styles.credCard, pressed && styles.pressed]}
              >
                <View style={[styles.credIcon, { backgroundColor: t.colors.brandLight }]}>
                  <Ionicons name="woman" size={18} color={t.colors.brandDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.credRole}>{tr.login.healthWorkerLogin}</Text>
                  <Text style={styles.credText}>{tr.login.healthWorkerDesc}</Text>
                </View>
                <Ionicons name="chevron-forward-circle-outline" size={20} color={t.colors.textMuted} />
              </Pressable>

              <Pressable
                testID="role-admin"
                onPress={() => selectRole("Administrator")}
                style={({ pressed }) => [styles.credCard, pressed && styles.pressed]}
              >
                <View style={[styles.credIcon, { backgroundColor: t.colors.surfaceTertiary }]}>
                  <Ionicons name="shield-checkmark" size={18} color={t.colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.credRole}>{tr.login.adminLogin}</Text>
                  <Text style={styles.credText}>{tr.login.adminDesc}</Text>
                </View>
                <Ionicons name="chevron-forward-circle-outline" size={20} color={t.colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Credentials Form (shown after role selected) */}
        {selectedRole && (
        <View style={styles.formCard}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.formTitle}>{roleTitle(selectedRole)}</Text>
            <Pressable testID="login-change-role-btn" onPress={resetRole} style={styles.changeRoleBtn}>
              <Ionicons name="swap-horizontal" size={14} color={t.colors.brandText} />
              <Text style={styles.changeRoleText}>{tr.common.change}</Text>
            </Pressable>
          </View>

          {errorMsg && (
            <View style={styles.errorContainer} testID="login-error-alert">
              <Ionicons name="alert-circle" size={16} color={t.colors.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Username / Mobile Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{tr.login.usernameLabel}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-outline"
                size={18}
                color={t.colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                testID="login-username-input"
                style={styles.textInput}
                value={username}
                onChangeText={setUsername}
                placeholder={tr.login.usernamePlaceholder}
                placeholderTextColor={t.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{tr.login.passwordLabel}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={t.colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                testID="login-password-input"
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder={tr.login.passwordPlaceholder}
                placeholderTextColor={t.colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                testID="toggle-password-visibility-btn"
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={t.colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {/* Remember me & Forgot Password */}
          <View style={styles.rowBetween}>
            <Pressable
              testID="login-remember-me-toggle"
              onPress={() => setRememberMe(!rememberMe)}
              style={styles.rememberRow}
            >
              <Ionicons
                name={rememberMe ? "checkbox" : "square-outline"}
                size={18}
                color={t.colors.brandText}
              />
              <Text style={styles.rememberText}>{tr.login.rememberSession}</Text>
            </Pressable>

            <Pressable
              testID="login-forgot-password-btn"
              onPress={() => setShowForgotModal(true)}
            >
              <Text style={styles.forgotText}>{tr.login.forgotPassword}</Text>
            </Pressable>
          </View>

          {/* Submit CTA Button */}
          <Pressable
            testID="login-submit-button"
            onPress={handleLogin}
            disabled={submitting || isLoading}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && styles.pressed,
              (submitting || isLoading) && styles.btnDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={t.colors.onBrand} size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>{tr.login.signIn}</Text>
                <Ionicons name="arrow-forward" size={18} color={t.colors.onBrand} />
              </>
            )}
          </Pressable>
        </View>
        )}

        {/* Security & Offline Notice */}
        <View style={styles.securityNotice}>
          <Ionicons name="lock-closed" size={14} color={t.colors.textMuted} />
          <Text style={styles.securityText}>
            {tr.login.securityNotice}
          </Text>
        </View>
      </KeyboardAwareScrollView>

      {/* Forgot Password Modal */}
      <Modal visible={showForgotModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent} testID="forgot-password-modal">
            <View style={styles.modalHeader}>
              <Ionicons name="help-buoy-outline" size={24} color={t.colors.brandText} />
              <Text style={styles.modalTitle}>{tr.login.recoveryTitle}</Text>
            </View>
            <Text style={styles.modalBody}>{tr.login.recoveryBody}</Text>
            <Pressable
              testID="close-forgot-password-modal-btn"
              onPress={() => setShowForgotModal(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseBtnText}>{tr.login.closeReturn}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.surface,
    },
    topGovBar: {
      backgroundColor: t.colors.inkBar,
      paddingHorizontal: 16,
      paddingVertical: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    emblemBadge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: t.colors.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    topGovText: {
      color: t.colors.onInkBar,
      fontSize: 11,
      fontWeight: "600",
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    brandingHeader: {
      alignItems: "center",
      marginVertical: 12,
    },
    logoCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.colors.brandLight,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    appTitle: {
      fontFamily: "NotoSansOriya",
      fontSize: 26,
      lineHeight: 40,
      color: t.colors.textPrimary,
      textAlign: "center",
    },
    appTagline: {
      fontSize: 12,
      color: t.colors.textSecondary,
      textAlign: "center",
      marginTop: 4,
      paddingHorizontal: 20,
      lineHeight: 18,
    },
    disclaimerPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.colors.brandLight,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: t.radius.pill,
      marginTop: 12,
    },
    disclaimerText: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.brandDark,
      flexShrink: 1,
    },
    credSection: {
      marginTop: 12,
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: t.colors.textPrimary,
      marginBottom: 10,
    },
    credGrid: {
      gap: 8,
    },
    credCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.md,
      padding: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    credIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    credRole: {
      fontSize: 13,
      fontWeight: "800",
      color: t.colors.textPrimary,
    },
    credText: {
      fontSize: 12,
      color: t.colors.textSecondary,
      marginTop: 1,
    },
    pressed: {
      opacity: 0.85,
    },
    formCard: {
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.lg,
      padding: 20,
      borderWidth: 1,
      borderColor: t.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    formTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: t.colors.textPrimary,
      marginBottom: 16,
    },
    formHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    changeRoleBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: t.colors.brandLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: t.radius.pill,
    },
    changeRoleText: {
      fontSize: 12,
      fontWeight: "700",
      color: t.colors.brandText,
    },
    errorContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.colors.errorLight,
      padding: 10,
      borderRadius: t.radius.sm,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 12,
      color: t.colors.error,
      fontWeight: "600",
      flex: 1,
    },
    inputGroup: {
      marginBottom: 14,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.textPrimary,
      marginBottom: 6,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.surfaceTertiary,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: {
      marginRight: 8,
    },
    textInput: {
      flex: 1,
      fontSize: 14,
      color: t.colors.textPrimary,
      height: "100%",
    },
    eyeBtn: {
      padding: 6,
    },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    rememberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    rememberText: {
      fontSize: 12,
      color: t.colors.textSecondary,
    },
    forgotText: {
      fontSize: 12,
      fontWeight: "600",
      color: t.colors.brandText,
    },
    submitBtn: {
      backgroundColor: t.colors.brand,
      borderRadius: t.radius.md,
      height: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    submitBtnText: {
      color: t.colors.onBrand,
      fontSize: 14,
      fontWeight: "700",
    },
    securityNotice: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 20,
    },
    securityText: {
      fontSize: 12,
      color: t.colors.textMuted,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(9, 8, 6, 0.7)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalContent: {
      backgroundColor: t.colors.surfaceSecondary,
      borderRadius: t.radius.lg,
      padding: 24,
      width: "100%",
      maxWidth: 380,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: t.colors.textPrimary,
    },
    modalBody: {
      fontSize: 13,
      color: t.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    bold: {
      fontWeight: "700",
      color: t.colors.textPrimary,
    },
    modalCloseBtn: {
      backgroundColor: t.colors.brand,
      borderRadius: t.radius.md,
      paddingVertical: 12,
      alignItems: "center",
    },
    modalCloseBtnText: {
      color: t.colors.onBrand,
      fontSize: 13,
      fontWeight: "700",
    },
  });
