import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { LoadError } from "@/src/components/LoadError";
import { priorityColor } from "@/src/utils/priority";
import { getNotifications, markNotificationRead } from "@/src/api/mch";
import { NotificationItem } from "@/src/types";

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  IMMUNIZATION: "medkit",
  HIGH_RISK: "warning",
  CAMPAIGN: "megaphone",
};

export default function NotificationsScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const PRIORITY_COLOR = useMemo(() => priorityColor(t), [t]);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getNotifications();
      setItems(res.items);
      setUnread(res.unread_count);
    } catch (e) {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRead = async (n: NotificationItem) => {
    if (n.is_read) return;
    setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
    setUnread((u) => Math.max(0, u - 1));
    try { await markNotificationRead(n.id); } catch {}
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const color = PRIORITY_COLOR[item.priority] || t.colors.info;
    return (
      <Pressable testID={`notification-${item.id}`} onPress={() => handleRead(item)} style={[styles.card, !item.is_read && styles.cardUnread]}>
        <View style={[styles.iconBox, { backgroundColor: `${color}18` }]}>
          <Ionicons name={CATEGORY_ICON[item.category] || "notifications"} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.msg}>{item.message}</Text>
          {item.beneficiary_name ? (
            <View style={styles.beneficiaryRow}>
              <Ionicons name="person-outline" size={11} color={t.colors.textMuted} />
              <Text style={styles.beneficiary}>{item.beneficiary_name}</Text>
            </View>
          ) : null}
          <View style={styles.cardFooter}>
            <View style={[styles.priorityPill, { backgroundColor: `${color}18` }]}>
              <Text style={[styles.priorityText, { color }]}>{item.priority}</Text>
            </View>
            <Text style={styles.time}>
              {new Date(item.created_at).toLocaleString(undefined, {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <Header title="Notifications" showBack showOfflineToggle={false} />
      {loading ? (
        <View style={styles.centerFill}><ActivityIndicator size="large" color={t.colors.brand} /></View>
      ) : error ? (
        <LoadError onRetry={load} testID="notifications-load-error" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.mockBanner}>
              <Ionicons name="information-circle" size={15} color={t.colors.info} />
              <Text style={styles.mockText}>Broadcasts from your district office. {unread} unread.</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.centerFill}>
              <Ionicons name="notifications-off-outline" size={40} color={t.colors.textMuted} />
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8, minHeight: 240 },
    emptyText: { fontSize: 13, color: t.colors.textSecondary },
    listContent: { padding: 16, paddingBottom: 32 },
    mockBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.infoLight, borderRadius: t.radius.md, padding: 12, marginBottom: 12 },
    mockText: { flex: 1, fontSize: 12, color: t.colors.infoText, fontWeight: "600" },
    card: { flexDirection: "row", gap: 12, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.colors.border },
    cardUnread: { borderColor: t.colors.brand, backgroundColor: t.colors.orange[50] },
    iconBox: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    title: { flex: 1, fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.brand },
    msg: { fontSize: 12, color: t.colors.textSecondary, marginTop: 3, lineHeight: 17 },
    beneficiaryRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    beneficiary: { fontSize: 12, color: t.colors.textMuted, fontWeight: "600" },
    cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
    priorityPill: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 4 },
    priorityText: { fontSize: 12, fontWeight: "800" },
    time: { fontSize: 12, color: t.colors.textMuted },
  });
