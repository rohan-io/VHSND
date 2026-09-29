import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { OfflineSyncItem } from "@/src/types";
import { storage } from "@/src/utils/storage";
import { apiRequest, API_MODE, API_BASE_URL, OFFLINE_MODE_KEY, OFFLINE_QUEUE_KEY } from "@/src/api/client";
import { subscribeReachability } from "@/src/api/connectivity";
import { assignOfflineIdIfNeeded, applySyncResults, type SyncTxnResult } from "@/src/api/offlineQueueLogic";

const HEALTH_CHECK_TIMEOUT_MS = 4000;
const HEALTH_CHECK_INTERVAL_MS = 15000;

async function pingReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface OfflineSyncContextType {
  isSimulatedOffline: boolean;
  toggleSimulatedOffline: () => Promise<void>;
  isReachable: boolean;
  // True when the badge should read "Offline": either the manual simulate
  // toggle, or (in "local" API mode only) a real health check / recent
  // request failure. Demo mode never touches isReachable, so this reduces
  // to isSimulatedOffline there — unchanged from before this fix.
  isOffline: boolean;
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
  isReachable: true,
  isOffline: false,
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
  // Optimistic until the first check — demo mode never flips this (the
  // effect below is a no-op there), so it stays true and isOffline reduces
  // to isSimulatedOffline exactly as before this fix.
  const [isReachable, setIsReachable] = useState<boolean>(true);

  useEffect(() => {
    loadOfflineState();
  }, []);

  // Real reachability: a periodic health check, combined with live signals
  // from every apiRequest call (client.ts reports success/failure as it
  // happens, so a failed write shows "Offline" immediately rather than
  // waiting up to HEALTH_CHECK_INTERVAL_MS for the next poll).
  useEffect(() => {
    if (API_MODE !== "local") return;
    let cancelled = false;
    const unsubscribe = subscribeReachability((reachable) => {
      if (!cancelled) setIsReachable(reachable);
    });
    const poll = async () => {
      const reachable = await pingReachable();
      if (!cancelled) setIsReachable(reachable);
    };
    poll();
    const interval = setInterval(poll, HEALTH_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(interval);
    };
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
      payload: assignOfflineIdIfNeeded(item.entity_type, item.payload),
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

      const res = await apiRequest<{ sync_time: string; results: SyncTxnResult[] }>("/sync", {
        method: "POST",
        body: batchPayload,
      });

      // Only applied/duplicate items are done — a failed one stays queued
      // for retry (with its temp-id references rewritten to any real ids
      // that resolved in this same round), never silently dropped.
      const { remaining, appliedCount, duplicateCount, failedCount } = applySyncResults(pendingItems, res.results || []);
      setPendingItems(remaining);
      await storage.setItem(OFFLINE_QUEUE_KEY, remaining);
      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSyncTime(res.sync_time || nowStr);

      const syncedCount = appliedCount + duplicateCount;
      return failedCount > 0
        ? { success: false, message: `${syncedCount} synced, ${failedCount} failed — will retry.` }
        : { success: true, message: `Successfully synchronized ${syncedCount} record${syncedCount === 1 ? "" : "s"} with central database!` };
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

  // Auto-sync the moment the server becomes reachable again, in addition to
  // the manual Sync Now button.
  const wasReachableRef = useRef(true);
  useEffect(() => {
    const wasReachable = wasReachableRef.current;
    wasReachableRef.current = isReachable;
    if (!wasReachable && isReachable && !isSimulatedOffline) {
      syncNow();
    }
  }, [isReachable, isSimulatedOffline, syncNow]);

  const isOffline = isSimulatedOffline || !isReachable;

  return (
    <OfflineSyncContext.Provider
      value={{
        isSimulatedOffline,
        toggleSimulatedOffline,
        isReachable,
        isOffline,
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
