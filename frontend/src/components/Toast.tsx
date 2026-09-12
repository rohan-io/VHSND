import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import type { Theme } from "@/src/constants/theme";

type ToastType = "success" | "error" | "info";
interface ToastState {
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const timerRef = useRef<any>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });
    opacity.value = withSequence(
      withTiming(1, { duration: 220 }),
      withDelay(2600, withTiming(0, { duration: 300 }))
    );
    translateY.value = withSequence(
      withTiming(0, { duration: 220 }),
      withDelay(2600, withTiming(-20, { duration: 300 }))
    );
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Toast chips are intentionally always-dark (they float over any surface).
  const config = {
    success: { icon: "checkmark-circle" as const, bg: "#065F46", tint: "#D1FAE5" },
    error: { icon: "alert-circle" as const, bg: "#991B1B", tint: "#FEE2E2" },
    info: { icon: "information-circle" as const, bg: t.colors.inkBar, tint: t.colors.onInkBar },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.wrap, { top: insets.top + 8 }, animStyle]}
        >
          <Pressable
            testID="app-toast"
            onPress={() => setToast(null)}
            style={[styles.toast, { backgroundColor: config[toast.type].bg }]}
          >
            <Ionicons name={config[toast.type].icon} size={18} color={config[toast.type].tint} />
            <Text style={styles.text}>{toast.message}</Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 16,
      right: 16,
      zIndex: 9999,
      alignItems: "center",
    },
    toast: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: t.radius.md,
      maxWidth: 480,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    text: {
      flex: 1,
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 18,
    },
  });

export const useToast = () => useContext(ToastContext);
