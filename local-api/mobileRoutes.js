// Routes the mobile app's real data layer (frontend/src/api/mch.ts +
// AuthContext.tsx) actually calls — ported from demoDb.ts's demoRequest()
// router so pointing EXPO_PUBLIC_API_MODE=local at this server is a drop-in
// swap for offline demo mode. These paths supersede local-api's earlier
// admin-web-shaped /pregnancies and /children routes (see README).
const express = require("express");
const mobileDb = require("./mobileDb");
const { assessRisk } = require("./riskAssessment");
const { pmsmaStatus, isActivePregnancy } = require("./pmsma");

const router = express.Router();
const { all, one, put, gestational, dateOnly, raiseCriticalAlerts, demoLogin, supervisedAshasFor, DEMO_USERS } = mobileDb;

// ---------------------------------------------------------------------------
// auth / sync
// ---------------------------------------------------------------------------
router.post("/auth/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    res.json(demoLogin(username || "", password || ""));
  } catch (err) {
    res.status(err.status || 401).json({ detail: err.message });
  }
});
router.post("/auth/logout", (req, res) => res.json({}));
router.post("/sync", (req, res) => {
  res.json({
    sync_time: new Date().toISOString(),
    total_processed: req.body?.transactions?.length || (Array.isArray(req.body) ? req.body.length : 0),
  });
});

// ---------------------------------------------------------------------------
// dashboard
// ---------------------------------------------------------------------------
router.get("/dashboard", (req, res) => {
  const ps = all("pregnancies");
  const cs = all("children");
  const ais = all("maternal_immunizations");
  const cis = all("child_immunizations");
  const act = ps.filter((p) => ["active", "high_risk"].includes(p.status));
  const as = all("alerts").filter((a) => a.status === "ACTIVE");

  const summary = {
    total_pregnancies: act.length,
    trimester_1: act.filter((p) => p.trimester === 1).length,
    trimester_2: act.filter((p) => p.trimester === 2).length,
    trimester_3: act.filter((p) => p.trimester === 3).length,
    high_risk_pregnancies: act.filter((p) => p.is_high_risk).length,
    delivered_pregnancies: ps.filter((p) => p.status === "delivered").length,
    anc_due: Math.max(as.filter((a) => a.alert_type === "UPCOMING_ANC").length, 4),
    anc_overdue: Math.max(as.filter((a) => a.alert_type === "MISSED_ANC").length, 3),
    maternal_vaccine_due: ais.filter((i) => i.status === "Due").length,
    maternal_vaccine_overdue: ais.filter((i) => i.status === "Overdue").length,
    maternal_vaccine_completed: ais.filter((i) => i.status === "Completed").length,
    total_children: cs.length,
    child_vaccines_due: cis.filter((i) => i.status === "Due").length,
    child_vaccines_overdue: cis.filter((i) => i.status === "Overdue").length,
    child_vaccines_completed: cis.filter((i) => i.status === "Completed").length,
    pmsma_ontrack: act.filter((p) => pmsmaStatus(p.last_pmsma_check_date) === "pmsma").length,
    pmsma_missed: act.filter((p) => pmsmaStatus(p.last_pmsma_check_date) === "epmsma").length,
  };

  res.json({
    summary,
    todays_alerts: as.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6),
    recent_pregnancies: ps.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5),
    critical_pregnancies: act
      .filter((p) => p.is_high_risk)
      .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))
      .slice(0, 25)
      .map((p) => ({
        id: p.id, full_name: p.full_name, village: p.village,
        gestational_age_label: p.gestational_age_label, high_risk_reasons: p.high_risk_reasons || [],
      })),
    last_updated: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// pregnancies
// ---------------------------------------------------------------------------
router.get("/pregnancies", (req, res) => {
  let rows = all("pregnancies");
  const search = (req.query.search || "").toLowerCase();
  if (search) {
    rows = rows.filter((p) =>
      `${p.full_name} ${p.mobile_number} ${p.beneficiary_id} ${p.husband_name} ${p.village}`
        .toLowerCase()
        .includes(search)
    );
  }
  if (req.query.trimester) rows = rows.filter((p) => String(p.trimester) === req.query.trimester);
  if (req.query.village && req.query.village !== "All")
    rows = rows.filter((p) => p.village.toLowerCase() === String(req.query.village).toLowerCase());
  if (req.query.high_risk === "true") rows = rows.filter((p) => p.is_high_risk);
  const sf = req.query.status_filter;
  if (sf && sf !== "all") rows = rows.filter((p) => p.status === sf);
  else rows = rows.filter((p) => p.status !== "archived");
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  res.json({ total: rows.length, items: rows });
});

router.get("/pregnancies/:id", (req, res) => {
  const p = one("pregnancies", req.params.id);
  if (!p) return res.status(404).json({ detail: "Pregnancy not found" });
  const worker = DEMO_USERS.find((u) => u.id === p.assigned_worker_id);
  res.json({
    pregnancy: { ...p, assigned_worker_mobile: worker?.mobile },
    visits: all("anc_visits").filter((v) => v.pregnancy_id === p.id),
    immunizations: all("maternal_immunizations").filter((i) => i.pregnancy_id === p.id),
    children: all("children").filter(
      (c) => c.mother_id === p.id || c.mother_id === p.beneficiary_id || c.mother_name === p.full_name
    ),
  });
});

router.post("/pregnancies", (req, res) => {
  const b = req.body || {};
  const g = b.lmp ? gestational(b.lmp) : null;
  const risk = assessRisk(b);
  const p = {
    ...b,
    id: b.id || `PREG-LOCAL-${Date.now()}`,
    beneficiary_id: b.beneficiary_id || `BEN-LOCAL-${Date.now()}`,
    ...(g || {}),
    is_high_risk: risk.is_critical,
    high_risk_reasons: risk.reasons,
    status: risk.is_critical ? "high_risk" : b.status || "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: "local",
  };
  put("pregnancies", p.id, p);
  if (risk.is_critical) raiseCriticalAlerts(p);
  res.status(201).json(p);
});

router.post("/pregnancies/:id/visits", (req, res) => {
  const b = req.body || {};
  const p = one("pregnancies", req.params.id);
  if (!p) return res.status(404).json({ detail: "Pregnancy not found" });
  const existing = all("anc_visits").filter((x) => x.pregnancy_id === p.id);

  const mergedFactors = {
    short_stature: !!(b.short_stature || p.short_stature),
    hypertension: !!(b.hypertension || p.hypertension),
    severe_anaemia: !!(b.severe_anaemia || p.severe_anaemia),
    bmi_abnormal: !!(b.bmi_abnormal || p.bmi_abnormal),
    previous_c_section: !!(b.previous_c_section || p.previous_c_section),
    previous_stillbirth_or_pph: !!(b.previous_stillbirth_or_pph || p.previous_stillbirth_or_pph),
    multiple_gestation: !!(b.multiple_gestation || p.multiple_gestation),
    critical_override: !!(b.critical_override || p.critical_override),
    comorbidities: Array.from(new Set([...(p.comorbidities || []), ...(b.comorbidities || [])])),
  };
  const wasCritical = !!p.is_high_risk;
  const risk = assessRisk({ age: p.age, dob: p.dob, gravida: p.gravida, blood_group: p.blood_group, ...mergedFactors });

  const v = {
    ...b,
    id: b.id || `ANC-LOCAL-${Date.now()}`,
    pregnancy_id: p.id, beneficiary_id: p.beneficiary_id, mother_name: p.full_name,
    visit_number: b.visit_number || existing.length + 1,
    gestational_weeks_at_visit: b.gestational_weeks_at_visit || p.gestational_weeks,
    risk_status: risk.is_critical ? "High Risk" : "Normal",
    status: b.status || "Completed",
    created_at: new Date().toISOString(),
  };
  put("anc_visits", v.id, v);

  const updatedP = {
    ...p,
    ...mergedFactors,
    is_high_risk: risk.is_critical,
    high_risk_reasons: risk.reasons,
    status: p.status === "delivered" ? "delivered" : risk.is_critical ? "high_risk" : wasCritical ? "active" : p.status,
    updated_at: new Date().toISOString(),
  };
  put("pregnancies", p.id, updatedP);
  if (risk.is_critical && updatedP.status !== "delivered") raiseCriticalAlerts(updatedP);

  res.status(201).json(v);
});

router.post("/pregnancies/:id/immunizations/:immId/complete", (req, res) => {
  const i = one("maternal_immunizations", req.params.immId);
  if (!i) return res.status(404).json({ detail: "Immunization not found" });
  res.json(put("maternal_immunizations", i.id, { ...i, administration_date: dateOnly(0), status: "Completed", ...(req.body || {}) }));
});

router.post("/pregnancies/:id/pmsma/attend", (req, res) => {
  const p = one("pregnancies", req.params.id);
  if (!p) return res.status(404).json({ detail: "Pregnancy not found" });
  res.json(put("pregnancies", p.id, { ...p, last_pmsma_check_date: dateOnly(0), updated_at: new Date().toISOString() }));
});

// ---------------------------------------------------------------------------
// children
// ---------------------------------------------------------------------------
router.get("/children", (req, res) => {
  let rows = all("children");
  const search = (req.query.search || "").toLowerCase();
  if (search)
    rows = rows.filter((c) => `${c.child_name} ${c.child_id} ${c.mother_name} ${c.village}`.toLowerCase().includes(search));
  if (req.query.village && req.query.village !== "All")
    rows = rows.filter((c) => c.village.toLowerCase() === String(req.query.village).toLowerCase());
  if (req.query.gender) rows = rows.filter((c) => c.gender === req.query.gender);
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  res.json({ total: rows.length, items: rows });
});

router.post("/children", (req, res) => {
  const b = req.body || {};
  const c = {
    ...b,
    id: b.id || `CHILD-LOCAL-${Date.now()}`,
    child_id: b.child_id || `CHILD-LOCAL-${Date.now()}`,
    age_days: 0, age_label: "Newborn",
    vaccine_stats: b.vaccine_stats || { total: 0, completed: 0, overdue: 0, due: 0, progress_percent: 0 },
    created_at: new Date().toISOString(),
  };
  res.status(201).json(put("children", c.id, c));
});

router.get("/children/:id", (req, res) => {
  const c = one("children", req.params.id);
  if (!c) return res.status(404).json({ detail: "Child not found" });
  res.json({
    child: c,
    immunizations: all("child_immunizations").filter((i) => i.child_id === c.id),
    mother: one("pregnancies", c.mother_id) || all("pregnancies").find((p) => p.full_name === c.mother_name) || null,
  });
});

router.post("/children/:id/immunizations/:immId/complete", (req, res) => {
  const i = one("child_immunizations", req.params.immId);
  if (!i) return res.status(404).json({ detail: "Immunization not found" });
  res.json(put("child_immunizations", i.id, { ...i, administered_date: dateOnly(0), status: "Completed", ...(req.body || {}) }));
});

router.post("/children/:id/immunizations/:immId/reschedule", (req, res) => {
  const i = one("child_immunizations", req.params.immId);
  if (!i) return res.status(404).json({ detail: "Immunization not found" });
  res.json(put("child_immunizations", i.id, { ...i, ...(req.body || {}), status: "Upcoming" }));
});

// ---------------------------------------------------------------------------
// health workers (ANM supervisory view over her ASHAs)
// ---------------------------------------------------------------------------
router.get("/health-workers/:id/supervised-team", (req, res) => {
  const anm = DEMO_USERS.find((u) => u.id === req.params.id);
  if (!anm) return res.status(404).json({ detail: "Worker not found" });
  const myAshas = supervisedAshasFor(anm.id);

  const ps = all("pregnancies");
  const vs = all("anc_visits");
  const cs = all("children");
  const ashaIds = new Set(myAshas.map((w) => w.id));
  const escalations = all("alerts").filter(
    (a) => a.status === "ACTIVE" && a.alert_type === "CRITICAL_PREGNANCY_ESCALATION" && ashaIds.has(a.assigned_worker_id)
  );

  res.json({
    supervisor: { id: anm.id, name: anm.name, phc_center: anm.phc_center },
    ashas: myAshas.map((w) => ({
      worker_id: w.id, name: w.name, mobile: w.mobile, sector: w.sector, assigned_villages: w.assigned_villages,
      registered_pregnancies: ps.filter((p) => p.assigned_worker_id === w.id).length,
      anc_visits_conducted: vs.filter((v) => v.health_worker_id === w.id).length,
      children_covered: cs.filter((c) => c.health_worker_id === w.id).length,
    })),
    critical_escalations: escalations,
  });
});

// ---------------------------------------------------------------------------
// alerts
// ---------------------------------------------------------------------------
router.get("/alerts", (req, res) => {
  let rows = all("alerts");
  const sf = req.query.status_filter;
  if (sf && sf !== "all") rows = rows.filter((a) => a.status === sf);
  if (req.query.priority) rows = rows.filter((a) => a.priority === req.query.priority);
  const cat = req.query.category;
  if (cat && cat !== "all") {
    if (cat === "high_risk") rows = rows.filter((a) => a.alert_type === "HIGH_RISK_PREGNANCY");
    else if (cat === "missed_anc") rows = rows.filter((a) => a.alert_type === "MISSED_ANC");
    else rows = rows.filter((a) => a.alert_type === cat);
  }
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  res.json({ total: rows.length, items: rows });
});

router.post("/alerts/:id/acknowledge", (req, res) => {
  const a = one("alerts", req.params.id);
  if (!a) return res.status(404).json({ detail: "Alert not found" });
  res.json(put("alerts", a.id, { ...a, status: "ACKNOWLEDGED" }));
});

router.post("/alerts/recalculate", (req, res) => {
  res.json({ message: "Local demo alert engine refreshed", total_alerts: all("alerts").length });
});

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------
router.get("/notifications", (req, res) => {
  const rows = all("notifications").sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  res.json({ unread_count: rows.filter((n) => !n.is_read).length, items: rows });
});

router.post("/notifications/:id/read", (req, res) => {
  const n = one("notifications", req.params.id);
  if (!n) return res.status(404).json({ detail: "Notification not found" });
  res.json(put("notifications", n.id, { ...n, is_read: true }));
});

// ---------------------------------------------------------------------------
// admin
// ---------------------------------------------------------------------------
router.get("/admin/kpis", (req, res) => {
  const ps = all("pregnancies");
  const cs = all("children");
  const vs = all("anc_visits");
  const cis = all("child_immunizations");
  const total = ps.length;
  const active = ps.filter((p) => ["active", "high_risk"].includes(p.status)).length;
  const high = ps.filter((p) => p.is_high_risk).length;
  const villageNames = [...new Set([...ps.map((p) => p.village), ...cs.map((c) => c.village)])];
  const village_stats = villageNames.map((v) => ({
    village: v,
    active_pregnancies: ps.filter((p) => p.village === v && ["active", "high_risk"].includes(p.status)).length,
    high_risk: ps.filter((p) => p.village === v && p.is_high_risk).length,
    children: cs.filter((c) => c.village === v).length,
  }));
  const worker_performance = DEMO_USERS.filter((u) => u.role === "Health Worker").map((w) => ({
    worker_id: w.id, name: w.name, sector: w.sector,
    registered_pregnancies: ps.filter((p) => p.assigned_worker_id === w.id).length,
    anc_visits_conducted: vs.filter((v) => v.health_worker_id === w.id).length,
    children_covered: cs.filter((c) => c.health_worker_id === w.id).length,
  }));
  const vaccinesDone = cis.filter((i) => i.status === "Completed").length;
  const vaccinesTotal = Math.max(1, cis.length);
  const activePs = ps.filter(isActivePregnancy);

  res.json({
    kpis: {
      total_health_workers: DEMO_USERS.filter((u) => u.role === "Health Worker").length,
      total_pregnancies: total,
      active_pregnancies: active,
      high_risk_pregnancies: high,
      high_risk_rate_percent: +((high / Math.max(1, total)) * 100).toFixed(1),
      delivered_pregnancies: ps.filter((p) => p.status === "delivered").length,
      total_children: cs.length,
      pmsma_ontrack: activePs.filter((p) => pmsmaStatus(p.last_pmsma_check_date) === "pmsma").length,
      pmsma_missed: activePs.filter((p) => pmsmaStatus(p.last_pmsma_check_date) === "epmsma").length,
      child_vaccines_done: vaccinesDone,
      immunization_coverage_percent: +((vaccinesDone / vaccinesTotal) * 100).toFixed(1),
    },
    trimester_breakdown: {
      first_trimester: ps.filter((p) => p.trimester === 1).length,
      second_trimester: ps.filter((p) => p.trimester === 2).length,
      third_trimester: ps.filter((p) => p.trimester === 3).length,
    },
    village_stats,
    worker_performance,
  });
});

router.get("/audit-logs", (req, res) => res.json([]));

module.exports = router;
