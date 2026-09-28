// Pure logic for the offline sync queue, no react-native/expo imports — used
// by OfflineSyncContext.tsx (which does the actual storage I/O). Kept
// separate so it's directly unit-testable. See the mobile-dashboard sync
// audit, Findings 1/3/4.
import type { OfflineSyncItem } from "../types";

const OFFLINE_ID_ENTITY_TYPES = new Set(["pregnancy", "child"]);

// A pregnancy/child registered offline needs its own id right away so a
// same-session offline ANC visit for her can reference it — local-api's
// /sync resolves an "OFFLINE-..." id to the real server id it mints,
// including within one batch (register + visit together).
export function assignOfflineIdIfNeeded(entityType: OfflineSyncItem["entity_type"], payload: any) {
  if (!OFFLINE_ID_ENTITY_TYPES.has(entityType) || payload?.id) return payload;
  return { ...payload, id: `OFFLINE-${entityType.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
}

export interface SyncTxnResult {
  client_txn_id: string;
  status: "applied" | "duplicate" | "failed";
  server_id?: string;
  error?: string;
  entity_type?: string;
}

export interface ApplySyncResultsOutcome {
  remaining: OfflineSyncItem[];
  appliedCount: number;
  duplicateCount: number;
  failedCount: number;
}

const TEMP_ID_REFERENCE_KEYS = ["pregnancy_id", "mother_id", "child_id"];

function rewriteTempIdReferences(item: OfflineSyncItem, idMap: Record<string, string>): OfflineSyncItem {
  const payload = item.payload;
  if (!payload || typeof payload !== "object") return item;
  let changed = false;
  const next = { ...payload };
  for (const key of TEMP_ID_REFERENCE_KEYS) {
    if (next[key] && idMap[next[key]]) {
      next[key] = idMap[next[key]];
      changed = true;
    }
  }
  return changed ? { ...item, payload: next } : item;
}

// Applies a POST /api/sync response to the locally queued items: drops
// applied/duplicate ones (they're on the server now), keeps failed ones for
// retry (recording why, so the UI can be honest instead of showing a
// generic "Waiting"), and rewrites any kept item's reference to a
// now-resolved temp offline id — so a retry doesn't fail again on a stale
// id, and the mother it points at is never shown under two different ids.
export function applySyncResults(pending: OfflineSyncItem[], results: SyncTxnResult[]): ApplySyncResultsOutcome {
  const byTxnId = new Map(results.map((r) => [r.client_txn_id, r]));

  const idMap: Record<string, string> = {};
  for (const item of pending) {
    const result = byTxnId.get(item.client_txn_id);
    if (result?.status === "applied" && result.server_id && item.payload?.id) {
      idMap[item.payload.id] = result.server_id;
    }
  }

  const remaining: OfflineSyncItem[] = [];
  let appliedCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  for (const item of pending) {
    const result = byTxnId.get(item.client_txn_id);
    if (!result) {
      remaining.push(item); // not part of this sync response — leave untouched
      continue;
    }
    if (result.status === "applied") {
      appliedCount++;
      continue;
    }
    if (result.status === "duplicate") {
      duplicateCount++;
      continue;
    }
    failedCount++;
    remaining.push({ ...rewriteTempIdReferences(item, idMap), lastSyncError: result.error });
  }

  return { remaining, appliedCount, duplicateCount, failedCount };
}
