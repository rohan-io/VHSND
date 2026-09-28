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
