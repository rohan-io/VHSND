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

    res = await get("/api/pregnancies");
    assert.strictEqual((await res.json()).length, 16);

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

    res = await post("/api/beneficiaries", { village: "Mangarajpur" }); // missing name
    assert.strictEqual(res.status, 400);

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
