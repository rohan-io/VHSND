import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "@/src/context/ThemeContext";
import { useTranslation } from "@/src/context/LanguageContext";
import type { Theme } from "@/src/constants/theme";

// Dummy entry point: canned quick replies + navigation only. No real chat,
// no backend — see the task spec this was built against.
type QuickReplyKey = "reg-preg" | "alerts" | "pmsma" | "dashboard" | "help";

const CLOSE_MS = 180;

export function ChatAssistant() {
  const router = useRouter();
  const t = useTheme();
  const tr = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [mounted, setMounted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const backdropOpacity = useSharedValue(0);
  const sheetY = useSharedValue(420);
  const helpOpacity = useSharedValue(0);
  const helpY = useSharedValue(8);

  const QUICK_REPLIES = useMemo(
    () => [
      { key: "reg-preg" as QuickReplyKey, label: tr.chatAssistant.optionRegisterPregnancy, icon: "add-circle" as const, color: t.colors.brandText },
      { key: "alerts" as QuickReplyKey, label: tr.chatAssistant.optionViewAlerts, icon: "notifications" as const, color: t.colors.warning },
      { key: "pmsma" as QuickReplyKey, label: tr.chatAssistant.optionCheckPmsma, icon: "calendar" as const, color: t.colors.success },
      { key: "dashboard" as QuickReplyKey, label: tr.chatAssistant.optionGoDashboard, icon: "home" as const, color: t.colors.brandSecondaryText },
      { key: "help" as QuickReplyKey, label: tr.chatAssistant.optionNeedHelp, icon: "help-circle" as const, color: t.colors.info },
    ],
    [t, tr],
  );

  const open = () => {
    setShowHelp(false);
    helpOpacity.value = 0;
    helpY.value = 8;
    setMounted(true);
    backdropOpacity.value = withTiming(1, { duration: 200 });
    sheetY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  };

  const close = () => {
    backdropOpacity.value = withTiming(0, { duration: CLOSE_MS });
    sheetY.value = withTiming(420, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) });
    setTimeout(() => setMounted(false), CLOSE_MS);
  };

  const handleQuickReply = (key: QuickReplyKey) => {
    if (key === "help") {
      setShowHelp(true);
      helpOpacity.value = withTiming(1, { duration: 220 });
      helpY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      return;
    }
    const route = key === "reg-preg" ? "/pregnancy/register" : key === "alerts" ? "/alerts" : key === "pmsma" ? "/pmsma" : "/(tabs)";
    close();
    setTimeout(() => router.push(route as any), CLOSE_MS);
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  const helpStyle = useAnimatedStyle(() => ({ opacity: helpOpacity.value, transform: [{ translateY: helpY.value }] }));

  return (
    <>
      <Pressable
        testID="fab-chat-assistant"
        accessibilityRole="button"
        accessibilityLabel={tr.chatAssistant.a11yLabel}
        onPress={open}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color={t.colors.onBrand} />
      </Pressable>

      <Modal visible={mounted} transparent animationType="none" onRequestClose={close}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable testID="chat-assistant-backdrop" style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>

        <Animated.View
          testID="chat-assistant-panel"
          style={[styles.sheet, sheetStyle, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.botBadge}>
              <Ionicons name="chatbubble-ellipses" size={16} color={t.colors.brandText} />
            </View>
            <Text style={styles.greetingBubble}>{tr.chatAssistant.greeting}</Text>
            <Pressable
              testID="chat-assistant-close"
              accessibilityRole="button"
              accessibilityLabel={tr.common.close}
              onPress={close}
              hitSlop={8}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={18} color={t.colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.replyList}>
            {QUICK_REPLIES.map((qr) => (
              <Pressable
                key={qr.key}
                testID={`chat-quick-${qr.key}`}
                onPress={() => handleQuickReply(qr.key)}
                style={({ pressed }) => [styles.replyRow, pressed && styles.rowPressed]}
              >
                <View style={[styles.replyIcon, { backgroundColor: `${qr.color}18` }]}>
                  <Ionicons name={qr.icon} size={19} color={qr.color} />
                </View>
                <Text style={styles.replyLabel}>{qr.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} />
              </Pressable>
            ))}
          </View>

          {showHelp && (
            <Animated.View style={[styles.helpBubbleRow, helpStyle]}>
              <View style={styles.botBadge}>
                <Ionicons name="chatbubble-ellipses" size={16} color={t.colors.brandText} />
              </View>
              <Text testID="chat-help-message" style={styles.helpBubble}>
                {tr.chatAssistant.helpMessage}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    fab: {
      position: "absolute",
      right: 20,
      bottom: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.brand,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: t.colors.brandDark,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
      zIndex: 20,
    },
    fabPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.colors.surfaceSecondary,
      borderTopLeftRadius: t.radius.lg,
      borderTopRightRadius: t.radius.lg,
      paddingHorizontal: 16,
      paddingTop: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 12,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.borderStrong,
      alignSelf: "center",
      marginBottom: 14,
    },
    headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 16 },
    botBadge: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: t.colors.brandLight,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    greetingBubble: {
      flex: 1,
      backgroundColor: t.colors.surfaceTertiary,
      color: t.colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20,
      borderRadius: t.radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: t.colors.surfaceTertiary,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    replyList: { gap: 8 },
    replyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    rowPressed: { opacity: 0.85 },
    replyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    replyLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    helpBubbleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 12 },
    helpBubble: {
      flex: 1,
      backgroundColor: t.colors.infoLight,
      color: t.colors.infoText,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 19,
      borderRadius: t.radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
  });
