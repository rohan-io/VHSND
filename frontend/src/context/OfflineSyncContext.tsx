import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { OfflineSyncItem } from "@/src/types";
import { storage } from "@/src/utils/storage";
import { apiRequest, OFFLINE_MODE_KEY, OFFLINE_QUEUE_KEY } from "@/src/api/client";

interface OfflineSyncContextType {
  isSimulatedOffline: boolean;
  toggleSimulatedOffline: () => Promise<void>;
  pendingItems: OfflineSyncItem[];
  pendingCount: number;
  lastSyncTime: string | null;
  isSyncing: boolean;
  addToOfflineQueue: (item: Omit<OfflineSyncItem, "client_txn_id" | "timestamp">) => Promise<string>;
  syncNow: () => Promise<{ success: boolean; message: string }>;
  clearQueue: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({
  isSimulatedOffline: false,
  toggleSimulatedOffline: async () => {},
  pendingItems: [],
  pendingCount: 0,
  lastSyncTime: null,
  isSyncing: false,
  addToOfflineQueue: async () => "",
  syncNow: async () => ({ success: false, message: "" }),
  clearQueue: async () => {},
});

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [pendingItems, setPendingItems] = useState<OfflineSyncItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>("10:30 AM");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    loadOfflineState();
  }, []);

  const loadOfflineState = async () => {
    try {
      const savedMode = await storage.getItem<boolean>(OFFLINE_MODE_KEY, false);
      const savedQueue = await storage.getItem<OfflineSyncItem[]>(OFFLINE_QUEUE_KEY, []);
      setIsSimulatedOffline(Boolean(savedMode));
      setPendingItems(savedQueue || []);
    } catch (e) {
      console.warn("Failed to load offline state:", e);
    }
  };

  const toggleSimulatedOffline = async () => {
    const nextVal = !isSimulatedOffline;
    setIsSimulatedOffline(nextVal);
    await storage.setItem(OFFLINE_MODE_KEY, nextVal);
  };

  const addToOfflineQueue = async (
    item: Omit<OfflineSyncItem, "client_txn_id" | "timestamp">
  ): Promise<string> => {
    const txnId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: OfflineSyncItem = {
      ...item,
      client_txn_id: txnId,
      timestamp: new Date().toISOString(),
    };

    const updated = [newItem, ...pendingItems];
    setPendingItems(updated);
    await storage.setItem(OFFLINE_QUEUE_KEY, updated);
    return txnId;
  };

  const syncNow = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (pendingItems.length === 0) {
      return { success: true, message: "Sync complete. All records up to date." };
    }

    if (isSimulatedOffline) {
      return {
        success: false,
        message: "Device is in Simulated Offline Mode. Disable offline mode to sync with central server.",
      };
    }

    setIsSyncing(true);
    try {
      const batchPayload = {
        transactions: pendingItems.map((item) => ({
          client_txn_id: item.client_txn_id,
          entity_type: item.entity_type,
          payload: item.payload,
          worker_id: item.worker_id || "",
          timestamp: item.timestamp,
        })),
      };

      const res = await apiRequest<{ sync_time: string; total_processed: number }>("/sync", {
        method: "POST",
        body: batchPayload,
      });

      // Clear synced items
      setPendingItems([]);
      await storage.setItem(OFFLINE_QUEUE_KEY, []);
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSyncTime(res.sync_time || nowStr);

      return {
        success: true,
        message: `Successfully synchronized ${res.total_processed || pendingItems.length} records with central database!`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to reach central server. Records safely kept in offline queue.",
      };
    } finally {
      setIsSyncing(false);
    }
  }, [pendingItems, isSimulatedOffline]);

  const clearQueue = async () => {
    setPendingItems([]);
    await storage.setItem(OFFLINE_QUEUE_KEY, []);
  };

  return (
    <OfflineSyncContext.Provider
      value={{
        isSimulatedOffline,
        toggleSimulatedOffline,
        pendingItems,
        pendingCount: pendingItems.length,
        lastSyncTime,
        isSyncing,
        addToOfflineQueue,
        syncNow,
        clearQueue,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
};

export const useOfflineSync = () => useContext(OfflineSyncContext);
