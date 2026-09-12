/**
 * Standalone local data layer for the offline demo APK.
 *
 * When EXPO_PUBLIC_DEMO_MODE=true, src/api/client.ts routes every apiRequest()
 * here instead of hitting a backend. Storage is expo-sqlite on device; on web
 * (or if SQLite fails to open) it falls back to an in-memory store with the same
 * interface so the demo still works with zero network calls.
 *
 * The route table below mirrors the FastAPI backend 1:1 (see backend/server.py).
 * Seed data is ported from that backend's seed_database_if_empty(): 6 users,
 * 50 pregnancies, 30 children, plus ANC visits, immunisations, alerts.
 *
 * ponytail: single generic (collection,id,data-json) table, no migrations, no
 * indexes. Fine for a bundled read-mostly demo dataset; revisit if this ever
 * needs to hold real field data.
 */
import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import { assessRisk } from "@/src/utils/riskAssessment";
import { pmsmaStatus, isActivePregnancy } from "@/src/utils/pmsma";

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
const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / 86_400_000);

function gestational(lmpStr: string) {
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
export const DEMO_USERS: any[] = [
  {
    id: "USR-ADMIN-001", username: "admin", name: "Dilip Acharya (Chief Medical Officer)",
    role: "Administrator", mobile: "9876543210", phc_center: "DHH Jajpur",
    sector: "District HQ", assigned_villages: ["All Villages"],
  },
  {
    id: "USR-HW-001", username: "worker01", name: "Smruti Malla (ANM)", role: "Health Worker",
    mobile: "9812345671", phc_center: "CHC Jajpur Sadar",
    sector: "Sector A - Jajpur Sadar", assigned_villages: ["Mangarajpur", "Badatrilochanpur", "Balarampur"],
  },
  {
    id: "USR-HW-002", username: "worker02", name: "Mamata Barik (ASHA)", role: "Health Worker",
    mobile: "9812345672", phc_center: "CHC Sukinda",
    sector: "Sector B - Sukinda", assigned_villages: ["Gandhapal", "Baradiha", "Kantira", "Nuadihi", "Singadia"],
  },
  {
    id: "USR-HW-003", username: "worker03", name: "Sujata Parida (ANM)", role: "Health Worker",
    mobile: "9812345673", phc_center: "CHC Sukinda",
    sector: "Sector C - Sukinda East", assigned_villages: [],
  },
  {
    id: "USR-HW-004", username: "worker04", name: "Kabita Sahoo (ASHA)", role: "Health Worker",
    mobile: "9812345674", phc_center: "CHC Jajpur Sadar",
    sector: "Sector D - Jajpur Sadar West", assigned_villages: [],
  },
  {
    id: "USR-HW-005", username: "worker05", name: "Namita Sethi (ANM)", role: "Health Worker",
    mobile: "9812345675", phc_center: "CHC Sukinda",
    sector: "Sector E - Sukinda North", assigned_villages: [],
  },
];

// ---------------------------------------------------------------------------
// seed name tables (lifted verbatim from backend/server.py)
// ---------------------------------------------------------------------------
type PregName = [string, string, number, string, string]; // name, husband, age, village, blood group
const PREG_NAMES: PregName[] = [
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

type ChildName = [string, string, string, number, number]; // name, gender, mother name, days old, birth wt
const CHILD_NAMES: ChildName[] = [
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

const SECTOR_A = ["Mangarajpur", "Badatrilochanpur", "Balarampur"]; // Jajpur Sadar block
const workerForVillage = (village: string) =>
  SECTOR_A.includes(village) ? DEMO_USERS[1] : DEMO_USERS[2];
const blockForVillage = (village: string) =>
  SECTOR_A.includes(village) ? "Jajpur Sadar Block" : "Sukinda Block";

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
// seed generator
// ---------------------------------------------------------------------------
function buildSeed(): Record<string, any[]> {
  const pregnancies: any[] = [];
  const anc_visits: any[] = [];
  const maternal_immunizations: any[] = [];
  const children: any[] = [];
  const child_immunizations: any[] = [];
  const alerts: any[] = [];
  const notifications: any[] = [];

  PREG_NAMES.forEach(([name, husband, age, village, bg], i) => {
    const pId = `PREG-2026-${1000 + i}`;
    const bId = `BEN-2026-${500 + i}`;
    // Records 45-49 are delivered: give them a full-term LMP so EDD is in the
    // past and isTrulyDelivered() trusts the flag (the helper distrusts a
    // "delivered" record whose EDD is still months out).
    const isDelivered = i >= 45;
    const weeksPregnant = isDelivered ? 41 : (i % 36) + 4;
    const lmpDays = isDelivered ? -(288 + (i % 5)) : -(weeksPregnant * 7 + (i % 5));
    const lmpStr = dateOnly(lmpDays);
    const g = gestational(lmpStr);

    // Simulation drivers (historical numeric vitals kept on the record for the
    // ANC-visit history grid; the form no longer collects them).
    const highRisk = i % 7 === 0 || age >= 35 || age < 18;
    const sys = highRisk ? 145 : 118 + (i % 12);
    const dia = highRisk ? 95 : 76 + (i % 8);
    const hb = highRisk ? 6.5 : 11.2 + (i % 4) * 0.4;
    const height_cm = i % 11 === 0 ? 143 : 150 + (i % 6);
    const weight = +(48 + (i % 15) * 1.2).toFixed(1);

    // Manual (Health Slip) screening factors — what a worker would tick.
    const short_stature = height_cm < 145;
    const hypertension = sys >= 140 || dia >= 90;
    const severe_anaemia = hb < 7;
    const bmi_abnormal = i % 8 === 0;
    const prevCSection = highRisk && i % 2 === 0;
    const multipleGestation = i % 13 === 0;
    const comorbidities: string[] = i % 9 === 0 ? ["thyroid"] : [];

    // Screening determination comes from the shared NHM/PMSMA engine so seed
    // data and freshly-registered records evaluate identically.
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

    // ANC visits
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

    // Maternal immunisations
    MAT_VACCINES.forEach((mv, k) => {
      const immId = `MAT-IMM-${pId}-${mv.name.slice(0, 4).trim()}`;
      const dueStr = dateOnly(lmpDays + mv.week * 7);
      let st: string;
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
      void k;
    });

    // High-risk alert (routine, steady-state) + Critical Pregnancy Escalation
    // (prominent, distinct type surfaced on the Admin/CDMO dashboard).
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

    // Missed-ANC alert for some late-term pregnancies
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
    // Upcoming-ANC alert for some mid-term pregnancies
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

  // Children
  CHILD_NAMES.forEach(([cName, gender, motherName, daysOld, birthWt], j) => {
    const cId = `CHD-2026-${2000 + j}`;
    const village = PREG_NAMES[j % PREG_NAMES.length][3];
    const worker = workerForVillage(village);
    const months = Math.floor(daysOld / 30);
    const ageLabel = daysOld < 30 ? `${daysOld} Days` : `${months} Months ${daysOld % 30} Days`;

    let done = 0, overdue = 0, due = 0;
    CHILD_VACCINES.forEach((cv, k) => {
      const dueStr = dateOnly(-(daysOld - cv.dayOffset));
      let st: string;
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

  // Broadcast notifications (district office style)
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
// storage — expo-sqlite, with an in-memory fallback for web / WASM failure
// ---------------------------------------------------------------------------
const SEED_VERSION = "6";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let mem: Record<string, Map<string, string>> | null = null; // collection -> id -> json

function seedIntoMem() {
  mem = {};
  for (const [collection, rows] of Object.entries(buildSeed())) {
    const m = new Map<string, string>();
    for (const row of rows) m.set(row.id, JSON.stringify(row));
    mem[collection] = m;
  }
}

async function getDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (mem) return null;
  if (Platform.OS === "web") {
    // ponytail: expo-sqlite web needs a WASM/worker load that isn't worth the
    // headers/config for a throwaway demo. Web runs entirely in-memory instead;
    // the packaged APK (native) still uses real SQLite below.
    seedIntoMem();
    return null;
  }
  try {
    if (!dbPromise) dbPromise = SQLite.openDatabaseAsync("anm_health_connect_demo.db");
    const db = await dbPromise;
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS demo_records (collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(collection, id));
       CREATE TABLE IF NOT EXISTS demo_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`
    );
    const seeded = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM demo_meta WHERE key='seed_version'"
    );
    if (!seeded || seeded.value !== SEED_VERSION) {
      await db.execAsync("DELETE FROM demo_records; DELETE FROM demo_meta;");
      for (const [collection, rows] of Object.entries(buildSeed())) {
        for (const row of rows) {
          await db.runAsync(
            "INSERT OR REPLACE INTO demo_records (collection, id, data) VALUES (?, ?, ?)",
            collection, row.id, JSON.stringify(row)
          );
        }
      }
      await db.runAsync(
        "INSERT OR REPLACE INTO demo_meta (key, value) VALUES ('seed_version', ?)",
        SEED_VERSION
      );
    }
    return db;
  } catch (e) {
    console.warn("[demoDb] SQLite unavailable, falling back to in-memory store:", e);
    seedIntoMem();
    return null;
  }
}

async function all<T>(collection: string): Promise<T[]> {
  const db = await getDb();
  if (!db) {
    return [...(mem![collection]?.values() ?? [])].map((s) => JSON.parse(s) as T);
  }
  const rows = await db.getAllAsync<{ data: string }>(
    "SELECT data FROM demo_records WHERE collection = ?", collection
  );
  return rows.map((r) => JSON.parse(r.data) as T);
}

async function one<T>(collection: string, id: string): Promise<T | null> {
  const db = await getDb();
  if (!db) {
    const s = mem![collection]?.get(id);
    return s ? (JSON.parse(s) as T) : null;
  }
  const row = await db.getFirstAsync<{ data: string }>(
    "SELECT data FROM demo_records WHERE collection = ? AND id = ?", collection, id
  );
  return row ? (JSON.parse(row.data) as T) : null;
}

async function put(collection: string, id: string, value: any) {
  const db = await getDb();
  if (!db) {
    (mem![collection] ??= new Map()).set(id, JSON.stringify(value));
    return value;
  }
  await db.runAsync(
    "INSERT OR REPLACE INTO demo_records (collection, id, data) VALUES (?, ?, ?)",
    collection, id, JSON.stringify(value)
  );
  return value;
}

// ---------------------------------------------------------------------------
// alert helpers — a critical determination raises a routine HIGH_RISK_PREGNANCY
// alert plus a distinct CRITICAL_PREGNANCY_ESCALATION (upserted by id, so a
// re-trigger refreshes rather than duplicates). Mirrors backend/server.py.
// ---------------------------------------------------------------------------
async function raiseCriticalAlerts(p: any) {
  const base = {
    beneficiary_name: p.full_name,
    beneficiary_id: p.beneficiary_id,
    related_entity_type: "pregnancy" as const,
    related_entity_id: p.id,
    due_date: dateOnly(0),
    assigned_worker_id: p.assigned_worker_id || "",
    assigned_worker_name: p.assigned_worker_name || "",
    status: "ACTIVE" as const,
    created_at: new Date().toISOString(),
  };
  const reasons: string[] = p.high_risk_reasons || [];
  await put("alerts", `ALERT-CRIT-ESC-${p.id}`, {
    ...base,
    id: `ALERT-CRIT-ESC-${p.id}`,
    alert_type: "CRITICAL_PREGNANCY_ESCALATION",
    priority: "CRITICAL",
    title: `Critical Pregnancy Escalation: ${p.full_name}`,
    message: `${p.full_name}, ${p.village} — ${p.gestational_age_label || "gestation n/a"}. Triggers: ${reasons.join("; ")}. Review and arrange follow-up.`,
  });
  await put("alerts", `ALERT-HR-${p.id}`, {
    ...base,
    id: `ALERT-HR-${p.id}`,
    alert_type: "HIGH_RISK_PREGNANCY",
    priority: "CRITICAL",
    title: `High Risk Pregnancy: ${p.full_name}`,
    message: `Requires intensive monitoring: ${reasons.join(", ")}.`,
  });
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------
export async function demoLogin(username: string, password: string) {
  const u = (username || "").toLowerCase().trim();
  const valid =
    (u === "admin" && password === "Admin@123") ||
    (/^worker0[1-5]$/.test(u) && password === "Worker@123");
  if (!valid) {
    throw new Error(
      "Invalid demo credentials. Use worker01 / Worker@123 or admin / Admin@123."
    );
  }
  const user = DEMO_USERS.find((x) => x.username === u) ?? DEMO_USERS[1];
  await getDb();
  return { access_token: "demo-local-sqlite-token", user };
}

// ---------------------------------------------------------------------------
// request router — mirrors backend/server.py routes 1:1
// ---------------------------------------------------------------------------
export async function demoRequest<T>(
  path: string,
  options: { method?: string; body?: any } = {}
): Promise<T> {
  const method = options.method || "GET";
  const clean = path.split("?")[0];
  const query = path.includes("?")
    ? new URLSearchParams(path.split("?")[1])
    : new URLSearchParams();

  if (clean === "/auth/login" && method === "POST")
    return demoLogin(options.body?.username || "", options.body?.password || "") as Promise<T>;
  if (clean === "/auth/logout") return {} as T;
  if (clean === "/sync" && method === "POST")
    return {
      sync_time: new Date().toISOString(),
      total_processed: options.body?.transactions?.length || options.body?.length || 0,
    } as T;

  // ---- dashboard ----
  if (clean === "/dashboard") {
    const ps = await all<any>("pregnancies");
    const cs = await all<any>("children");
    const ais = await all<any>("maternal_immunizations");
    const cis = await all<any>("child_immunizations");
    const act = ps.filter((p) => ["active", "high_risk"].includes(p.status));
    const as = (await all<any>("alerts")).filter((a) => a.status === "ACTIVE");
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
    return {
      summary,
      todays_alerts: as
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 6),
      recent_pregnancies: ps
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 5),
      // Critical pregnancies needing follow-up — surfaced at the very top of the
      // Health Worker dashboard, above the "Needs attention" worklist.
      critical_pregnancies: act
        .filter((p) => p.is_high_risk)
        .sort((a, b) =>
          String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at))
        )
        .slice(0, 25)
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          village: p.village,
          gestational_age_label: p.gestational_age_label,
          high_risk_reasons: p.high_risk_reasons || [],
        })),
      last_updated: new Date().toISOString(),
    } as T;
  }

  // ---- pregnancies ----
  if (clean === "/pregnancies" && method === "GET") {
    let rows = await all<any>("pregnancies");
    const search = (query.get("search") || "").toLowerCase();
    if (search)
      rows = rows.filter((p) =>
        `${p.full_name} ${p.mobile_number} ${p.beneficiary_id} ${p.husband_name} ${p.village}`
          .toLowerCase()
          .includes(search)
      );
    if (query.get("trimester")) rows = rows.filter((p) => String(p.trimester) === query.get("trimester"));
    if (query.get("village") && query.get("village") !== "All")
      rows = rows.filter((p) => p.village.toLowerCase() === query.get("village")!.toLowerCase());
    if (query.get("high_risk") === "true") rows = rows.filter((p) => p.is_high_risk);
    const sf = query.get("status_filter");
    if (sf && sf !== "all") rows = rows.filter((p) => p.status === sf);
    else rows = rows.filter((p) => p.status !== "archived");
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return { total: rows.length, items: rows } as T;
  }

  const pMatch = clean.match(/^\/pregnancies\/([^/]+)$/);
  if (pMatch && method === "GET") {
    const p = await one<any>("pregnancies", pMatch[1]);
    if (!p) throw new Error("Pregnancy not found");
    return {
      pregnancy: p,
      visits: (await all<any>("anc_visits")).filter((v) => v.pregnancy_id === p.id),
      immunizations: (await all<any>("maternal_immunizations")).filter((i) => i.pregnancy_id === p.id),
      children: (await all<any>("children")).filter(
        (c) => c.mother_id === p.id || c.mother_id === p.beneficiary_id || c.mother_name === p.full_name
      ),
    } as T;
  }

  if (clean === "/pregnancies" && method === "POST") {
    const b = options.body || {};
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
    await put("pregnancies", p.id, p);
    if (risk.is_critical) await raiseCriticalAlerts(p);
    return p as T;
  }

  const vMatch = clean.match(/^\/pregnancies\/([^/]+)\/visits$/);
  if (vMatch && method === "POST") {
    const b = options.body || {};
    const p = await one<any>("pregnancies", vMatch[1]);
    if (!p) throw new Error("Pregnancy not found");
    const existing = (await all<any>("anc_visits")).filter((x) => x.pregnancy_id === p.id);

    // Risk factors newly identified at this visit are additive — a visit can add
    // a factor to the mother's record but never un-set one recorded earlier.
    const mergedFactors = {
      short_stature: !!(b.short_stature || p.short_stature),
      hypertension: !!(b.hypertension || p.hypertension),
      severe_anaemia: !!(b.severe_anaemia || p.severe_anaemia),
      bmi_abnormal: !!(b.bmi_abnormal || p.bmi_abnormal),
      previous_c_section: !!(b.previous_c_section || p.previous_c_section),
      previous_stillbirth_or_pph: !!(b.previous_stillbirth_or_pph || p.previous_stillbirth_or_pph),
      multiple_gestation: !!(b.multiple_gestation || p.multiple_gestation),
      critical_override: !!(b.critical_override || p.critical_override),
      comorbidities: Array.from(
        new Set([...(p.comorbidities || []), ...(b.comorbidities || [])])
      ),
    };
    const wasCritical = !!p.is_high_risk;
    const risk = assessRisk({
      age: p.age, dob: p.dob,
      gravida: p.gravida, blood_group: p.blood_group,
      ...mergedFactors,
    });

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
    await put("anc_visits", v.id, v);

    const updatedP = {
      ...p,
      ...mergedFactors,
      is_high_risk: risk.is_critical,
      high_risk_reasons: risk.reasons,
      status:
        p.status === "delivered"
          ? "delivered"
          : risk.is_critical
          ? "high_risk"
          : wasCritical
          ? "active"
          : p.status,
      updated_at: new Date().toISOString(),
    };
    await put("pregnancies", p.id, updatedP);
    if (risk.is_critical && updatedP.status !== "delivered") await raiseCriticalAlerts(updatedP);

    return v as T;
  }

  const miMatch = clean.match(/^\/pregnancies\/([^/]+)\/immunizations\/([^/]+)\/complete$/);
  if (miMatch && method === "POST") {
    const i = await one<any>("maternal_immunizations", miMatch[2]);
    if (!i) throw new Error("Immunization not found");
    return put("maternal_immunizations", i.id, {
      ...i, administration_date: dateOnly(0), status: "Completed", ...(options.body || {}),
    }) as Promise<T>;
  }

  const pmsmaMatch = clean.match(/^\/pregnancies\/([^/]+)\/pmsma\/attend$/);
  if (pmsmaMatch && method === "POST") {
    const p = await one<any>("pregnancies", pmsmaMatch[1]);
    if (!p) throw new Error("Pregnancy not found");
    const updated = { ...p, last_pmsma_check_date: dateOnly(0), updated_at: new Date().toISOString() };
    await put("pregnancies", p.id, updated);
    return updated as T;
  }

  // ---- children ----
  if (clean === "/children" && method === "GET") {
    let rows = await all<any>("children");
    const search = (query.get("search") || "").toLowerCase();
    if (search)
      rows = rows.filter((c) =>
        `${c.child_name} ${c.child_id} ${c.mother_name} ${c.village}`.toLowerCase().includes(search)
      );
    if (query.get("village") && query.get("village") !== "All")
      rows = rows.filter((c) => c.village.toLowerCase() === query.get("village")!.toLowerCase());
    if (query.get("gender")) rows = rows.filter((c) => c.gender === query.get("gender"));
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return { total: rows.length, items: rows } as T;
  }
  if (clean === "/children" && method === "POST") {
    const b = options.body || {};
    const c = {
      ...b,
      id: b.id || `CHILD-LOCAL-${Date.now()}`,
      child_id: b.child_id || `CHILD-LOCAL-${Date.now()}`,
      age_days: 0, age_label: "Newborn",
      vaccine_stats: b.vaccine_stats || { total: 0, completed: 0, overdue: 0, due: 0, progress_percent: 0 },
      created_at: new Date().toISOString(),
    };
    return put("children", c.id, c) as Promise<T>;
  }
  const cMatch = clean.match(/^\/children\/([^/]+)$/);
  if (cMatch && method === "GET") {
    const c = await one<any>("children", cMatch[1]);
    if (!c) throw new Error("Child not found");
    return {
      child: c,
      immunizations: (await all<any>("child_immunizations")).filter((i) => i.child_id === c.id),
      mother:
        (await one<any>("pregnancies", c.mother_id)) ||
        (await all<any>("pregnancies")).find((p) => p.full_name === c.mother_name) ||
        null,
    } as T;
  }
  const ciMatch = clean.match(/^\/children\/([^/]+)\/immunizations\/([^/]+)\/complete$/);
  if (ciMatch && method === "POST") {
    const i = await one<any>("child_immunizations", ciMatch[2]);
    if (!i) throw new Error("Immunization not found");
    return put("child_immunizations", i.id, {
      ...i, administered_date: dateOnly(0), status: "Completed", ...(options.body || {}),
    }) as Promise<T>;
  }
  const cirMatch = clean.match(/^\/children\/([^/]+)\/immunizations\/([^/]+)\/reschedule$/);
  if (cirMatch && method === "POST") {
    const i = await one<any>("child_immunizations", cirMatch[2]);
    if (!i) throw new Error("Immunization not found");
    return put("child_immunizations", i.id, { ...i, ...(options.body || {}), status: "Upcoming" }) as Promise<T>;
  }

  // ---- alerts ----
  if (clean === "/alerts" && method === "GET") {
    let rows = await all<any>("alerts");
    const sf = query.get("status_filter");
    if (sf && sf !== "all") rows = rows.filter((a) => a.status === sf);
    if (query.get("priority")) rows = rows.filter((a) => a.priority === query.get("priority"));
    const cat = query.get("category");
    if (cat && cat !== "all") {
      if (cat === "high_risk") rows = rows.filter((a) => a.alert_type === "HIGH_RISK_PREGNANCY");
      else if (cat === "missed_anc") rows = rows.filter((a) => a.alert_type === "MISSED_ANC");
      else rows = rows.filter((a) => a.alert_type === cat);
    }
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return { total: rows.length, items: rows } as T;
  }
  const ack = clean.match(/^\/alerts\/([^/]+)\/acknowledge$/);
  if (ack && method === "POST") {
    const a = await one<any>("alerts", ack[1]);
    if (!a) throw new Error("Alert not found");
    return put("alerts", a.id, { ...a, status: "ACKNOWLEDGED" }) as Promise<T>;
  }
  if (clean === "/alerts/recalculate")
    return {
      message: "Local demo alert engine refreshed",
      total_alerts: (await all<any>("alerts")).length,
    } as T;

  // ---- notifications ----
  if (clean === "/notifications" && method === "GET") {
    const rows = (await all<any>("notifications")).sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at))
    );
    return { unread_count: rows.filter((n) => !n.is_read).length, items: rows } as T;
  }
  const nr = clean.match(/^\/notifications\/([^/]+)\/read$/);
  if (nr && method === "POST") {
    const n = await one<any>("notifications", nr[1]);
    if (!n) throw new Error("Notification not found");
    return put("notifications", n.id, { ...n, is_read: true }) as Promise<T>;
  }

  // ---- admin ----
  if (clean === "/admin/kpis") {
    const ps = await all<any>("pregnancies");
    const cs = await all<any>("children");
    const vs = await all<any>("anc_visits");
    const cis = await all<any>("child_immunizations");
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
    return {
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
    } as T;
  }
  if (clean === "/audit-logs") return [] as T;

  throw new Error(`Demo mode: endpoint not implemented locally: ${method} ${path}`);
}
