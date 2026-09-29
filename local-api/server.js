require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const mobileDb = require("./mobileDb");

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

const now = () => new Date().toISOString();
const notFound = (res, what) => res.status(404).json({ error: `${what} not found` });
const parseArr = (s) => (s ? JSON.parse(s) : []);

// ---------------------------------------------------------------------------
// Cross-store bridges: the mobile store (mobile_records, via mobileDb.js) is
// the source of truth for mothers/alerts; these two relational routes
// (referrals, high-risk) reach into it in-process — same server, same DB
// connection, no HTTP round-trip — so admin actions become visible on the
// mobile-facing endpoints. Both are best-effort: a missing mobile pregnancy
// (shouldn't happen once admin only ever offers real pregnancy-backed
// beneficiary_ids, but cheap to guard) logs and moves on rather than failing
// the admin action that triggered it.
// ---------------------------------------------------------------------------
function findMobilePregnancy(beneficiaryId) {
  return mobileDb.all("pregnancies").find((p) => p.beneficiary_id === beneficiaryId);
}

function createReferralNotification(referral) {
  const pregnancy = findMobilePregnancy(referral.beneficiary_id);
  if (!pregnancy) {
    console.log(`[referral] no mobile pregnancy found for ${referral.beneficiary_id}, skipping notification`);
    return;
  }
  const notifId = `NOTIF-REF-${referral.id}`;
  mobileDb.put("notifications", notifId, {
    id: notifId,
    title: "New Referral",
    message: `Referral: ${referral.beneficiary_name} referred to ${referral.facility} - ${referral.reason}`,
    priority: "HIGH",
    category: "Referral",
    beneficiary_name: referral.beneficiary_name,
    created_at: now(),
    is_read: false,
    target_user_id: pregnancy.assigned_worker_id,
  });
}

function cascadeHighRiskAcknowledgement(beneficiaryId, status) {
  if (status !== "ACKNOWLEDGED") return;
  const pregnancy = findMobilePregnancy(beneficiaryId);
  if (!pregnancy) {
    console.log(`[high-risk] no mobile pregnancy found for ${beneficiaryId}, skipping alert acknowledgement`);
    return;
  }
  const matching = mobileDb
    .all("alerts")
    .filter(
      (a) =>
        a.related_entity_type === "pregnancy" &&
        a.related_entity_id === pregnancy.id &&
        a.status === "ACTIVE" &&
        (a.alert_type === "HIGH_RISK_PREGNANCY" || a.alert_type === "CRITICAL_PREGNANCY_ESCALATION")
    );
  if (matching.length === 0) {
    console.log(`[high-risk] no active mobile alerts matched pregnancy ${pregnancy.id}`);
    return;
  }
  for (const a of matching) mobileDb.put("alerts", a.id, { ...a, status: "ACKNOWLEDGED" });
}

// ---------------------------------------------------------------------------
// beneficiaries
// ---------------------------------------------------------------------------
app.get("/api/beneficiaries", (req, res) => {
  const { village } = req.query;
  const rows = village
    ? db.prepare("SELECT * FROM beneficiaries WHERE village = ? ORDER BY created_at DESC").all(village)
    : db.prepare("SELECT * FROM beneficiaries ORDER BY created_at DESC").all();
  res.json(rows);
});

app.get("/api/beneficiaries/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM beneficiaries WHERE id = ?").get(req.params.id);
  if (!row) return notFound(res, "Beneficiary");
  res.json(row);
});

app.post("/api/beneficiaries", (req, res) => {
  const { name, village } = req.body || {};
  if (!name || !village) return res.status(400).json({ error: "name and village are required" });

  const id = req.body.id || `BEN-LOCAL-${Date.now()}`;
  const row = {
    id,
    name,
    husband_name: req.body.husband_name || null,
    age: req.body.age ?? null,
    village,
    block: req.body.block || null,
    contact: req.body.contact || null,
    anm_id: req.body.anm_id || null,
    anm_name: req.body.anm_name || null,
    status: req.body.status || "active",
    created_at: now(),
    updated_at: now(),
  };
  db.prepare(`
    INSERT INTO beneficiaries (id, name, husband_name, age, village, block, contact, anm_id, anm_name, status, created_at, updated_at)
    VALUES (@id, @name, @husband_name, @age, @village, @block, @contact, @anm_id, @anm_name, @status, @created_at, @updated_at)
  `).run(row);
  res.status(201).json(row);
});

app.patch("/api/beneficiaries/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM beneficiaries WHERE id = ?").get(req.params.id);
  if (!existing) return notFound(res, "Beneficiary");

  const updated = { ...existing, ...req.body, id: existing.id, updated_at: now() };
  db.prepare(`
    UPDATE beneficiaries SET name=@name, husband_name=@husband_name, age=@age, village=@village,
      block=@block, contact=@contact, anm_id=@anm_id, anm_name=@anm_name, status=@status, updated_at=@updated_at
    WHERE id=@id
  `).run(updated);
  res.json(updated);
});

// ---------------------------------------------------------------------------
// NOTE: pregnancies are served by mobileRoutes.js (mounted below), not here.
// Phase 1 had a thin admin-web-shaped /api/pregnancies here; Phase 2 replaced
// it because the mobile app's real client (frontend/src/api/mch.ts) needs the
// full demoDb.ts-shaped record (name, vitals, ANC visits, etc.), not this
// beneficiary_id/trimester/risk_reasons stub. Admin-web isn't wired yet
// (Phase 3) — when it is, it should consume the same /api/pregnancies.
// ---------------------------------------------------------------------------
// VHSND sessions
// ---------------------------------------------------------------------------
const serializeSession = (row) => ({ ...row, expected_beneficiary_ids: parseArr(row.expected_beneficiary_ids) });

app.get("/api/sessions", (req, res) => {
  const rows = db.prepare("SELECT * FROM vhsnd_sessions ORDER BY date ASC").all();
  res.json(rows.map(serializeSession));
});

app.post("/api/sessions", (req, res) => {
  const { village, date } = req.body || {};
  if (!village || !date) return res.status(400).json({ error: "village and date are required" });

  const row = {
    id: req.body.id || `VHSND-LOCAL-${Date.now()}`,
    village,
    block: req.body.block || null,
    date,
    anm_id: req.body.anm_id || null,
    anm_name: req.body.anm_name || null,
    expected_beneficiary_ids: JSON.stringify(req.body.expected_beneficiary_ids || []),
    created_at: now(),
  };
  db.prepare(`
    INSERT INTO vhsnd_sessions (id, village, block, date, anm_id, anm_name, expected_beneficiary_ids, created_at)
    VALUES (@id, @village, @block, @date, @anm_id, @anm_name, @expected_beneficiary_ids, @created_at)
  `).run(row);
  res.status(201).json(serializeSession(row));
});

app.get("/api/sessions/:id/attendees", (req, res) => {
  const session = db.prepare("SELECT * FROM vhsnd_sessions WHERE id = ?").get(req.params.id);
  if (!session) return notFound(res, "Session");

  const ids = parseArr(session.expected_beneficiary_ids);
  const placeholders = ids.map(() => "?").join(",");
  const beneficiaries = ids.length
    ? db.prepare(`SELECT * FROM beneficiaries WHERE id IN (${placeholders})`).all(...ids)
    : [];
  res.json({ session_id: session.id, expected_beneficiary_ids: ids, beneficiaries });
});

// ---------------------------------------------------------------------------
// ANM attendance
// ---------------------------------------------------------------------------
app.get("/api/attendance", (req, res) => {
  const { session_id } = req.query;
  const rows = session_id
    ? db.prepare("SELECT * FROM anm_attendance WHERE session_id = ? ORDER BY created_at DESC").all(session_id)
    : db.prepare("SELECT * FROM anm_attendance ORDER BY created_at DESC").all();
  res.json(rows);
});

app.post("/api/attendance", (req, res) => {
  const { session_id, anm_id, anm_name } = req.body || {};
  if (!session_id || !anm_id) return res.status(400).json({ error: "session_id and anm_id are required" });

  const session = db.prepare("SELECT id FROM vhsnd_sessions WHERE id = ?").get(session_id);
  if (!session) return res.status(400).json({ error: "session_id does not exist" });

  const row = {
    session_id,
    anm_id,
    anm_name: anm_name || null,
    status: req.body.status || "Present",
    check_in_time: req.body.check_in_time || null,
    created_at: now(),
  };
  const info = db.prepare(`
    INSERT INTO anm_attendance (session_id, anm_id, anm_name, status, check_in_time, created_at)
    VALUES (@session_id, @anm_id, @anm_name, @status, @check_in_time, @created_at)
  `).run(row);
  res.status(201).json({ id: info.lastInsertRowid, ...row });
});

app.patch("/api/attendance/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM anm_attendance WHERE id = ?").get(req.params.id);
  if (!existing) return notFound(res, "Attendance record");

  const updated = { ...existing, ...req.body, id: existing.id };
  db.prepare(`
    UPDATE anm_attendance SET status=@status, check_in_time=@check_in_time WHERE id=@id
  `).run(updated);
  res.json(updated);
});

// ---------------------------------------------------------------------------
// beneficiary attendance (per-beneficiary VHSND attendance — distinct from
// anm_attendance, which is whether the ANM herself showed up)
// ---------------------------------------------------------------------------
app.get("/api/beneficiary-attendance", (req, res) => {
  const { session_id } = req.query;
  const rows = session_id
    ? db.prepare("SELECT * FROM beneficiary_attendance WHERE session_id = ?").all(session_id)
    : db.prepare("SELECT * FROM beneficiary_attendance ORDER BY created_at DESC").all();
  res.json(rows);
});

// ---------------------------------------------------------------------------
// referrals
// ---------------------------------------------------------------------------
app.get("/api/referrals", (req, res) => {
  const rows = db.prepare("SELECT * FROM referrals ORDER BY date DESC").all();
  res.json(rows);
});

app.post("/api/referrals", (req, res) => {
  const { beneficiary_id, facility, reason, date } = req.body || {};
  if (!beneficiary_id || !facility || !reason || !date)
    return res.status(400).json({ error: "beneficiary_id, facility, reason and date are required" });

  // beneficiary_id may only exist in the mobile store now (any pregnancy,
  // not just the 16 seeded relational rows) — accept either.
  const beneficiary = db.prepare("SELECT id, name FROM beneficiaries WHERE id = ?").get(beneficiary_id);
  const pregnancy = findMobilePregnancy(beneficiary_id);
  if (!beneficiary && !pregnancy) return res.status(400).json({ error: "beneficiary_id does not exist" });

  const row = {
    id: req.body.id || `REF-LOCAL-${Date.now()}`,
    beneficiary_id,
    beneficiary_name: req.body.beneficiary_name || beneficiary?.name || pregnancy?.full_name || beneficiary_id,
    facility,
    reason,
    date,
    follow_up_status: req.body.follow_up_status || "Pending",
    notes: req.body.notes || null,
    created_at: now(),
  };
  db.prepare(`
    INSERT INTO referrals (id, beneficiary_id, beneficiary_name, facility, reason, date, follow_up_status, notes, created_at)
    VALUES (@id, @beneficiary_id, @beneficiary_name, @facility, @reason, @date, @follow_up_status, @notes, @created_at)
  `).run(row);
  createReferralNotification(row);
  res.status(201).json(row);
});

app.patch("/api/referrals/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM referrals WHERE id = ?").get(req.params.id);
  if (!existing) return notFound(res, "Referral");

  const updated = { ...existing, ...req.body, id: existing.id };
  db.prepare(`
    UPDATE referrals SET follow_up_status=@follow_up_status, notes=@notes WHERE id=@id
  `).run(updated);
  res.json(updated);
});

// ---------------------------------------------------------------------------
// high-risk
// ---------------------------------------------------------------------------
const serializeHighRisk = (row) => ({
  ...row,
  reasons: parseArr(row.reasons),
  auto_flags: parseArr(row.auto_flags),
  manual_flags: parseArr(row.manual_flags),
});

app.get("/api/high-risk", (req, res) => {
  // LEFT JOIN: a high_risk_flags row may now exist for a beneficiary_id with
  // no relational beneficiaries row at all (any mobile-only high-risk
  // mother, upserted via PATCH below) — an INNER JOIN would silently drop
  // her from this list, breaking admin-web's join-by-beneficiary_id lookup.
  const rows = db.prepare(`
    SELECT h.*, b.name, b.village, b.age, b.anm_id, b.anm_name
    FROM high_risk_flags h LEFT JOIN beneficiaries b ON b.id = h.beneficiary_id
    ORDER BY h.updated_at DESC
  `).all();
  res.json(rows.map(serializeHighRisk));
});

app.get("/api/high-risk/:id", (req, res) => {
  const row = db.prepare(`
    SELECT h.*, b.name, b.village, b.age, b.anm_id, b.anm_name
    FROM high_risk_flags h LEFT JOIN beneficiaries b ON b.id = h.beneficiary_id
    WHERE h.beneficiary_id = ?
  `).get(req.params.id);
  if (!row) return notFound(res, "High-risk record");
  res.json(serializeHighRisk(row));
});

app.patch("/api/high-risk/:id", (req, res) => {
  const beneficiaryId = req.params.id;
  const existing = db.prepare("SELECT * FROM high_risk_flags WHERE beneficiary_id = ?").get(beneficiaryId);

  if (!existing) {
    // Upsert-create: no relational row yet — e.g. a mobile-only high-risk
    // mother (union-merged into admin-web's view, see its adapters.ts).
    // beneficiary_id must still exist in one of the two stores, though —
    // this isn't a way to create a flag for an id nobody has ever heard of.
    const beneficiaryRow = db.prepare("SELECT id FROM beneficiaries WHERE id = ?").get(beneficiaryId);
    const pregnancy = findMobilePregnancy(beneficiaryId);
    if (!beneficiaryRow && !pregnancy) return notFound(res, "Beneficiary");

    // Default reasons from her mobile pregnancy record when not provided.
    const created = {
      beneficiary_id: beneficiaryId,
      risk_category: req.body.risk_category || "Mobile-flagged",
      reasons: JSON.stringify(req.body.reasons || pregnancy?.high_risk_reasons || []),
      auto_flags: JSON.stringify(req.body.auto_flags || pregnancy?.high_risk_reasons || []),
      manual_flags: JSON.stringify(req.body.manual_flags || []),
      status: req.body.status || "ACTIVE",
      updated_at: now(),
    };
    db.prepare(`
      INSERT INTO high_risk_flags (beneficiary_id, risk_category, reasons, auto_flags, manual_flags, status, updated_at)
      VALUES (@beneficiary_id, @risk_category, @reasons, @auto_flags, @manual_flags, @status, @updated_at)
    `).run(created);
    cascadeHighRiskAcknowledgement(beneficiaryId, created.status);
    return res.status(201).json(serializeHighRisk(created));
  }

  const updated = {
    ...existing,
    ...req.body,
    beneficiary_id: existing.beneficiary_id,
    reasons: req.body.reasons ? JSON.stringify(req.body.reasons) : existing.reasons,
    auto_flags: req.body.auto_flags ? JSON.stringify(req.body.auto_flags) : existing.auto_flags,
    manual_flags: req.body.manual_flags ? JSON.stringify(req.body.manual_flags) : existing.manual_flags,
    updated_at: now(),
  };
  db.prepare(`
    UPDATE high_risk_flags SET risk_category=@risk_category, reasons=@reasons,
      auto_flags=@auto_flags, manual_flags=@manual_flags, status=@status, updated_at=@updated_at
    WHERE beneficiary_id=@beneficiary_id
  `).run(updated);
  cascadeHighRiskAcknowledgement(beneficiaryId, updated.status);
  res.json(serializeHighRisk(updated));
});

// ---------------------------------------------------------------------------
// villages (read-only reference data, used by both apps for filters/forms)
// ---------------------------------------------------------------------------
app.get("/api/villages", (req, res) => {
  res.json(db.prepare("SELECT * FROM villages ORDER BY name ASC").all());
});

// NOTE: /api/children is served by mobileRoutes.js below (same reasoning as
// pregnancies, above). This admin-web-shaped children table is now unused by
// any route but kept seeded for when admin-web is wired in Phase 3.

// ---------------------------------------------------------------------------
// mobile app routes (auth, dashboard, pregnancies, children, alerts,
// notifications, admin/kpis, supervised-team) — see mobileRoutes.js
// ---------------------------------------------------------------------------
app.use("/api", require("./mobileRoutes"));

// ---------------------------------------------------------------------------
// 404 + error handling
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
