const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(process.env.DB_FILE || path.join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS villages (
    name TEXT PRIMARY KEY,
    block TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS beneficiaries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    husband_name TEXT,
    age INTEGER,
    village TEXT NOT NULL,
    block TEXT,
    contact TEXT,
    anm_id TEXT,
    anm_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS children (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mother_id TEXT NOT NULL REFERENCES beneficiaries(id),
    mother_name TEXT,
    village TEXT,
    block TEXT,
    age_label TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pregnancies (
    id TEXT PRIMARY KEY,
    beneficiary_id TEXT NOT NULL REFERENCES beneficiaries(id),
    trimester INTEGER,
    gestational_age_label TEXT,
    is_high_risk INTEGER NOT NULL DEFAULT 0,
    risk_reasons TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vhsnd_sessions (
    id TEXT PRIMARY KEY,
    village TEXT NOT NULL,
    block TEXT,
    date TEXT NOT NULL,
    anm_id TEXT,
    anm_name TEXT,
    expected_beneficiary_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS anm_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES vhsnd_sessions(id),
    anm_id TEXT,
    anm_name TEXT,
    status TEXT NOT NULL DEFAULT 'Not Recorded',
    check_in_time TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    beneficiary_id TEXT NOT NULL REFERENCES beneficiaries(id),
    beneficiary_name TEXT,
    facility TEXT NOT NULL,
    reason TEXT NOT NULL,
    date TEXT NOT NULL,
    follow_up_status TEXT NOT NULL DEFAULT 'Pending',
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS high_risk_flags (
    beneficiary_id TEXT PRIMARY KEY REFERENCES beneficiaries(id),
    risk_category TEXT,
    reasons TEXT NOT NULL DEFAULT '[]',
    auto_flags TEXT NOT NULL DEFAULT '[]',
    manual_flags TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS beneficiary_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES vhsnd_sessions(id),
    beneficiary_id TEXT NOT NULL REFERENCES beneficiaries(id),
    status TEXT NOT NULL DEFAULT 'Not Recorded',
    reason TEXT,
    follow_up_status TEXT,
    created_at TEXT NOT NULL
  );
`);

// ---------------------------------------------------------------------------
// seed data — copied by value from frontend/src/api/demoDb.ts (villages/
// beneficiaries) and admin-web/src/data/*.ts (the admin-facing subset: 16
// beneficiaries w/ risk, 2 children, 6 VHSND sessions, referrals), same
// isolation pattern admin-web itself uses so local-api doesn't cross-import
// the mobile or dashboard packages.
// ---------------------------------------------------------------------------
const ANM = {
  sectorA: { id: "USR-HW-001", name: "Smruti Malla (ANM)" },
  sectorB: { id: "USR-HW-002", name: "Mamata Barik (ASHA)" },
};
const SECTOR_A_VILLAGES = ["Mangarajpur", "Badatrilochanpur", "Balarampur"];
const anmFor = (village) => (SECTOR_A_VILLAGES.includes(village) ? ANM.sectorA : ANM.sectorB);

const VILLAGES = [
  { name: "Mangarajpur", block: "Jajpur Sadar" },
  { name: "Badatrilochanpur", block: "Jajpur Sadar" },
  { name: "Balarampur", block: "Jajpur Sadar" },
  { name: "Gandhapal", block: "Sukinda" },
  { name: "Baradiha", block: "Sukinda" },
  { name: "Kantira", block: "Sukinda" },
  { name: "Nuadihi", block: "Sukinda" },
  { name: "Singadia", block: "Sukinda" },
];
const blockForVillage = (village) => VILLAGES.find((v) => v.name === village)?.block ?? "Sukinda";

const noRisk = { reasons: [], auto_flags: [], manual_flags: [] };
const BENEFICIARY_SEED = [
  ["Sasmita Jena", "Prakash Jena", 24, "Mangarajpur", 1, "10 Weeks 2 Days", noRisk],
  ["Puspanjali Sahoo", "Bikram Sahoo", 22, "Badatrilochanpur", 2, "18 Weeks 0 Days", noRisk],
  ["Rojalin Behera", "Sanjay Behera", 29, "Gandhapal", 3, "34 Weeks 3 Days", {
    reasons: ["Advanced maternal age (35 years or older, especially first pregnancy)"],
    auto_flags: ["Advanced maternal age (35 years or older, especially first pregnancy)"],
    manual_flags: [],
  }],
  ["Manaswini Nayak", "Deepak Nayak", 36, "Baradiha", 2, "22 Weeks 1 Day", {
    reasons: ["Advanced maternal age (35 years or older, especially first pregnancy)"],
    auto_flags: ["Advanced maternal age (35 years or older, especially first pregnancy)"],
    manual_flags: [],
  }],
  ["Lipsa Mohanty", "Rakesh Mohanty", 17, "Kantira", 1, "8 Weeks 5 Days", {
    reasons: ["Adolescent pregnancy (under 18 years)"],
    auto_flags: ["Adolescent pregnancy (under 18 years)"],
    manual_flags: [],
  }],
  ["Sunita Pradhan", "Gopal Pradhan", 26, "Balarampur", 3, "36 Weeks 0 Days", noRisk],
  ["Ipsita Rout", "Manoj Rout", 28, "Mangarajpur", 2, "24 Weeks 2 Days", {
    reasons: ["Previous caesarean section or uterine surgery"],
    auto_flags: [],
    manual_flags: ["Previous caesarean section or uterine surgery"],
  }],
  ["Sujata Das", "Niranjan Das", 31, "Nuadihi", 3, "30 Weeks 6 Days", {
    reasons: ["Hypertension, pre-eclampsia or eclampsia"],
    auto_flags: [],
    manual_flags: ["Hypertension, pre-eclampsia or eclampsia"],
  }],
  ["Snigdha Parida", "Sushil Parida", 23, "Singadia", 1, "12 Weeks 0 Days", {
    reasons: ["Anaemia, especially severe anaemia"],
    auto_flags: [],
    manual_flags: ["Anaemia, especially severe anaemia"],
  }],
  ["Madhusmita Sahu", "Rabindra Sahu", 27, "Badatrilochanpur", 2, "20 Weeks 3 Days", {
    reasons: ["Severe respiratory disease"],
    auto_flags: [],
    manual_flags: ["Severe respiratory disease"],
  }],
  ["Basanti Swain", "Chittaranjan Swain", 32, "Gandhapal", 3, "33 Weeks 1 Day", {
    reasons: ["Autoimmune disorder"],
    auto_flags: [],
    manual_flags: ["Autoimmune disorder"],
  }],
  ["Sanjukta Barik", "Prasanna Barik", 25, "Mangarajpur", 1, "9 Weeks 4 Days", {
    reasons: ["Very low or high BMI"],
    auto_flags: [],
    manual_flags: ["Very low or high BMI"],
  }],
  ["Sabitri Soren", "Mangal Soren", 21, "Balarampur", 2, "26 Weeks 0 Days", {
    reasons: ["Short stature (height under 145 cm)"],
    auto_flags: [],
    manual_flags: ["Short stature (height under 145 cm)"],
  }],
  ["Nisha Bibi", "Sk. Imran", 28, "Baradiha", 3, "38 Weeks 2 Days", {
    reasons: ["Known comorbidity: diabetes"],
    auto_flags: [],
    manual_flags: ["Known comorbidity: diabetes"],
  }],
  ["Pratima Sethi", "Bijay Sethi", 30, "Kantira", 2, "19 Weeks 5 Days", noRisk],
  ["Nirmala Panda", "Basudev Panda", 41, "Badatrilochanpur", 3, "35 Weeks 0 Days", {
    reasons: [
      "Very advanced maternal age (40 years or older)",
      "Advanced maternal age (35 years or older, especially first pregnancy)",
    ],
    auto_flags: [
      "Very advanced maternal age (40 years or older)",
      "Advanced maternal age (35 years or older, especially first pregnancy)",
    ],
    manual_flags: [],
  }],
];

const CHILDREN_SEED = [
  { id: "CHILD-MCH-7000", name: "Aryan Jena", motherIndex: 0, ageLabel: "45 Days" },
  { id: "CHILD-MCH-7001", name: "Anwesha Sahoo", motherIndex: 1, ageLabel: "3 Months 0 Days" },
];

const VHSND_SESSIONS_SEED = [
  { id: "VHSND-2026-MGRJ-01", village: "Mangarajpur", date: "2026-09-10", expected: [500, 511] },
  { id: "VHSND-2026-BDTP-01", village: "Badatrilochanpur", date: "2026-09-12", expected: [501, 509, 515] },
  { id: "VHSND-2026-GNDP-01", village: "Gandhapal", date: "2026-09-15", expected: [502, 510] },
  { id: "VHSND-2026-MGRJ-02", village: "Mangarajpur", date: "2026-09-24", expected: [500, 506] },
  { id: "VHSND-2026-BLRM-01", village: "Balarampur", date: "2026-09-30", expected: [505, 512] },
  { id: "VHSND-2026-SGDA-01", village: "Singadia", date: "2026-10-03", expected: [508] },
].map((s) => ({ ...s, anm: anmFor(s.village), expected: s.expected.map((n) => `BEN-2026-${n}`) }));

const ANM_ATTENDANCE_SEED = [
  { sessionId: "VHSND-2026-MGRJ-01", status: "Present", checkInTime: "09:15" },
  { sessionId: "VHSND-2026-BDTP-01", status: "Present", checkInTime: "09:40" },
  { sessionId: "VHSND-2026-GNDP-01", status: "Absent", checkInTime: null },
];

// Per-beneficiary VHSND attendance (did she personally show up, as opposed to
// anm_attendance which is whether the ANM showed up to run the session) —
// same 4 records admin-web's src/data/vhsndSessions.ts fixture used to hardcode.
const BENEFICIARY_ATTENDANCE_SEED = [
  { sessionId: "VHSND-2026-MGRJ-01", beneficiaryIndex: 0, status: "Present" },
  {
    sessionId: "VHSND-2026-MGRJ-01",
    beneficiaryIndex: 11,
    status: "Absent",
    reason: "Travelled to relatives",
    followUpStatus: "Contacted",
  },
  { sessionId: "VHSND-2026-BDTP-01", beneficiaryIndex: 1, status: "Present" },
  { sessionId: "VHSND-2026-BDTP-01", beneficiaryIndex: 9, status: "Present" },
  // BEN-2026-515 (index 15) at VHSND-2026-BDTP-01 has no record: an unrecorded past-session miss.
];

const REFERRALS_SEED = [
  {
    id: "REF-2026-001",
    beneficiaryIndex: 2,
    facility: "DHH Jajpur",
    reason: "Advanced maternal age — third trimester, needs specialist monitoring",
    date: "2026-09-14",
    followUpStatus: "Referred",
    notes: "Family informed; transport arranged via ASHA.",
  },
  {
    id: "REF-2026-002",
    beneficiaryIndex: 7,
    facility: "CHC Sukinda",
    reason: "Hypertension, pre-eclampsia or eclampsia — BP monitoring",
    date: "2026-09-16",
    followUpStatus: "Pending",
    notes: null,
  },
];

function seedIfEmpty() {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM beneficiaries").get();
  if (count > 0) return;

  const now = new Date().toISOString();
  const insertVillage = db.prepare("INSERT INTO villages (name, block) VALUES (?, ?)");
  const insertBeneficiary = db.prepare(`
    INSERT INTO beneficiaries (id, name, husband_name, age, village, block, contact, anm_id, anm_name, status, created_at, updated_at)
    VALUES (@id, @name, @husband_name, @age, @village, @block, @contact, @anm_id, @anm_name, @status, @created_at, @updated_at)
  `);
  const insertPregnancy = db.prepare(`
    INSERT INTO pregnancies (id, beneficiary_id, trimester, gestational_age_label, is_high_risk, risk_reasons, status, created_at, updated_at)
    VALUES (@id, @beneficiary_id, @trimester, @gestational_age_label, @is_high_risk, @risk_reasons, @status, @created_at, @updated_at)
  `);
  const insertHighRisk = db.prepare(`
    INSERT INTO high_risk_flags (beneficiary_id, risk_category, reasons, auto_flags, manual_flags, status, updated_at)
    VALUES (@beneficiary_id, @risk_category, @reasons, @auto_flags, @manual_flags, @status, @updated_at)
  `);
  const insertChild = db.prepare(`
    INSERT INTO children (id, name, mother_id, mother_name, village, block, age_label, created_at)
    VALUES (@id, @name, @mother_id, @mother_name, @village, @block, @age_label, @created_at)
  `);
  const insertSession = db.prepare(`
    INSERT INTO vhsnd_sessions (id, village, block, date, anm_id, anm_name, expected_beneficiary_ids, created_at)
    VALUES (@id, @village, @block, @date, @anm_id, @anm_name, @expected_beneficiary_ids, @created_at)
  `);
  const insertAttendance = db.prepare(`
    INSERT INTO anm_attendance (session_id, anm_id, anm_name, status, check_in_time, created_at)
    VALUES (@session_id, @anm_id, @anm_name, @status, @check_in_time, @created_at)
  `);
  const insertReferral = db.prepare(`
    INSERT INTO referrals (id, beneficiary_id, beneficiary_name, facility, reason, date, follow_up_status, notes, created_at)
    VALUES (@id, @beneficiary_id, @beneficiary_name, @facility, @reason, @date, @follow_up_status, @notes, @created_at)
  `);
  const insertBeneficiaryAttendance = db.prepare(`
    INSERT INTO beneficiary_attendance (session_id, beneficiary_id, status, reason, follow_up_status, created_at)
    VALUES (@session_id, @beneficiary_id, @status, @reason, @follow_up_status, @created_at)
  `);

  const seedAll = db.transaction(() => {
    for (const v of VILLAGES) insertVillage.run(v.name, v.block);

    const beneficiaryIds = [];
    BENEFICIARY_SEED.forEach(([name, husbandName, age, village, trimester, gestLabel, risk], i) => {
      const id = `BEN-2026-${500 + i}`;
      beneficiaryIds.push(id);
      const anm = anmFor(village);
      const isCritical = risk.reasons.length > 0;
      insertBeneficiary.run({
        id,
        name,
        husband_name: husbandName,
        age,
        village,
        block: blockForVillage(village),
        contact: `98100${10000 + i}`,
        anm_id: anm.id,
        anm_name: anm.name,
        status: isCritical ? "high_risk" : "active",
        created_at: now,
        updated_at: now,
      });

      const pregnancyId = `PREG-2026-${500 + i}`;
      insertPregnancy.run({
        id: pregnancyId,
        beneficiary_id: id,
        trimester,
        gestational_age_label: gestLabel,
        is_high_risk: isCritical ? 1 : 0,
        risk_reasons: JSON.stringify(risk.reasons),
        status: "active",
        created_at: now,
        updated_at: now,
      });

      if (isCritical) {
        insertHighRisk.run({
          beneficiary_id: id,
          risk_category: risk.auto_flags.length > 0 ? "Auto-flagged" : "Manually flagged",
          reasons: JSON.stringify(risk.reasons),
          auto_flags: JSON.stringify(risk.auto_flags),
          manual_flags: JSON.stringify(risk.manual_flags),
          status: "ACTIVE",
          updated_at: now,
        });
      }
    });

    for (const c of CHILDREN_SEED) {
      const motherId = beneficiaryIds[c.motherIndex];
      const mother = BENEFICIARY_SEED[c.motherIndex];
      insertChild.run({
        id: c.id,
        name: c.name,
        mother_id: motherId,
        mother_name: mother[0],
        village: mother[3],
        block: blockForVillage(mother[3]),
        age_label: c.ageLabel,
        created_at: now,
      });
    }

    for (const s of VHSND_SESSIONS_SEED) {
      insertSession.run({
        id: s.id,
        village: s.village,
        block: blockForVillage(s.village),
        date: s.date,
        anm_id: s.anm.id,
        anm_name: s.anm.name,
        expected_beneficiary_ids: JSON.stringify(s.expected),
        created_at: now,
      });
    }

    for (const a of ANM_ATTENDANCE_SEED) {
      const session = VHSND_SESSIONS_SEED.find((s) => s.id === a.sessionId);
      insertAttendance.run({
        session_id: a.sessionId,
        anm_id: session.anm.id,
        anm_name: session.anm.name,
        status: a.status,
        check_in_time: a.checkInTime,
        created_at: now,
      });
    }

    for (const r of REFERRALS_SEED) {
      const beneficiaryId = beneficiaryIds[r.beneficiaryIndex];
      const beneficiary = BENEFICIARY_SEED[r.beneficiaryIndex];
      insertReferral.run({
        id: r.id,
        beneficiary_id: beneficiaryId,
        beneficiary_name: beneficiary[0],
        facility: r.facility,
        reason: r.reason,
        date: r.date,
        follow_up_status: r.followUpStatus,
        notes: r.notes,
        created_at: now,
      });
    }

    for (const a of BENEFICIARY_ATTENDANCE_SEED) {
      insertBeneficiaryAttendance.run({
        session_id: a.sessionId,
        beneficiary_id: beneficiaryIds[a.beneficiaryIndex],
        status: a.status,
        reason: a.reason || null,
        follow_up_status: a.followUpStatus || null,
        created_at: now,
      });
    }
  });

  seedAll();
}

seedIfEmpty();

module.exports = db;
