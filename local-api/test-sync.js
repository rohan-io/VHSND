// AUDIT fix regression tests for POST /api/sync (audit Finding 1: the
// endpoint used to be a stub that echoed a fake count without ever reading
// req.body.transactions). Same spawn-a-real-server-against-a-scratch-db
// pattern as test.js, kept in its own file since it's a focused batch of
// sync-specific cases rather than one smoke pass over every route.
const { spawn } = require("child_process");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const PORT = 3098;
const DB_FILE = path.join(__dirname, "test-sync.sqlite");
for (const ext of ["", "-wal", "-shm"]) {
  const f = DB_FILE + ext;
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT), DB_FILE, NODE_ENV: "test" },
  });
  server.stdout.on("data", () => {});
  server.stderr.on("data", (d) => process.stderr.write(d));

  const base = `http://localhost:${PORT}`;
  const get = (p) => fetch(base + p);
  const post = (p, body) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  try {
    for (let i = 0; i < 50; i++) {
      try { await get("/api/health"); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }

    const countPregnancies = async () => (await (await get("/api/pregnancies")).json()).total;
    const before = await countPregnancies();

    // --- AUDIT-1: a single "pregnancy" transaction must actually create a
    // pregnancy and report it as applied with the real server id ---
    const txn1 = { client_txn_id: "AUDIT-TXN-1", entity_type: "pregnancy", payload: { id: "OFFLINE-PREG-AUDIT-1", full_name: "AUDIT-Mother-Sync", age: 26, village: "Mangarajpur", lmp: "2026-06-01" }, worker_id: "USR-HW-002", timestamp: new Date().toISOString() };
    let res = await post("/api/sync", { transactions: [txn1] });
    assert.strictEqual(res.status, 200);
    let body = await res.json();
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0].status, "applied", "expected the transaction to be applied, not silently discarded");
    assert.strictEqual(body.results[0].client_txn_id, "AUDIT-TXN-1");
    const serverId1 = body.results[0].server_id;
    assert.ok(serverId1, "expected a real server id back");
    assert.notStrictEqual(serverId1, "OFFLINE-PREG-AUDIT-1", "the client's temp offline id must never become the permanent id");

    assert.strictEqual(await countPregnancies(), before + 1, "sync must actually persist the pregnancy");
    res = await get(`/api/pregnancies/${serverId1}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).pregnancy.full_name, "AUDIT-Mother-Sync");

    // --- AUDIT-2: idempotency — replaying the exact same client_txn_id must
    // not create a second row, and must be reported as "duplicate" ---
    res = await post("/api/sync", { transactions: [txn1] });
    body = await res.json();
    assert.strictEqual(body.results[0].status, "duplicate", "resending the same client_txn_id must be recognized as a duplicate, not reapplied");
    assert.strictEqual(body.results[0].server_id, serverId1, "duplicate result should still report the original server id");
    assert.strictEqual(await countPregnancies(), before + 1, "duplicate replay must not create a second row");

    // --- AUDIT-3: temp-id mapping within one batch — an offline-registered
    // mother and her offline-recorded first ANC visit, synced together, must
    // link the visit to the real (not temp) pregnancy id ---
    const tempPregId = "OFFLINE-PREG-AUDIT-3";
    const batch = {
      transactions: [
        { client_txn_id: "AUDIT-TXN-3A", entity_type: "pregnancy", payload: { id: tempPregId, full_name: "AUDIT-Mother-Chain", age: 24, village: "Kantira", lmp: "2026-05-01" }, worker_id: "USR-HW-002", timestamp: new Date().toISOString() },
        { client_txn_id: "AUDIT-TXN-3B", entity_type: "anc_visit", payload: { pregnancy_id: tempPregId, visit_number: 1, weight: 50 }, worker_id: "USR-HW-002", timestamp: new Date().toISOString() },
      ],
    };
    res = await post("/api/sync", batch);
    body = await res.json();
    assert.strictEqual(body.results.length, 2);
    assert.strictEqual(body.results[0].status, "applied");
    const realPregId = body.results[0].server_id;
    assert.strictEqual(body.results[1].status, "applied", "the chained visit must apply, not fail for referencing a not-yet-synced pregnancy");
    const visitServerId = body.results[1].server_id;

    res = await get(`/api/pregnancies/${realPregId}`);
    body = await res.json();
    assert.strictEqual(body.visits.length, 1);
    assert.strictEqual(body.visits[0].id, visitServerId);
    assert.strictEqual(body.visits[0].pregnancy_id, realPregId, "the visit must be linked to the real server pregnancy id, not the temp offline id");

    // no stray record was ever created under the temp id itself
    res = await get(`/api/pregnancies/${tempPregId}`);
    assert.strictEqual(res.status, 404);

    // --- AUDIT-4: a transaction that can never resolve (no matching
    // pregnancy, in this batch or already synced) must fail cleanly, not
    // crash the batch or silently succeed ---
    const batch2 = {
      transactions: [
        { client_txn_id: "AUDIT-TXN-4A", entity_type: "anc_visit", payload: { pregnancy_id: "OFFLINE-DOES-NOT-EXIST", visit_number: 1 }, worker_id: "USR-HW-002", timestamp: new Date().toISOString() },
        { client_txn_id: "AUDIT-TXN-4B", entity_type: "pregnancy", payload: { full_name: "AUDIT-Mother-AfterFailure", age: 25, village: "Nuadihi", lmp: "2026-05-15" }, worker_id: "USR-HW-002", timestamp: new Date().toISOString() },
      ],
    };
    res = await post("/api/sync", batch2);
    assert.strictEqual(res.status, 200, "a failed transaction inside a batch must not 500 the whole request");
    body = await res.json();
    assert.strictEqual(body.results[0].status, "failed");
    assert.ok(body.results[0].error, "expected an error message for the failed transaction");
    assert.strictEqual(body.results[1].status, "applied", "a later transaction in the same batch must still be processed after an earlier one fails");

    // --- AUDIT-5: a transaction that FAILS must be retried (not dropped as
    // a false duplicate) when the same client_txn_id comes in again, and
    // once it succeeds it must end up applied exactly once — a later replay
    // of the same id is then a true duplicate ---
    const retryTxnId = "AUDIT-TXN-5-VISIT";
    const tempPregId5 = "OFFLINE-PREG-AUDIT-5";

    res = await post("/api/sync", {
      transactions: [
        { client_txn_id: retryTxnId, entity_type: "anc_visit", payload: { pregnancy_id: tempPregId5, visit_number: 1 }, worker_id: "USR-HW-002", timestamp: new Date().toISOString() },
      ],
    });
    body = await res.json();
    assert.strictEqual(body.results[0].status, "failed", "a visit for a pregnancy that doesn't exist anywhere yet must fail");

    res = await post("/api/sync", {
      transactions: [
        { client_txn_id: "AUDIT-TXN-5-PREG", entity_type: "pregnancy", payload: { id: tempPregId5, full_name: "AUDIT-Mother-Retry", age: 27, village: "Singadia", lmp: "2026-05-10" }, worker_id: "USR-HW-002", timestamp: new Date().toISOString() },
        { client_txn_id: retryTxnId, entity_type: "anc_visit", payload: { pregnancy_id: tempPregId5, visit_number: 1 }, worker_id: "USR-HW-002", timestamp: new Date().toISOString() },
      ],
    });
    body = await res.json();
    assert.strictEqual(body.results[0].status, "applied");
    const retryPregId = body.results[0].server_id;
    assert.strictEqual(body.results[1].status, "applied", "a previously-failed client_txn_id must be retried, not reported as a duplicate and dropped");
    const retryVisitId = body.results[1].server_id;

    res = await get(`/api/pregnancies/${retryPregId}`);
    body = await res.json();
    assert.strictEqual(body.visits.length, 1, "the visit must end up applied exactly once across the failed attempt + successful retry");
    assert.strictEqual(body.visits[0].id, retryVisitId);

    res = await post("/api/sync", {
      transactions: [
        { client_txn_id: retryTxnId, entity_type: "anc_visit", payload: { pregnancy_id: tempPregId5, visit_number: 1 }, worker_id: "USR-HW-002", timestamp: new Date().toISOString() },
      ],
    });
    body = await res.json();
    assert.strictEqual(body.results[0].status, "duplicate", "once applied, the same client_txn_id must not be reapplied again");
    res = await get(`/api/pregnancies/${retryPregId}`);
    body = await res.json();
    assert.strictEqual(body.visits.length, 1, "still exactly one visit after the post-success duplicate replay");

    console.log("All sync tests passed.");
  } finally {
    await new Promise((resolve) => {
      server.once("exit", resolve);
      server.kill();
    });
    for (const ext of ["", "-wal", "-shm"]) {
      const f = DB_FILE + ext;
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
