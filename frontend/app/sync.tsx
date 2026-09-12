import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/context/ThemeContext";
import type { Theme } from "@/src/constants/theme";
import { Header } from "@/src/components/Header";
import { useToast } from "@/src/components/Toast";
import { useOfflineSync } from "@/src/context/OfflineSyncContext";

const ENTITY_ICON: Record<string, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
  pregnancy: "woman",
  anc_visit: "clipboard",
  child: "happy",
  child_imm: "bandage",
  maternal_imm: "medkit",
};

export default function SyncScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { showToast } = useToast();
  const {
    isSimulatedOffline,
    toggleSimulatedOffline,
    pendingItems,
    pendingCount,
    lastSyncTime,
    isSyncing,
    syncNow,
    clearQueue,
  } = useOfflineSync();

  const [localSyncing, setLocalSyncing] = useState(false);

  const handleSync = async () => {
    setLocalSyncing(true);
    const res = await syncNow();
    setLocalSyncing(false);
    showToast(res.message, res.success ? "success" : "error");
  };

  return (
    <View style={styles.root}>
      <Header title="Offline Sync Center" showBack showOfflineToggle={false} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Connection status */}
        <View style={[styles.statusCard, isSimulatedOffline ? styles.statusOffline : styles.statusOnline]}>
          <Ionicons name={isSimulatedOffline ? "cloud-offline" : "cloud-done"} size={30} color={isSimulatedOffline ? t.colors.error : t.colors.success} />
          <Text style={[styles.statusTitle, { color: isSimulatedOffline ? t.colors.errorText : t.colors.successText }]}>
            {isSimulatedOffline ? "Simulated Offline Mode" : "Connected to Central Server"}
          </Text>
          <Text style={styles.statusSub}>Last synchronized: {lastSyncTime || "—"}</Text>
        </View>

        {/* Offline toggle */}
        <View style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Simulate Offline Field Conditions</Text>
            <Text style={styles.toggleSub}>New records are queued locally until sync.</Text>
          </View>
          <Switch
            testID="sync-offline-switch"
            value={isSimulatedOffline}
            onValueChange={toggleSimulatedOffline}
            trackColor={{ false: t.colors.borderStrong, true: t.colors.error }}
            thumbColor={isSimulatedOffline ? t.colors.errorLight : "#FFFFFF"}
          />
        </View>

        {/* Sync Now */}
        <Pressable
          testID="sync-now-btn"
          onPress={handleSync}
          disabled={isSyncing || localSyncing}
          style={[styles.syncBtn, (isSyncing || localSyncing) && { opacity: 0.7 }]}
        >
          {isSyncing || localSyncing ? (
            <ActivityIndicator color={t.colors.onBrand} />
          ) : (
            <>
              <Ionicons name="sync" size={20} color={t.colors.onBrand} />
              <Text style={styles.syncBtnText}>Sync Now ({pendingCount})</Text>
            </>
          )}
        </Pressable>

        {/* Queue */}
        <View style={styles.queueHeader}>
          <Text style={styles.sectionTitle}>Pending Sync Queue</Text>
          {pendingCount > 0 && (
            <Pressable testID="sync-clear-btn" onPress={async () => { await clearQueue(); showToast("Queue cleared.", "info"); }}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>

        {pendingCount === 0 ? (
          <View style={styles.emptyCard} testID="sync-empty">
            <Ionicons name="checkmark-done-circle-outline" size={40} color={t.colors.success} />
            <Text style={styles.emptyText}>Offline queue is empty. All records synchronized.</Text>
          </View>
        ) : (
          pendingItems.map((item) => (
            <View key={item.client_txn_id} style={styles.queueItem} testID={`sync-item-${item.client_txn_id}`}>
              <View style={styles.queueIcon}>
                <Ionicons name={ENTITY_ICON[item.entity_type] || "document"} size={18} color={t.colors.brandDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.queueTitle}>{item.display_title}</Text>
                <Text style={styles.queueSub}>{item.display_subtitle}</Text>
                <Text style={styles.queueTime}>{new Date(item.timestamp).toLocaleString()}</Text>
              </View>
              <View style={styles.waitingPill}>
                <Ionicons name="time" size={11} color={t.colors.warningText} />
                <Text style={styles.waitingText}>Waiting</Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.flowNote}>
          <View style={styles.flowHeader}>
            <Ionicons name="information-circle-outline" size={16} color={t.colors.textSecondary} />
            <Text style={styles.flowTitle}>How offline sync works</Text>
          </View>
          <Text style={styles.flowText}>Records you save without a connection are held on this device, then sent to the district server once you're back online. Duplicates are removed automatically.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.surface },
    scroll: { padding: 16, paddingBottom: 40 },
    statusCard: { alignItems: "center", borderRadius: t.radius.lg, padding: 20, borderWidth: 1, gap: 4 },
    statusOnline: { backgroundColor: t.colors.successLight, borderColor: t.colors.successBorder },
    statusOffline: { backgroundColor: t.colors.errorLight, borderColor: t.colors.errorBorder },
    statusTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
    statusSub: { fontSize: 12, color: t.colors.textSecondary },
    toggleCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, borderWidth: 1, borderColor: t.colors.border, marginTop: 12 },
    toggleLabel: { fontSize: 14, fontWeight: "700", color: t.colors.textPrimary },
    toggleSub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 2 },
    syncBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: t.colors.brand, borderRadius: t.radius.md, height: 52, marginTop: 12 },
    syncBtnText: { color: t.colors.onBrand, fontSize: 15, fontWeight: "700" },
    queueHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: t.colors.textPrimary },
    clearText: { fontSize: 12, fontWeight: "700", color: t.colors.error },
    emptyCard: { alignItems: "center", gap: 8, padding: 30, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border, marginTop: 12 },
    emptyText: { fontSize: 13, color: t.colors.textSecondary, textAlign: "center" },
    queueItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.colors.surfaceSecondary, borderRadius: t.radius.md, padding: 14, marginTop: 10, borderWidth: 1, borderColor: t.colors.border },
    queueIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.brandLight, alignItems: "center", justifyContent: "center" },
    queueTitle: { fontSize: 13, fontWeight: "700", color: t.colors.textPrimary },
    queueSub: { fontSize: 12, color: t.colors.textSecondary, marginTop: 1 },
    queueTime: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
    waitingPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: t.colors.warningLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    waitingText: { fontSize: 12, fontWeight: "800", color: t.colors.warningText },
    flowNote: { marginTop: 20, backgroundColor: t.colors.surfaceTertiary, borderRadius: t.radius.md, padding: 14, borderWidth: 1, borderColor: t.colors.border },
    flowHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    flowTitle: { fontSize: 13, fontWeight: "800", color: t.colors.textPrimary },
    flowText: { fontSize: 12, color: t.colors.textSecondary, marginTop: 6, lineHeight: 17 },
  });
