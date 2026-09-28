require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");

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
// pregnancies
// ---------------------------------------------------------------------------
const serializePregnancy = (row) => ({ ...row, is_high_risk: !!row.is_high_risk, risk_reasons: parseArr(row.risk_reasons) });

app.get("/api/pregnancies", (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare("SELECT * FROM pregnancies WHERE status = ? ORDER BY created_at DESC").all(status)
    : db.prepare("SELECT * FROM pregnancies ORDER BY created_at DESC").all();
  res.json(rows.map(serializePregnancy));
});

app.get("/api/pregnancies/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM pregnancies WHERE id = ?").get(req.params.id);
  if (!row) return notFound(res, "Pregnancy");
  res.json(serializePregnancy(row));
});

app.post("/api/pregnancies", (req, res) => {
  const { beneficiary_id, trimester } = req.body || {};
  if (!beneficiary_id || !trimester) return res.status(400).json({ error: "beneficiary_id and trimester are required" });

  const beneficiary = db.prepare("SELECT id FROM beneficiaries WHERE id = ?").get(beneficiary_id);
  if (!beneficiary) return res.status(400).json({ error: "beneficiary_id does not exist" });

  const row = {
    id: req.body.id || `PREG-LOCAL-${Date.now()}`,
    beneficiary_id,
    trimester,
    gestational_age_label: req.body.gestational_age_label || null,
    is_high_risk: req.body.is_high_risk ? 1 : 0,
    risk_reasons: JSON.stringify(req.body.risk_reasons || []),
    status: req.body.status || "active",
    created_at: now(),
    updated_at: now(),
  };
  db.prepare(`
    INSERT INTO pregnancies (id, beneficiary_id, trimester, gestational_age_label, is_high_risk, risk_reasons, status, created_at, updated_at)
    VALUES (@id, @beneficiary_id, @trimester, @gestational_age_label, @is_high_risk, @risk_reasons, @status, @created_at, @updated_at)
  `).run(row);
  res.status(201).json(serializePregnancy(row));
});

app.patch("/api/pregnancies/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM pregnancies WHERE id = ?").get(req.params.id);
  if (!existing) return notFound(res, "Pregnancy");

  const updated = {
    ...existing,
    ...req.body,
    id: existing.id,
    is_high_risk: req.body.is_high_risk !== undefined ? (req.body.is_high_risk ? 1 : 0) : existing.is_high_risk,
    risk_reasons: req.body.risk_reasons ? JSON.stringify(req.body.risk_reasons) : existing.risk_reasons,
    updated_at: now(),
  };
  db.prepare(`
    UPDATE pregnancies SET trimester=@trimester, gestational_age_label=@gestational_age_label,
      is_high_risk=@is_high_risk, risk_reasons=@risk_reasons, status=@status, updated_at=@updated_at
    WHERE id=@id
  `).run(updated);
  res.json(serializePregnancy(updated));
});

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

  const beneficiary = db.prepare("SELECT id, name FROM beneficiaries WHERE id = ?").get(beneficiary_id);
  if (!beneficiary) return res.status(400).json({ error: "beneficiary_id does not exist" });

  const row = {
    id: req.body.id || `REF-LOCAL-${Date.now()}`,
    beneficiary_id,
    beneficiary_name: req.body.beneficiary_name || beneficiary.name,
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
  const rows = db.prepare(`
    SELECT h.*, b.name, b.village, b.age, b.anm_id, b.anm_name
    FROM high_risk_flags h JOIN beneficiaries b ON b.id = h.beneficiary_id
    ORDER BY h.updated_at DESC
  `).all();
  res.json(rows.map(serializeHighRisk));
});

app.get("/api/high-risk/:id", (req, res) => {
  const row = db.prepare(`
    SELECT h.*, b.name, b.village, b.age, b.anm_id, b.anm_name
    FROM high_risk_flags h JOIN beneficiaries b ON b.id = h.beneficiary_id
    WHERE h.beneficiary_id = ?
  `).get(req.params.id);
  if (!row) return notFound(res, "High-risk record");
  res.json(serializeHighRisk(row));
});

app.patch("/api/high-risk/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM high_risk_flags WHERE beneficiary_id = ?").get(req.params.id);
  if (!existing) return notFound(res, "High-risk record");

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
  res.json(serializeHighRisk(updated));
});

// ---------------------------------------------------------------------------
// villages (read-only reference data, used by both apps for filters/forms)
// ---------------------------------------------------------------------------
app.get("/api/villages", (req, res) => {
  res.json(db.prepare("SELECT * FROM villages ORDER BY name ASC").all());
});

app.get("/api/children", (req, res) => {
  res.json(db.prepare("SELECT * FROM children ORDER BY created_at DESC").all());
});

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
