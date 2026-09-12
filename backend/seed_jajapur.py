"""One-off seeding script: adds demo Maternal & Child Health records for
Jajapur Block villages (Abdalpur, Ankula, Aradapada, Badasuar, Baibhuin)."""
from pymongo import MongoClient
from datetime import datetime, timedelta, timezone

client = MongoClient("mongodb://localhost:27017")
db = client["test_database"]

WORKER_ID = "USR-HW-001"
WORKER_NAME = "Smruti Malla (ANM)"
PHC = "Primary Health Centre (PHC) Rampur"
BLOCK = "Jajapur Block"
DISTRICT = "Jajpur"
today = datetime.now(timezone.utc).replace(tzinfo=None)
now_iso = datetime.now(timezone.utc).isoformat()

MAT_TEMPLATES = [
    {"vaccine_name": "TT-1 (Tetanus Toxoid 1)", "weeks_offset": 12, "dose": "0.5 ml IM", "description": "Early in pregnancy (1st Trimester)"},
    {"vaccine_name": "TT-2 (Tetanus Toxoid 2)", "weeks_offset": 16, "dose": "0.5 ml IM", "description": "4 weeks after TT-1"},
    {"vaccine_name": "IFA Supplementation (180 Tab)", "weeks_offset": 14, "dose": "1 Tab Daily", "description": "Iron Folic Acid from 2nd Trimester"},
    {"vaccine_name": "Calcium & Vit D3 (360 Tab)", "weeks_offset": 14, "dose": "2 Tab Daily", "description": "Calcium supplementation from 14 weeks"},
    {"vaccine_name": "Albendazole (Deworming)", "weeks_offset": 24, "dose": "400 mg single", "description": "Single dose after 1st Trimester"},
]

CHILD_TEMPLATES = [
    {"vaccine_code": "BCG", "vaccine_name": "BCG (Bacillus Calmette-Guerin)", "target_age_label": "At Birth", "days_offset": 0, "route": "Intradermal"},
    {"vaccine_code": "OPV-0", "vaccine_name": "Oral Polio Vaccine 0", "target_age_label": "At Birth", "days_offset": 0, "route": "Oral"},
    {"vaccine_code": "HEPB-B", "vaccine_name": "Hepatitis B (Birth Dose)", "target_age_label": "At Birth", "days_offset": 0, "route": "Intramuscular"},
    {"vaccine_code": "PENTA-1", "vaccine_name": "Pentavalent 1 (DPT+HepB+Hib)", "target_age_label": "6 Weeks", "days_offset": 42, "route": "Intramuscular"},
    {"vaccine_code": "OPV-1", "vaccine_name": "Oral Polio Vaccine 1", "target_age_label": "6 Weeks", "days_offset": 42, "route": "Oral"},
    {"vaccine_code": "ROTA-1", "vaccine_name": "Rotavirus Vaccine 1", "target_age_label": "6 Weeks", "days_offset": 42, "route": "Oral"},
    {"vaccine_code": "PENTA-2", "vaccine_name": "Pentavalent 2", "target_age_label": "10 Weeks", "days_offset": 70, "route": "Intramuscular"},
    {"vaccine_code": "PENTA-3", "vaccine_name": "Pentavalent 3", "target_age_label": "14 Weeks", "days_offset": 98, "route": "Intramuscular"},
    {"vaccine_code": "MR-1", "vaccine_name": "Measles & Rubella 1", "target_age_label": "9-12 Months", "days_offset": 270, "route": "Subcutaneous"},
    {"vaccine_code": "DPT-B1", "vaccine_name": "DPT Booster 1", "target_age_label": "16-24 Months", "days_offset": 480, "route": "Intramuscular"},
]


def gest_info(lmp_dt):
    diff = (today - lmp_dt).days
    total = max(0, diff)
    weeks = total // 7
    days = total % 7
    edd = lmp_dt + timedelta(days=280)
    trimester = 1 if weeks <= 12 else 2 if weeks <= 27 else 3
    return weeks, days, f"{weeks} Weeks {days} Days", edd.strftime("%Y-%m-%d"), trimester, (edd - today).days


# (name, husband, age, village, blood, weeks_pregnant, completed_visits, high_risk, bp_sys, bp_dia, hb, history, condition)
MOTHERS = [
    ("Sasmita Jena", "Prakash Jena", 27, "Abdalpur", "O+", 32, 1, False, 122, 82, 11.4, "Normal previous delivery", "None"),
    ("Puspanjali Sahoo", "Bikram Sahoo", 34, "Ankula", "B+", 26, 1, True, 146, 94, 8.6, "Previous C-Section in 2023", "Mild Gestational Hypertension"),
    ("Rojalin Behera", "Sanjay Behera", 19, "Aradapada", "A+", 10, 1, False, 118, 78, 11.8, "Primigravida", "None"),
    ("Manaswini Nayak", "Deepak Nayak", 31, "Badasuar", "AB+", 37, 3, False, 124, 84, 11.0, "Normal previous delivery", "None"),
    ("Lipsa Mohanty", "Rakesh Mohanty", 17, "Baibhuin", "O-", 22, 1, True, 120, 80, 7.9, "Primigravida", "Severe Anemia"),
    ("Sunita Pradhan", "Gopal Pradhan", 38, "Abdalpur", "B+", 30, 2, True, 138, 88, 10.2, "Grand multipara history", "None"),
    ("Ipsita Rout", "Manoj Rout", 24, "Ankula", "A+", 8, 0, False, 116, 76, 12.0, "Primigravida", "None"),
    ("Sujata Das", "Niranjan Das", 29, "Aradapada", "O+", 28, 2, False, 121, 80, 11.2, "Normal previous delivery", "None"),
]

# clear any previous run of this script
db.pregnancies.delete_many({"block": BLOCK})
db.anc_visits.delete_many({"id": {"$regex": "^ANC-VISIT-PREG-JAJ-"}})
db.maternal_immunizations.delete_many({"id": {"$regex": "^MAT-IMM-PREG-JAJ-"}})
db.children.delete_many({"block": BLOCK})
db.child_immunizations.delete_many({"id": {"$regex": "^CHD-IMM-CHD-JAJ-"}})

for i, (name, husband, age, village, bg, weeks, visits_done, hr, sys, dia, hb, hist, cond) in enumerate(MOTHERS):
    p_id = f"PREG-JAJ-{100 + i}"
    b_id = f"BEN-JAJ-{500 + i}"
    lmp_dt = today - timedelta(days=weeks * 7)
    gw, gd, glabel, edd, trimester, days_to_edd = gest_info(lmp_dt)

    reasons = []
    if age < 18:
        reasons.append("Adolescent pregnancy (Age < 18)")
    elif age >= 35:
        reasons.append("Advanced maternal age (Age >= 35)")
    if sys >= 140 or dia >= 90:
        reasons.append(f"Pregnancy Induced Hypertension (BP {sys}/{dia} mmHg)")
    if hb < 7.0:
        reasons.append(f"Severe Anemia (Hb {hb} g/dL)")
    elif hb < 9.0:
        reasons.append(f"Moderate Anemia (Hb {hb} g/dL)")
    is_hr = hr or len(reasons) > 0

    db.pregnancies.insert_one({
        "id": p_id, "beneficiary_id": b_id, "full_name": name, "husband_name": husband,
        "age": age, "dob": (today - timedelta(days=age * 365)).strftime("%Y-%m-%d"),
        "mobile_number": f"90900{20000 + i}", "address": f"Vill {village}, {BLOCK}",
        "village": village, "block": BLOCK, "district": DISTRICT,
        "registration_date": (lmp_dt + timedelta(days=50)).strftime("%Y-%m-%d"),
        "lmp": lmp_dt.strftime("%Y-%m-%d"), "edd": edd,
        "gestational_weeks": gw, "gestational_days": gd, "gestational_age_label": glabel,
        "trimester": trimester, "gravida": (i % 3) + 1, "para": i % 2, "blood_group": bg,
        "weight": 50.0 + i, "bp_systolic": sys, "bp_diastolic": dia, "hemoglobin": hb,
        "fundal_height": f"{gw} cm", "fetal_heart_rate": 140 + (i % 10),
        "is_high_risk": is_hr, "high_risk_reasons": reasons,
        "previous_pregnancy_history": hist, "existing_conditions": cond,
        "allergies": "No known drug allergies",
        "risk_factors": "High Risk Monitored" if is_hr else "Standard Care",
        "assigned_worker_id": WORKER_ID, "assigned_worker_name": WORKER_NAME, "health_centre": PHC,
        "status": "high_risk" if is_hr else "active",
        "created_at": now_iso, "updated_at": now_iso, "sync_status": "synced",
    })

    # ANC completed visits (fewer than schedule -> triggers overdue ANC / trimester alerts)
    for v in range(1, visits_done + 1):
        vid = f"ANC-VISIT-{p_id}-{v}"
        db.anc_visits.insert_one({
            "id": vid, "pregnancy_id": p_id, "beneficiary_id": b_id, "mother_name": name,
            "visit_number": v, "visit_date": (lmp_dt + timedelta(days=v * 56)).strftime("%Y-%m-%d"),
            "gestational_weeks_at_visit": v * 8, "weight": 50.0 + v, "bp_systolic": sys,
            "bp_diastolic": dia, "hemoglobin": hb, "fundal_height": f"{v*8} cm",
            "fetal_heart_rate": 142, "symptoms": "Routine check-up completed",
            "examination_notes": "Maternal condition stable.",
            "investigation_details": f"BP {sys}/{dia}, Hb {hb} g/dL, Urine Albumin: Nil",
            "risk_status": "High Risk" if is_hr else "Normal",
            "advice": "IFA tablets daily, nutritious diet, institutional delivery.",
            "next_visit_date": (today + timedelta(days=21)).strftime("%Y-%m-%d"),
            "health_worker_id": WORKER_ID, "health_worker_name": WORKER_NAME,
            "status": "Completed", "created_at": now_iso,
        })

    # Maternal immunizations with Due / Overdue statuses
    for tmpl in MAT_TEMPLATES:
        due = (lmp_dt + timedelta(weeks=tmpl["weeks_offset"])).strftime("%Y-%m-%d")
        iid = f"MAT-IMM-{p_id}-{tmpl['vaccine_name'][:4].strip()}"
        if gw > tmpl["weeks_offset"] + 3:
            status = "Overdue" if (i + tmpl["weeks_offset"]) % 2 == 0 else "Completed"
        elif gw >= tmpl["weeks_offset"] - 1:
            status = "Due"
        else:
            status = "Upcoming"
        db.maternal_immunizations.insert_one({
            "id": iid, "pregnancy_id": p_id, "beneficiary_id": b_id, "mother_name": name,
            "vaccine_name": tmpl["vaccine_name"], "dose": tmpl["dose"], "description": tmpl["description"],
            "recommended_date": due, "due_date": due,
            "administration_date": due if status == "Completed" else None,
            "batch_number": "BATCH-JAJ-01" if status == "Completed" else "",
            "status": status,
            "remarks": "Administered at VHND" if status == "Completed" else "Scheduled on Village Health & Nutrition Day (VHND)",
            "health_worker_name": WORKER_NAME, "created_at": now_iso,
        })

# (child, gender, mother, days_old, village, birth_weight)
CHILDREN = [
    ("Aryan Jena", "Male", "Sasmita Jena", 60, "Abdalpur", 3.1),
    ("Anwesha Sahoo", "Female", "Puspanjali Sahoo", 200, "Ankula", 2.9),
    ("Debasish Behera", "Male", "Rojalin Behera", 15, "Aradapada", 3.3),
    ("Priyanka Nayak", "Female", "Manaswini Nayak", 400, "Badasuar", 3.0),
    ("Soumya Mohanty", "Male", "Lipsa Mohanty", 90, "Baibhuin", 2.8),
]

for j, (cname, gender, mother, days_old, village, bw) in enumerate(CHILDREN):
    c_id = f"CHD-JAJ-{200 + j}"
    dob = today - timedelta(days=days_old)
    db.children.insert_one({
        "id": c_id, "child_id": f"CHILD-JAJ-{9000 + j}", "mother_id": f"BEN-JAJ-{500 + j}",
        "mother_name": mother, "mother_mobile": f"90900{20000 + j}", "child_name": cname,
        "gender": gender, "dob": dob.strftime("%Y-%m-%d"), "age_days": days_old,
        "age_label": f"{days_old // 30} Months {days_old % 30} Days" if days_old >= 30 else f"{days_old} Days",
        "birth_weight": bw, "place_of_birth": "PHC Hospital Jajapur",
        "address": f"Vill {village}, {BLOCK}", "village": village, "block": BLOCK, "district": DISTRICT,
        "health_worker_id": WORKER_ID, "health_worker_name": WORKER_NAME,
        "created_at": now_iso, "updated_at": now_iso,
    })
    for tmpl in CHILD_TEMPLATES:
        due = (dob + timedelta(days=tmpl["days_offset"])).strftime("%Y-%m-%d")
        vid = f"CHD-IMM-{c_id}-{tmpl['vaccine_code']}"
        if days_old > tmpl["days_offset"] + 14:
            status = "Overdue" if (j + tmpl["days_offset"]) % 3 == 0 else "Completed"
        elif days_old >= tmpl["days_offset"] - 5:
            status = "Due"
        else:
            status = "Upcoming"
        db.child_immunizations.insert_one({
            "id": vid, "child_id": c_id, "child_name": cname, "vaccine_code": tmpl["vaccine_code"],
            "vaccine_name": tmpl["vaccine_name"], "target_age_label": tmpl["target_age_label"],
            "recommended_due_date": due, "administered_date": due if status == "Completed" else None,
            "route": tmpl["route"], "status": status,
            "batch_no": "CHD-JAJ-26" if status == "Completed" else "",
            "adverse_event_reported": False,
            "remarks": "Administered without adverse reaction" if status == "Completed" else "Scheduled on Routine Immunization Day",
            "administered_by": WORKER_NAME, "created_at": now_iso,
        })

print("Jajapur seed complete:",
      "pregnancies=", db.pregnancies.count_documents({"block": BLOCK}),
      "children=", db.children.count_documents({"block": BLOCK}))
