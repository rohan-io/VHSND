// Ported from frontend/src/api/demoDb.ts's buildSeed() + storage layer, so the
// mobile app sees byte-for-byte the same seeded dataset whether it's running
// in offline demo mode or talking to this server. Async expo-sqlite calls
// become plain synchronous better-sqlite3 calls; everything else (the seed
// generator, the collection/id/data storage shape) is kept as-is.
const db = require("./db");
const { assessRisk } = require("./riskAssessment");

db.exec(`
  CREATE TABLE IF NOT EXISTS mobile_records (
    collection TEXT NOT NULL,
    id TEXT NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (collection, id)
  );
  CREATE TABLE IF NOT EXISTS mobile_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ---------------------------------------------------------------------------
// date helpers
// ---------------------------------------------------------------------------
const TODAY = new Date();
const iso = (days = 0) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};
const dateOnly = (days = 0) => iso(days).slice(0, 10);
const daysBetween = (a, b) => Math.floor((a.getTime() - b.getTime()) / 86_400_000);

function gestational(lmpStr) {
  const lmp = new Date(lmpStr);
  const totalDays = Math.max(0, daysBetween(TODAY, lmp));
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  const edd = new Date(lmp);
  edd.setDate(edd.getDate() + 280);
  const trimester = weeks <= 12 ? 1 : weeks <= 27 ? 2 : 3;
  return {
    gestational_weeks: weeks,
    gestational_days: days,
    gestational_age_label: `${weeks} Weeks ${days} Days`,
    edd: edd.toISOString().slice(0, 10),
    trimester,
    days_to_edd: daysBetween(edd, TODAY),
  };
}

// ---------------------------------------------------------------------------
// users (6: 1 admin + 5 health workers; only the first 2 workers carry caseload)
// ---------------------------------------------------------------------------
const DEMO_USERS = [
  {
    id: "USR-ADMIN-001", username: "admin", name: "Dilip Acharya (Chief Medical Officer)",
    role: "Administrator", mobile: "9876543210", phc_center: "DHH Jajpur",
    sector: "District HQ", assigned_villages: ["All Villages"],
  },
  {
    id: "USR-HW-001", username: "worker01", name: "Smruti Malla (ANM)", role: "Health Worker",
    worker_type: "ANM",
    mobile: "9812345671", phc_center: "CHC Jajpur Sadar",
    sector: "Sector A - Jajpur Sadar", assigned_villages: ["Mangarajpur", "Badatrilochanpur", "Balarampur"],
  },
  {
    id: "USR-HW-002", username: "worker02", name: "Mamata Barik (ASHA)", role: "Health Worker",
    worker_type: "ASHA",
    mobile: "9812345672", phc_center: "CHC Sukinda",
    sector: "Sector B - Sukinda", assigned_villages: ["Gandhapal", "Baradiha", "Kantira", "Nuadihi", "Singadia"],
  },
  {
    id: "USR-HW-003", username: "worker03", name: "Sujata Parida (ANM)", role: "Health Worker",
    worker_type: "ANM",
    mobile: "9812345673", phc_center: "CHC Sukinda",
    sector: "Sector C - Sukinda East", assigned_villages: [],
  },
  {
    id: "USR-HW-004", username: "worker04", name: "Kabita Sahoo (ASHA)", role: "Health Worker",
    worker_type: "ASHA",
    mobile: "9812345674", phc_center: "CHC Jajpur Sadar",
    sector: "Sector D - Jajpur Sadar West", assigned_villages: [],
  },
  {
    id: "USR-HW-005", username: "worker05", name: "Namita Sethi (ANM)", role: "Health Worker",
    worker_type: "ANM",
    mobile: "9812345675", phc_center: "CHC Sukinda",
    sector: "Sector E - Sukinda North", assigned_villages: [],
  },
];

function supervisedAshasFor(anmId) {
  const anm = DEMO_USERS.find((u) => u.id === anmId && u.worker_type === "ANM");
  if (!anm) return [];
  const firstAnmAtPhc = DEMO_USERS.find((u) => u.worker_type === "ANM" && u.phc_center === anm.phc_center);
  if (firstAnmAtPhc?.id !== anm.id) return [];
  return DEMO_USERS.filter((u) => u.worker_type === "ASHA" && u.phc_center === anm.phc_center);
}

// ---------------------------------------------------------------------------
// seed name tables (lifted verbatim from frontend/src/api/demoDb.ts)
// ---------------------------------------------------------------------------
const PREG_NAMES = [
  ["Sasmita Jena", "Prakash Jena", 24, "Mangarajpur", "O+"],
  ["Puspanjali Sahoo", "Bikram Sahoo", 22, "Badatrilochanpur", "B+"],
  ["Rojalin Behera", "Sanjay Behera", 29, "Gandhapal", "A+"],
  ["Manaswini Nayak", "Deepak Nayak", 36, "Baradiha", "AB+"],
  ["Lipsa Mohanty", "Rakesh Mohanty", 17, "Kantira", "O-"],
  ["Sunita Pradhan", "Gopal Pradhan", 26, "Balarampur", "B+"],
  ["Ipsita Rout", "Manoj Rout", 28, "Mangarajpur", "A+"],
  ["Sujata Das", "Niranjan Das", 31, "Nuadihi", "O+"],
  ["Snigdha Parida", "Sushil Parida", 23, "Singadia", "B-"],
  ["Madhusmita Sahu", "Rabindra Sahu", 27, "Badatrilochanpur", "A+"],
  ["Basanti Swain", "Chittaranjan Swain", 32, "Gandhapal", "O+"],
  ["Sanjukta Barik", "Prasanna Barik", 25, "Mangarajpur", "AB+"],
  ["Sabitri Soren", "Mangal Soren", 21, "Balarampur", "B+"],
  ["Nisha Bibi", "Sk. Imran", 28, "Baradiha", "O+"],
  ["Pratima Sethi", "Bijay Sethi", 30, "Kantira", "A+"],
  ["Nirmala Panda", "Basudev Panda", 34, "Badatrilochanpur", "B+"],
  ["Gitanjali Samal", "Sarat Samal", 26, "Mangarajpur", "O+"],
  ["Manjulata Sahu", "Ajay Sahu", 29, "Gandhapal", "A-"],
  ["Sradhanjali Biswal", "Debendra Biswal", 22, "Nuadihi", "O+"],
  ["Rashmita Muduli", "Suryakanta Muduli", 27, "Singadia", "B+"],
  ["Sanghamitra Mishra", "Bhagaban Mishra", 35, "Balarampur", "AB+"],
  ["Bandana Palei", "Rohit Palei", 24, "Mangarajpur", "O+"],
  ["Kalpana Lenka", "Kishore Lenka", 28, "Baradiha", "A+"],
  ["Minati Dalei", "Shyamsundar Dalei", 20, "Kantira", "B+"],
  ["Rukmini Tarai", "Pankaj Tarai", 25, "Badatrilochanpur", "O+"],
  ["Pravati Khatua", "Hemanta Khatua", 33, "Gandhapal", "A+"],
  ["Priyanka Kar", "Bikram Kar", 23, "Mangarajpur", "B+"],
  ["Urmila Senapati", "Mahesh Senapati", 30, "Nuadihi", "O+"],
  ["Tapaswini Champati", "Gobinda Champati", 26, "Balarampur", "A+"],
  ["Reeta Mahanta", "Alok Mahanta", 27, "Singadia", "AB-"],
  ["Sarojini Marandi", "Babula Marandi", 19, "Kantira", "O+"],
  ["Durga Hembram", "Suresh Hembram", 32, "Gandhapal", "B+"],
  ["Swagatika Rout", "Swapneswar Rout", 29, "Badatrilochanpur", "A+"],
  ["Subhashree Das", "Ratan Das", 24, "Mangarajpur", "O+"],
  ["Kuni Sahani", "Mukesh Sahani", 22, "Baradiha", "B+"],
  ["Bidyabati Nayak", "Dharmananda Nayak", 31, "Nuadihi", "A+"],
  ["Jyotsna Behera", "Binod Behera", 25, "Balarampur", "O+"],
  ["Arundhati Jena", "Prabhat Jena", 28, "Singadia", "B+"],
  ["Namrata Bhoi", "Chhabi Bhoi", 21, "Kantira", "A+"],
  ["Sabita Murmu", "Sukhram Murmu", 37, "Gandhapal", "O-"],
  ["Madhuri Pradhan", "Kamalakanta Pradhan", 26, "Mangarajpur", "AB+"],
  ["Itishree Sahoo", "Subhash Sahoo", 30, "Badatrilochanpur", "B+"],
  ["Suprava Mohanty", "Dhananjaya Mohanty", 27, "Baradiha", "A+"],
  ["Phula Oram", "Jitu Oram", 23, "Nuadihi", "O+"],
  ["Sradha Biswal", "Mohan Biswal", 34, "Balarampur", "B+"],
  ["Kamala Bibi", "Nasir Khan", 28, "Singadia", "A+"],
  ["Parbati Munda", "Birsa Munda", 25, "Kantira", "O+"],
  ["Manini Sahoo", "Kalucharan Sahoo", 32, "Gandhapal", "B+"],
  ["Truptimayee Sethi", "Satish Sethi", 24, "Mangarajpur", "A+"],
  ["Hemalata Parida", "Rakesh Parida", 29, "Badatrilochanpur", "O+"],
];

const BENEFICIARY_SEED_INDEX = 31;
const DEMO_BENEFICIARY_USER = {
  id: "USR-BEN-001",
  username: "9810010031",
  name: PREG_NAMES[BENEFICIARY_SEED_INDEX][0],
  role: "Beneficiary",
  mobile: `98100${10000 + BENEFICIARY_SEED_INDEX}`,
  beneficiary_pregnancy_id: `PREG-2026-${1000 + BENEFICIARY_SEED_INDEX}`,
};
DEMO_USERS.push(DEMO_BENEFICIARY_USER);

const CHILD_NAMES = [
  ["Aryan Jena", "Male", "Sasmita Jena", 45, 3.1],
  ["Anwesha Sahoo", "Female", "Puspanjali Sahoo", 90, 2.9],
  ["Debasish Behera", "Male", "Rojalin Behera", 180, 3.4],
  ["Priyanka Nayak", "Female", "Manaswini Nayak", 15, 2.8],
  ["Soumya Pradhan", "Male", "Sunita Pradhan", 300, 3.2],
  ["Aradhya Rout", "Female", "Ipsita Rout", 60, 3.0],
  ["Biswajit Das", "Male", "Sujata Das", 450, 3.5],
  ["Adyasha Parida", "Female", "Snigdha Parida", 120, 2.9],
  ["Omm Sahu", "Male", "Madhusmita Sahu", 30, 3.3],
  ["Diptimayee Barik", "Female", "Sanjukta Barik", 210, 3.1],
  ["Ankit Soren", "Male", "Sabitri Soren", 80, 2.7],
  ["Ayaana Sheikh", "Female", "Nisha Bibi", 360, 3.0],
  ["Chinmaya Sethi", "Male", "Pratima Sethi", 150, 3.2],
  ["Prangya Panda", "Female", "Nirmala Panda", 20, 2.9],
  ["Subham Samal", "Male", "Gitanjali Samal", 270, 3.4],
  ["Sneha Sahu", "Female", "Manjulata Sahu", 500, 3.1],
  ["Sourav Biswal", "Male", "Sradhanjali Biswal", 100, 3.0],
  ["Lisa Muduli", "Female", "Rashmita Muduli", 70, 2.8],
  ["Abhinav Mishra", "Male", "Sanghamitra Mishra", 400, 3.3],
  ["Khushi Palei", "Female", "Bandana Palei", 14, 3.0],
  ["Gyanaranjan Lenka", "Male", "Kalpana Lenka", 230, 3.2],
  ["Tanvi Dalei", "Female", "Minati Dalei", 55, 2.7],
  ["Shreyansh Tarai", "Male", "Rukmini Tarai", 320, 3.5],
  ["Ipsa Khatua", "Female", "Pravati Khatua", 110, 3.0],
  ["Pratyush Kar", "Male", "Priyanka Kar", 40, 3.1],
  ["Sradha Senapati", "Female", "Urmila Senapati", 260, 2.9],
  ["Rudra Champati", "Male", "Tapaswini Champati", 85, 3.3],
  ["Bhabani Mahanta", "Female", "Reeta Mahanta", 600, 3.2],
  ["Sibun Marandi", "Male", "Sarojini Marandi", 190, 2.8],
  ["Kuni Hembram", "Female", "Durga Hembram", 130, 3.0],
];

const SECTOR_A = ["Mangarajpur", "Badatrilochanpur", "Balarampur"];
const workerForVillage = (village) => (SECTOR_A.includes(village) ? DEMO_USERS[1] : DEMO_USERS[2]);
const blockForVillage = (village) => (SECTOR_A.includes(village) ? "Jajpur Sadar Block" : "Sukinda Block");

const MAT_VACCINES = [
  { name: "TT-1 (Tetanus Toxoid 1)", dose: "0.5 ml IM", desc: "Early in pregnancy", week: 12 },
  { name: "TT-2 (Tetanus Toxoid 2)", dose: "0.5 ml IM", desc: "4 weeks after TT-1", week: 16 },
  { name: "TD Booster", dose: "0.5 ml IM", desc: "If pregnancy within 3 yrs of last TT", week: 20 },
];

const CHILD_VACCINES = [
  { code: "BCG", name: "BCG", label: "At Birth", dayOffset: 0, route: "Intradermal" },
  { code: "OPV-0", name: "Oral Polio Vaccine 0", label: "At Birth", dayOffset: 0, route: "Oral" },
  { code: "HEPB-B", name: "Hepatitis B (Birth Dose)", label: "At Birth", dayOffset: 0, route: "Intramuscular" },
  { code: "OPV-1", name: "Oral Polio Vaccine 1", label: "6 Weeks", dayOffset: 42, route: "Oral" },
  { code: "PENTA-1", name: "Pentavalent 1 (DPT+HepB+Hib)", label: "6 Weeks", dayOffset: 42, route: "Intramuscular" },
  { code: "OPV-2", name: "Oral Polio Vaccine 2", label: "10 Weeks", dayOffset: 70, route: "Oral" },
  { code: "PENTA-2", name: "Pentavalent 2", label: "10 Weeks", dayOffset: 70, route: "Intramuscular" },
  { code: "OPV-3", name: "Oral Polio Vaccine 3", label: "14 Weeks", dayOffset: 98, route: "Oral" },
  { code: "PENTA-3", name: "Pentavalent 3", label: "14 Weeks", dayOffset: 98, route: "Intramuscular" },
  { code: "MR-1", name: "Measles & Rubella 1", label: "9-12 Months", dayOffset: 270, route: "Subcutaneous" },
  { code: "MR-2", name: "Measles & Rubella 2", label: "16-24 Months", dayOffset: 480, route: "Subcutaneous" },
  { code: "DPT-B1", name: "DPT Booster 1", label: "16-24 Months", dayOffset: 480, route: "Intramuscular" },
];

// ---------------------------------------------------------------------------
// seed generator (byte-for-byte port of demoDb.ts's buildSeed())
// ---------------------------------------------------------------------------
function buildSeed() {
  const pregnancies = [];
  const anc_visits = [];
  const maternal_immunizations = [];
  const children = [];
  const child_immunizations = [];
  const alerts = [];
  const notifications = [];

  PREG_NAMES.forEach(([name, husband, age, village, bg], i) => {
    const pId = `PREG-2026-${1000 + i}`;
    const bId = `BEN-2026-${500 + i}`;
    const isDelivered = i >= 45;
    const weeksPregnant = isDelivered ? 41 : (i % 36) + 4;
    const lmpDays = isDelivered ? -(288 + (i % 5)) : -(weeksPregnant * 7 + (i % 5));
    const lmpStr = dateOnly(lmpDays);
    const g = gestational(lmpStr);

    const highRisk = i % 7 === 0 || age >= 35 || age < 18;
    const sys = highRisk ? 145 : 118 + (i % 12);
    const dia = highRisk ? 95 : 76 + (i % 8);
    const hb = highRisk ? 6.5 : 11.2 + (i % 4) * 0.4;
    const height_cm = i % 11 === 0 ? 143 : 150 + (i % 6);
    const weight = +(48 + (i % 15) * 1.2).toFixed(1);

    const short_stature = height_cm < 145;
    const hypertension = sys >= 140 || dia >= 90;
    const severe_anaemia = hb < 7;
    const bmi_abnormal = i % 8 === 0;
    const prevCSection = highRisk && i % 2 === 0;
    const multipleGestation = i % 13 === 0;
    const comorbidities = i % 9 === 0 ? ["thyroid"] : [];

    const risk = assessRisk({
      age,
      gravida: (i % 4) + 1, blood_group: bg,
      short_stature, hypertension, severe_anaemia, bmi_abnormal,
      previous_c_section: prevCSection,
      multiple_gestation: multipleGestation,
      comorbidities,
    });
    const reasons = risk.reasons;
    const isHR = risk.is_critical;

    const worker = workerForVillage(village);
    const status = isDelivered ? "delivered" : isHR ? "high_risk" : "active";
    const delivery_details = isDelivered
      ? {
          date: dateOnly(-(i % 15) - 3),
          outcome: "Live birth",
          birth_weight: +(2.6 + (i % 8) * 0.12).toFixed(1),
          place: worker.phc_center,
        }
      : undefined;

    pregnancies.push({
      id: pId, beneficiary_id: bId, full_name: name, husband_name: husband, age,
      dob: dateOnly(-age * 365),
      mobile_number: `98100${10000 + i}`,
      address: `House No. ${12 + i}, ${village}`,
      village, block: blockForVillage(village), district: "Jajpur",
      registration_date: dateOnly(lmpDays + 45),
      lmp: lmpStr, edd: g.edd,
      gestational_weeks: g.gestational_weeks, gestational_days: g.gestational_days,
      gestational_age_label: g.gestational_age_label, trimester: g.trimester,
      days_to_edd: g.days_to_edd,
      gravida: (i % 4) + 1, para: i % 3, blood_group: bg,
      height_cm, weight,
      bp_systolic: sys, bp_diastolic: dia, hemoglobin: +hb.toFixed(1),
      fundal_height: `${weeksPregnant} cm`, fetal_heart_rate: 140 + (i % 18),
      is_high_risk: isHR, high_risk_reasons: reasons,
      short_stature, hypertension, severe_anaemia, bmi_abnormal,
      previous_c_section: prevCSection,
      previous_stillbirth_or_pph: false,
      multiple_gestation: multipleGestation,
      comorbidities,
      previous_pregnancy_history: prevCSection ? "Previous C-Section in 2023" : age > 25 ? "Normal previous delivery" : "Primigravida",
      existing_conditions: isHR ? "Mild Gestational Hypertension" : "None",
      allergies: "No known drug allergies",
      risk_factors: isHR ? "High Risk Monitored" : "Standard Care",
      assigned_worker_id: worker.id, assigned_worker_name: worker.name,
      health_centre: worker.phc_center,
      status,
      ...(delivery_details ? { delivery_details } : {}),
      created_at: iso(-(i + 1)), updated_at: iso(0), sync_status: "synced",
    });

    const nVisits = Math.min(4, Math.max(1, Math.floor(g.gestational_weeks / 8)));
    for (let v = 1; v <= nVisits; v++) {
      const vId = `ANC-VISIT-${pId}-${v}`;
      anc_visits.push({
        id: vId, pregnancy_id: pId, beneficiary_id: bId, mother_name: name,
        visit_number: v, visit_date: dateOnly(lmpDays + v * 60),
        gestational_weeks_at_visit: v * 8,
        weight: +(48 + v * 2.1).toFixed(1),
        bp_systolic: sys, bp_diastolic: dia, hemoglobin: +hb.toFixed(1),
        fundal_height: `${v * 8} cm`, fetal_heart_rate: 142 + v * 2,
        symptoms: v > 1 ? "Normal fetal movements reported" : "Morning sickness managed",
        examination_notes: "Uterus relaxed, fetal heart sounds audible and regular.",
        investigation_details: "Urine Albumin/Sugar: Nil. Rapid Malaria/Syphilis: Negative.",
        risk_status: isHR ? "High Risk" : "Normal",
        advice: "Nutritious diet with greens, IFA tablets daily at bedtime, institutional delivery.",
        next_visit_date: dateOnly(21),
        health_worker_id: worker.id, health_worker_name: worker.name,
        status: "Completed", created_at: iso(-(i + 1)),
      });
    }

    MAT_VACCINES.forEach((mv) => {
      const immId = `MAT-IMM-${pId}-${mv.name.slice(0, 4).trim()}`;
      const dueStr = dateOnly(lmpDays + mv.week * 7);
      let st;
      if (g.gestational_weeks > mv.week + 2) st = (i + mv.week) % 3 === 0 ? "Overdue" : "Completed";
      else if (g.gestational_weeks >= mv.week - 1) st = "Due";
      else st = "Upcoming";
      maternal_immunizations.push({
        id: immId, pregnancy_id: pId, beneficiary_id: bId, mother_name: name,
        vaccine_name: mv.name, dose: mv.dose, description: mv.desc,
        recommended_date: dueStr, due_date: dueStr,
        administration_date: st === "Completed" ? dueStr : null,
        batch_number: st === "Completed" ? `BATCH-MCH-${202600 + i}` : "",
        status: st,
        remarks: st === "Completed" ? "Administered at PHC clinic" : "Scheduled on Village Health & Nutrition Day (VHND)",
        health_worker_name: worker.name, created_at: iso(-(i + 1)),
      });
      if (st === "Overdue" || st === "Due") {
        alerts.push({
          id: `ALERT-MAT-IMM-${immId}`,
          alert_type: st === "Overdue" ? "MATERNAL_VACCINE_OVERDUE" : "MATERNAL_VACCINE_DUE",
          priority: st === "Overdue" ? "HIGH" : "MEDIUM",
          title: `Maternal Vaccine ${st}: ${mv.name}`,
          message: `${mv.name} scheduled for ${name}. Due date: ${dueStr}`,
          beneficiary_name: name, beneficiary_id: bId,
          related_entity_type: "pregnancy", related_entity_id: pId,
          due_date: dueStr, assigned_worker_id: worker.id, assigned_worker_name: worker.name,
          status: "ACTIVE", created_at: iso(-1),
        });
      }
    });

    if (isHR && status !== "delivered") {
      alerts.push({
        id: `ALERT-HR-${pId}`, alert_type: "HIGH_RISK_PREGNANCY", priority: "CRITICAL",
        title: `High Risk Pregnancy: ${name}`,
        message: `Requires intensive monitoring: ${reasons.join(", ")}. Trimester ${g.trimester} (${g.gestational_age_label}).`,
        beneficiary_name: name, beneficiary_id: bId,
        related_entity_type: "pregnancy", related_entity_id: pId,
        due_date: dateOnly(0), assigned_worker_id: worker.id, assigned_worker_name: worker.name,
        status: "ACTIVE", created_at: iso(-1),
      });
      alerts.push({
        id: `ALERT-CRIT-ESC-${pId}`, alert_type: "CRITICAL_PREGNANCY_ESCALATION", priority: "CRITICAL",
        title: `Critical Pregnancy Escalation: ${name}`,
        message: `${name}, ${village} — ${g.gestational_age_label}. Triggers: ${reasons.join("; ")}. Review and arrange follow-up.`,
        beneficiary_name: name, beneficiary_id: bId,
        related_entity_type: "pregnancy", related_entity_id: pId,
        due_date: dateOnly(0), assigned_worker_id: worker.id, assigned_worker_name: worker.name,
        status: "ACTIVE", created_at: iso(-1),
      });
    }

    if (g.gestational_weeks >= 32 && nVisits < 4 && status !== "delivered") {
      alerts.push({
        id: `ALERT-ANC-MISSED-${pId}`, alert_type: "MISSED_ANC", priority: "HIGH",
        title: `ANC 4 Overdue for ${name}`,
        message: `Check-up missing for ${name} (currently ${g.gestational_age_label}). Record ANC visit.`,
        beneficiary_name: name, beneficiary_id: bId,
        related_entity_type: "pregnancy", related_entity_id: pId,
        due_date: dateOnly(0), assigned_worker_id: worker.id, assigned_worker_name: worker.name,
        status: "ACTIVE", created_at: iso(-2),
      });
    }
    if (g.gestational_weeks >= 20 && g.gestational_weeks < 32 && i % 3 === 0 && status !== "delivered") {
      alerts.push({
        id: `ALERT-ANC-UP-${pId}`, alert_type: "UPCOMING_ANC", priority: "MEDIUM",
        title: `ANC visit due soon for ${name}`,
        message: `Next scheduled ANC check-up for ${name} is coming up.`,
        beneficiary_name: name, beneficiary_id: bId,
        related_entity_type: "pregnancy", related_entity_id: pId,
        due_date: dateOnly(7), assigned_worker_id: worker.id, assigned_worker_name: worker.name,
        status: "ACTIVE", created_at: iso(-1),
      });
    }
  });

  CHILD_NAMES.forEach(([cName, gender, motherName, daysOld, birthWt], j) => {
    const cId = `CHD-2026-${2000 + j}`;
    const village = PREG_NAMES[j % PREG_NAMES.length][3];
    const worker = workerForVillage(village);
    const months = Math.floor(daysOld / 30);
    const ageLabel = daysOld < 30 ? `${daysOld} Days` : `${months} Months ${daysOld % 30} Days`;

    let done = 0, overdue = 0, due = 0;
    CHILD_VACCINES.forEach((cv, k) => {
      const dueStr = dateOnly(-(daysOld - cv.dayOffset));
      let st;
      if (daysOld >= cv.dayOffset + 14) st = (j + k) % 5 === 0 ? "Overdue" : "Completed";
      else if (daysOld >= cv.dayOffset - 7) st = "Due";
      else st = "Upcoming";
      if (st === "Completed") done++;
      else if (st === "Overdue") overdue++;
      else if (st === "Due") due++;

      const cimmId = `CHIMM-${cId}-${cv.code}`;
      child_immunizations.push({
        id: cimmId, child_id: cId, child_name: cName,
        vaccine_code: cv.code, vaccine_name: cv.name, target_age_label: cv.label,
        recommended_due_date: dueStr,
        administered_date: st === "Completed" ? dueStr : null,
        route: cv.route, status: st,
        batch_number: st === "Completed" ? `CHD-VAC-${26000 + j * 20 + k}` : "",
        administered_by: st === "Completed" ? worker.name : undefined,
      });

      if (st === "Overdue" || st === "Due") {
        alerts.push({
          id: `ALERT-CHD-IMM-${cimmId}`,
          alert_type: st === "Overdue" ? "CHILD_VACCINE_OVERDUE" : "CHILD_VACCINE_DUE",
          priority: st === "Overdue" ? "HIGH" : "MEDIUM",
          title: `Child Vaccine ${st}: ${cv.code}`,
          message: `${cv.name} (${cv.label}) for ${cName} (Mother: ${motherName}).`,
          beneficiary_name: `${cName} (${motherName})`, beneficiary_id: `CHILD-MCH-${7000 + j}`,
          related_entity_type: "child", related_entity_id: cId,
          due_date: dueStr, assigned_worker_id: worker.id, assigned_worker_name: worker.name,
          status: "ACTIVE", created_at: iso(-1),
        });
      }
    });

    const total = CHILD_VACCINES.length;
    children.push({
      id: cId, child_id: `CHILD-MCH-${7000 + j}`,
      mother_id: `BEN-2026-${500 + j}`, mother_name: motherName,
      mother_mobile: `98100${10000 + j}`,
      child_name: cName, gender, dob: dateOnly(-daysOld), age_days: daysOld, age_label: ageLabel,
      birth_weight: birthWt, place_of_birth: worker.phc_center,
      address: `Ward ${(j % 9) + 1}, ${village}`, village, block: blockForVillage(village), district: "Jajpur",
      health_worker_id: worker.id, health_worker_name: worker.name,
      vaccine_stats: {
        total, completed: done, overdue, due,
        progress_percent: Math.round((done / total) * 100),
      },
      created_at: iso(-(j + 1)),
    });
  });

  notifications.push(
    {
      id: "NOTIF-DEMO-001", title: "Monthly Routine Immunization Day (RI Day)",
      message: "Scheduled for tomorrow at Sub-Centre Mangarajpur. Ensure all cold chain carrier boxes and vaccine stocks are verified.",
      priority: "HIGH", category: "Immunisation", beneficiary_name: "All Sector A Beneficiaries",
      created_at: iso(-0), is_read: false, target_user_id: "USR-HW-001",
    },
    {
      id: "NOTIF-DEMO-002", title: "High Risk Follow-up: Sasmita Jena & Lipsa Mohanty",
      message: "Immediate blood pressure check and hemoglobin repeat advised by Medical Officer.",
      priority: "CRITICAL", category: "High Risk", beneficiary_name: "Sasmita Jena, Lipsa Mohanty",
      created_at: iso(-0), is_read: false, target_user_id: "USR-HW-001",
    },
    {
      id: "NOTIF-DEMO-003", title: "Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)",
      message: "Special ANC clinic on the 9th of every month. Organize transport for 2nd and 3rd trimester mothers.",
      priority: "MEDIUM", category: "Reminder", beneficiary_name: "All Pregnant Women",
      created_at: iso(-2), is_read: true, target_user_id: "USR-HW-001",
    },
  );

  return { pregnancies, children, anc_visits, maternal_immunizations, child_immunizations, alerts, notifications };
}

// ---------------------------------------------------------------------------
// storage — same shape as demoDb.ts's demo_records table, backed by the
// shared better-sqlite3 connection instead of expo-sqlite.
// ---------------------------------------------------------------------------
const SEED_VERSION = "6";

const stmtAll = db.prepare("SELECT data FROM mobile_records WHERE collection = ?");
const stmtOne = db.prepare("SELECT data FROM mobile_records WHERE collection = ? AND id = ?");
const stmtPut = db.prepare("INSERT OR REPLACE INTO mobile_records (collection, id, data) VALUES (?, ?, ?)");

function all(collection) {
  return stmtAll.all(collection).map((r) => JSON.parse(r.data));
}
function one(collection, id) {
  const row = stmtOne.get(collection, id);
  return row ? JSON.parse(row.data) : null;
}
function put(collection, id, value) {
  stmtPut.run(collection, id, JSON.stringify(value));
  return value;
}

function seedIfEmpty() {
  const seeded = db.prepare("SELECT value FROM mobile_meta WHERE key='seed_version'").get();
  if (seeded && seeded.value === SEED_VERSION) return;

  const seedAll = db.transaction(() => {
    db.exec("DELETE FROM mobile_records; DELETE FROM mobile_meta;");
    for (const [collection, rows] of Object.entries(buildSeed())) {
      for (const row of rows) put(collection, row.id, row);
    }
    db.prepare("INSERT OR REPLACE INTO mobile_meta (key, value) VALUES ('seed_version', ?)").run(SEED_VERSION);
  });
  seedAll();
}

seedIfEmpty();

// alert helpers — mirrors demoDb.ts's raiseCriticalAlerts()
function raiseCriticalAlerts(p) {
  const base = {
    beneficiary_name: p.full_name,
    beneficiary_id: p.beneficiary_id,
    related_entity_type: "pregnancy",
    related_entity_id: p.id,
    due_date: dateOnly(0),
    assigned_worker_id: p.assigned_worker_id || "",
    assigned_worker_name: p.assigned_worker_name || "",
    status: "ACTIVE",
    created_at: new Date().toISOString(),
  };
  const reasons = p.high_risk_reasons || [];
  put("alerts", `ALERT-CRIT-ESC-${p.id}`, {
    ...base,
    id: `ALERT-CRIT-ESC-${p.id}`,
    alert_type: "CRITICAL_PREGNANCY_ESCALATION",
    priority: "CRITICAL",
    title: `Critical Pregnancy Escalation: ${p.full_name}`,
    message: `${p.full_name}, ${p.village} — ${p.gestational_age_label || "gestation n/a"}. Triggers: ${reasons.join("; ")}. Review and arrange follow-up.`,
  });
  put("alerts", `ALERT-HR-${p.id}`, {
    ...base,
    id: `ALERT-HR-${p.id}`,
    alert_type: "HIGH_RISK_PREGNANCY",
    priority: "CRITICAL",
    title: `High Risk Pregnancy: ${p.full_name}`,
    message: `Requires intensive monitoring: ${reasons.join(", ")}.`,
  });
}

function demoLogin(username, password) {
  const u = (username || "").toLowerCase().trim();
  if (u === "beneficiary-demo") {
    return { access_token: "demo-beneficiary-token", user: DEMO_BENEFICIARY_USER };
  }
  const valid =
    (u === "admin" && password === "Admin@123") ||
    (/^worker0[1-5]$/.test(u) && password === "Worker@123");
  if (!valid) {
    const err = new Error("Invalid demo credentials. Use worker01 / Worker@123 or admin / Admin@123.");
    err.status = 401;
    throw err;
  }
  const user = DEMO_USERS.find((x) => x.username === u) ?? DEMO_USERS[1];
  return { access_token: "demo-local-sqlite-token", user };
}

module.exports = {
  DEMO_USERS,
  gestational,
  dateOnly,
  all,
  one,
  put,
  raiseCriticalAlerts,
  demoLogin,
  supervisedAshasFor,
  workerForVillage,
  blockForVillage,
};
