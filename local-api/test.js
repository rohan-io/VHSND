// Smoke test: spawns the real server against a scratch DB, hits every route
// group once, asserts status + shape. Not a full suite — just the one check
// that fails if seeding or a route breaks.
const { spawn } = require("child_process");
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const PORT = 3099;
const DB_FILE = path.join(__dirname, "test.sqlite");
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
  const patch = (p, body) => fetch(base + p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  try {
    // wait for server to come up
    for (let i = 0; i < 50; i++) {
      try {
        await get("/api/villages");
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    let res = await get("/api/villages");
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).length, 8, "expected 8 seeded villages");

    res = await get("/api/beneficiaries");
    assert.strictEqual((await res.json()).length, 16, "expected 16 seeded beneficiaries");

    res = await get("/api/beneficiaries/BEN-2026-500");
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).name, "Sasmita Jena");

    res = await get("/api/beneficiaries/NOPE");
    assert.strictEqual(res.status, 404);

    res = await post("/api/beneficiaries", { name: "Smoke Test Mother", village: "Mangarajpur" });
    assert.strictEqual(res.status, 201);
    const created = await res.json();
    assert.ok(created.id);

    res = await get("/api/sessions");
    const sessions = await res.json();
    assert.strictEqual(sessions.length, 6);

    res = await get(`/api/sessions/${sessions[0].id}/attendees`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray((await res.json()).beneficiaries));

    res = await post("/api/attendance", { session_id: sessions[0].id, anm_id: sessions[0].anm_id, status: "Present" });
    assert.strictEqual(res.status, 201);

    res = await get("/api/referrals");
    assert.strictEqual((await res.json()).length, 2);

    res = await get("/api/high-risk");
    assert.strictEqual((await res.json()).length, 12);

    res = await get("/api/beneficiary-attendance");
    assert.strictEqual(res.status, 200);
    const beneficiaryAttendance = await res.json();
    assert.strictEqual(beneficiaryAttendance.length, 4, "expected 4 seeded per-beneficiary attendance records");

    res = await get("/api/beneficiary-attendance?session_id=VHSND-2026-MGRJ-01");
    assert.strictEqual((await res.json()).length, 2);

    res = await post("/api/beneficiaries", { village: "Mangarajpur" }); // missing name
    assert.strictEqual(res.status, 400);

    // --- mobile app routes (mirrors demoDb.ts — see mobileRoutes.js) ---
    res = await post("/api/auth/login", { username: "worker01", password: "Worker@123" });
    assert.strictEqual(res.status, 200);
    const login = await res.json();
    assert.ok(login.access_token);
    assert.strictEqual(login.user.username, "worker01");

    res = await post("/api/auth/login", { username: "worker01", password: "wrong" });
    assert.strictEqual(res.status, 401);

    res = await get("/api/dashboard");
    assert.strictEqual(res.status, 200);
    assert.ok((await res.json()).summary.total_pregnancies > 0);

    res = await get("/api/pregnancies");
    let body = await res.json();
    assert.strictEqual(body.total, 50, "expected 50 seeded pregnancies");

    res = await post("/api/pregnancies", { full_name: "Smoke Test Mother", age: 26, village: "Mangarajpur", lmp: "2026-06-01" });
    assert.strictEqual(res.status, 201);
    const preg = await res.json();
    assert.ok(preg.id);

    res = await get(`/api/pregnancies/${preg.id}`);
    assert.strictEqual(res.status, 200);
    body = await res.json();
    assert.ok(body.pregnancy && Array.isArray(body.visits) && Array.isArray(body.children));

    res = await post(`/api/pregnancies/${preg.id}/visits`, { weight: 52 });
    assert.strictEqual(res.status, 201);

    res = await get("/api/children");
    assert.strictEqual((await res.json()).total, 30, "expected 30 seeded children");

    res = await get("/api/alerts");
    assert.ok((await res.json()).total > 0);

    res = await get("/api/notifications");
    assert.strictEqual((await res.json()).items.length, 3);

    res = await get("/api/admin/kpis");
    assert.strictEqual(res.status, 200);

    res = await get("/api/health-workers/USR-HW-001/supervised-team");
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).supervisor.id, "USR-HW-001");

    // --- cross-store bridges (admin <-> mobile): referrals and high-risk
    // acknowledgement must reach beneficiary_ids that only exist in the
    // mobile pregnancies collection, not just the 16 seeded relational rows.
    res = await get("/api/pregnancies");
    const allPregnancies = (await res.json()).items;
    const mobileOnlyHighRisk = allPregnancies.find(
      (p) => p.is_high_risk && !/^BEN-2026-50[0-9]$|^BEN-2026-51[0-5]$/.test(p.beneficiary_id)
    );
    assert.ok(mobileOnlyHighRisk, "expected at least one mobile-only high-risk pregnancy in the seed");

    // referral for a mobile-only beneficiary_id: used to 400, must now work
    res = await post("/api/referrals", {
      beneficiary_id: mobileOnlyHighRisk.beneficiary_id,
      facility: "CHC Sukinda",
      reason: "Cross-store smoke test",
      date: "2026-09-28",
    });
    assert.strictEqual(res.status, 201, "referral POST should accept a mobile-only beneficiary_id");
    const referral = await res.json();

    // ...and it should have created a notification for her assigned worker
    res = await get("/api/notifications");
    const notifications = (await res.json()).items;
    const referralNotif = notifications.find((n) => n.id === `NOTIF-REF-${referral.id}`);
    assert.ok(referralNotif, "expected a NOTIF-REF-* notification for the new referral");
    assert.strictEqual(referralNotif.target_user_id, mobileOnlyHighRisk.assigned_worker_id);
    assert.ok(referralNotif.message.includes(mobileOnlyHighRisk.full_name));

    // high-risk PATCH for the same mobile-only beneficiary_id: no relational
    // row exists yet, so this must upsert-create rather than 404
    res = await patch(`/api/high-risk/${mobileOnlyHighRisk.beneficiary_id}`, { status: "ACKNOWLEDGED" });
    assert.strictEqual(res.status, 201, "high-risk PATCH should upsert-create when no relational row exists");

    res = await get("/api/high-risk");
    const highRiskRows = await res.json();
    assert.ok(
      highRiskRows.some((h) => h.beneficiary_id === mobileOnlyHighRisk.beneficiary_id && h.status === "ACKNOWLEDGED"),
      "the LEFT JOIN must not drop a high-risk row with no relational beneficiaries match"
    );

    // ...and it should have acknowledged her matching mobile alerts
    res = await get("/api/alerts");
    const alertsAfterAck = (await res.json()).items;
    const herAlerts = alertsAfterAck.filter(
      (a) => a.related_entity_type === "pregnancy" && a.related_entity_id === mobileOnlyHighRisk.id
    );
    assert.ok(herAlerts.length > 0, "expected at least one alert for this pregnancy");
    assert.ok(
      herAlerts.every((a) => a.alert_type !== "HIGH_RISK_PREGNANCY" && a.alert_type !== "CRITICAL_PREGNANCY_ESCALATION" || a.status === "ACKNOWLEDGED"),
      "high-risk PATCH should have acknowledged her HIGH_RISK_PREGNANCY/CRITICAL_PREGNANCY_ESCALATION alerts"
    );

    // the upsert path still rejects a beneficiary_id nobody has ever heard
    // of — it's not a way to create a flag out of thin air
    res = await patch("/api/high-risk/BEN-DOES-NOT-EXIST-ANYWHERE", { status: "ACKNOWLEDGED" });
    assert.strictEqual(res.status, 404, "high-risk PATCH should 404 for a beneficiary_id in neither store");

    console.log("All smoke tests passed.");
  } finally {
    await new Promise((resolve) => {
      server.once("exit", resolve);
      server.kill();
    });
    for (const ext of ["", "-wal", "-shm"]) {
      const f = DB_FILE + ext;
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {
        // Windows can briefly hold the file handle after process exit; not worth retrying for a scratch file.
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
