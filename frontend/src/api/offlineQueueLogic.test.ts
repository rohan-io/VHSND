import { describe, it, expect } from "vitest";
import {
  assignOfflineIdIfNeeded,
  applySyncResults,
  type SyncTxnResult,
} from "./offlineQueueLogic";
import type { OfflineSyncItem } from "../types";

const item = (over: Partial<OfflineSyncItem>): OfflineSyncItem => ({
  client_txn_id: "TXN-1",
  entity_type: "pregnancy",
  payload: {},
  timestamp: "2026-09-28T00:00:00.000Z",
  display_title: "t",
  display_subtitle: "s",
  ...over,
});

describe("assignOfflineIdIfNeeded", () => {
  it("assigns a temp OFFLINE- id to a pregnancy payload with no id, so a same-batch offline visit can reference her", () => {
    const payload = assignOfflineIdIfNeeded("pregnancy", { full_name: "AUDIT-Mother" });
    expect(payload.id).toMatch(/^OFFLINE-/);
  });

  it("assigns a temp id for a child payload too", () => {
    const payload = assignOfflineIdIfNeeded("child", { child_name: "AUDIT-Child" });
    expect(payload.id).toMatch(/^OFFLINE-/);
  });

  it("does not overwrite an id the payload already has", () => {
    const payload = assignOfflineIdIfNeeded("pregnancy", { id: "PREG-2026-1000", full_name: "x" });
    expect(payload.id).toBe("PREG-2026-1000");
  });

  it("leaves anc_visit/imm payloads untouched — they reference a pregnancy, they don't need their own temp id", () => {
    const payload = assignOfflineIdIfNeeded("anc_visit", { pregnancy_id: "OFFLINE-X" });
    expect(payload.id).toBeUndefined();
  });
});

describe("applySyncResults", () => {
  it("removes an item whose result is 'applied'", () => {
    const pending = [item({ client_txn_id: "T1" })];
    const results: SyncTxnResult[] = [{ client_txn_id: "T1", status: "applied", server_id: "PREG-REAL-1" }];
    const { remaining, appliedCount } = applySyncResults(pending, results);
    expect(remaining).toHaveLength(0);
    expect(appliedCount).toBe(1);
  });

  it("removes an item whose result is 'duplicate'", () => {
    const pending = [item({ client_txn_id: "T1" })];
    const results: SyncTxnResult[] = [{ client_txn_id: "T1", status: "duplicate", server_id: "PREG-REAL-1" }];
    const { remaining, duplicateCount } = applySyncResults(pending, results);
    expect(remaining).toHaveLength(0);
    expect(duplicateCount).toBe(1);
  });

  it("KEEPS an item whose result is 'failed' — it must stay queued for retry, never silently dropped", () => {
    const pending = [item({ client_txn_id: "T1" })];
    const results: SyncTxnResult[] = [{ client_txn_id: "T1", status: "failed", error: "Pregnancy not found" }];
    const { remaining, failedCount } = applySyncResults(pending, results);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].client_txn_id).toBe("T1");
    expect(failedCount).toBe(1);
  });

  it("records the failure reason on a kept item, so the UI can show it honestly instead of a generic 'Waiting'", () => {
    const pending = [item({ client_txn_id: "T1" })];
    const results: SyncTxnResult[] = [{ client_txn_id: "T1", status: "failed", error: "Pregnancy not found" }];
    const { remaining } = applySyncResults(pending, results);
    expect(remaining[0].lastSyncError).toBe("Pregnancy not found");
  });

  it("leaves an item alone if the response has no result for it at all", () => {
    const pending = [item({ client_txn_id: "T1" }), item({ client_txn_id: "T2" })];
    const results: SyncTxnResult[] = [{ client_txn_id: "T1", status: "applied", server_id: "X" }];
    const { remaining } = applySyncResults(pending, results);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].client_txn_id).toBe("T2");
  });

  it("replaces a temp offline id with the real server_id inside any KEPT item that references it, so a retry doesn't fail again on a stale id, and a mother never appears twice under two ids", () => {
    const pending = [
      item({
        client_txn_id: "T-PREG",
        entity_type: "pregnancy",
        payload: { id: "OFFLINE-PREG-1", full_name: "AUDIT-Mother" },
      }),
      item({
        client_txn_id: "T-VISIT",
        entity_type: "anc_visit",
        payload: { pregnancy_id: "OFFLINE-PREG-1", visit_number: 1 },
      }),
    ];
    const results: SyncTxnResult[] = [
      { client_txn_id: "T-PREG", status: "applied", server_id: "PREG-REAL-1" },
      { client_txn_id: "T-VISIT", status: "failed", error: "some transient error" },
    ];
    const { remaining } = applySyncResults(pending, results);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].client_txn_id).toBe("T-VISIT");
    expect(remaining[0].payload.pregnancy_id).toBe("PREG-REAL-1");
  });
});
