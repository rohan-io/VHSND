"""
Demo dataset seeding for Postgres — same shape as the old Mongo seed
(6 users, 50 beneficiaries/pregnancies, ANC visits, maternal + child vaccine
schedules, 30 children, 3 notifications), then one alert sweep.

Idempotent: skips if users exist and there are already >= 30 pregnancies.
"""

from __future__ import annotations

import datetime as dt
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from helpers import (
    DEMO_CHILD_VACCINE_TEMPLATES,
    DEMO_MATERNAL_VACCINE_TEMPLATES,
    assess_high_risk,
    calculate_gestational_info,
    hash_password,
)
from db.models import (
    Beneficiary,
    Child,
    ChildImmunization,
    ANCVisit,
    MaternalImmunization,
    Notification,
    Pregnancy,
    User,
)
from services import alerts as alert_svc

logger = logging.getLogger("mch_backend")

RAMPUR_SECTOR_VILLAGES = {"Rampur", "Kalyanpur", "Shivpur"}

USERS = [
    dict(id="USR-ADMIN-001", username="admin", password="Admin@123", role="Administrator",
         name="Dilip Acharya (Chief Medical Officer)", mobile="9876543210",
         phc_center="District Hospital Central", sector="District HQ",
         assigned_villages=["All Villages"]),
    dict(id="USR-HW-001", username="worker01", password="Worker@123", role="Health Worker",
         name="Smruti Malla (ANM)", mobile="9812345671",
         phc_center="Primary Health Centre (PHC) Rampur", sector="Sector A - North",
         assigned_villages=["Rampur", "Kalyanpur", "Shivpur"]),
    dict(id="USR-HW-002", username="worker02", password="Worker@123", role="Health Worker",
         name="Pooja Verma (ASHA)", mobile="9812345672",
         phc_center="Primary Health Centre (PHC) Rampur", sector="Sector B - South",
         assigned_villages=["Bishnupur", "Shantinagar", "Gopalpur"]),
    dict(id="USR-HW-003", username="worker03", password="Worker@123", role="Health Worker",
         name="Anita Devi (ANM)", mobile="9812345673",
         phc_center="Sub-Centre Kalyanpur", sector="Sector C - East",
         assigned_villages=["Kalyanpur", "Haridaspur"]),
    dict(id="USR-HW-004", username="worker04", password="Worker@123", role="Health Worker",
         name="Meena Kumari (ASHA)", mobile="9812345674",
         phc_center="Sub-Centre Bishnupur", sector="Sector D - West",
         assigned_villages=["Bishnupur", "Chandrapur"]),
    dict(id="USR-HW-005", username="worker05", password="Worker@123", role="Health Worker",
         name="Rekha Patel (ANM)", mobile="9812345675",
         phc_center="PHC Rampur", sector="Sector E - Central",
         assigned_villages=["Gopalpur", "Rampur"]),
]

MOTHERS = [
    ("Sunita Devi", "Rajesh Kumar", 24, "Rampur", "O+"),
    ("Priya Sharma", "Amit Sharma", 22, "Kalyanpur", "B+"),
    ("Radha Yadav", "Virender Yadav", 29, "Bishnupur", "A+"),
    ("Geeta Patel", "Manoj Patel", 36, "Shantinagar", "AB+"),
    ("Kavita Kumari", "Dinesh Kumar", 17, "Gopalpur", "O-"),
    ("Meera Bai", "Sanjay Singh", 26, "Shivpur", "B+"),
    ("Aarti Gupta", "Deepak Gupta", 28, "Rampur", "A+"),
    ("Suman Verma", "Ramesh Verma", 31, "Haridaspur", "O+"),
    ("Pooja Mishra", "Anand Mishra", 23, "Chandrapur", "B-"),
    ("Anjali Tiwari", "Pradeep Tiwari", 27, "Kalyanpur", "A+"),
    ("Chanda Devi", "Santosh Kumar", 32, "Bishnupur", "O+"),
    ("Laxmi Sah", "Arun Sah", 25, "Rampur", "AB+"),
    ("Sushila Soren", "Mangal Soren", 21, "Shivpur", "B+"),
    ("Nisha Parveen", "Mohd. Imran", 28, "Shantinagar", "O+"),
    ("Kiran Lodhi", "Ravi Lodhi", 30, "Gopalpur", "A+"),
    ("Savita Bind", "Lal Bahadur", 34, "Kalyanpur", "B+"),
    ("Babita Chauhan", "Pramod Chauhan", 26, "Rampur", "O+"),
    ("Manju Sahu", "Ajay Sahu", 29, "Bishnupur", "A-"),
    ("Shobha Rawat", "Devendra Rawat", 22, "Haridaspur", "O+"),
    ("Reena Mourya", "Suraj Mourya", 27, "Chandrapur", "B+"),
    ("Sangeeta Jha", "Brijesh Jha", 35, "Shivpur", "AB+"),
    ("Vandana Pal", "Rohit Pal", 24, "Rampur", "O+"),
    ("Kusum Lata", "Kishore Kumar", 28, "Shantinagar", "A+"),
    ("Mamta Gond", "Shyam Gond", 20, "Gopalpur", "B+"),
    ("Rani Nishad", "Pankaj Nishad", 25, "Kalyanpur", "O+"),
    ("Pushpa Baghel", "Hemant Baghel", 33, "Bishnupur", "A+"),
    ("Pinky Kashyap", "Vikram Kashyap", 23, "Rampur", "B+"),
    ("Urmila Sen", "Mahesh Sen", 30, "Haridaspur", "O+"),
    ("Tara Kushwaha", "Govind Kushwaha", 26, "Shivpur", "A+"),
    ("Renu Tripathi", "Alok Tripathi", 27, "Chandrapur", "AB-"),
    ("Santoshi Baiga", "Babulal Baiga", 19, "Gopalpur", "O+"),
    ("Durga Kol", "Suresh Kol", 32, "Bishnupur", "B+"),
    ("Basanti Roy", "Swapan Roy", 29, "Kalyanpur", "A+"),
    ("Seema Das", "Ratan Das", 24, "Rampur", "O+"),
    ("Kajal Sonkar", "Mukesh Sonkar", 22, "Shantinagar", "B+"),
    ("Bimla Prajapati", "Dharmendra Prajapati", 31, "Haridaspur", "A+"),
    ("Jyoti Ahirwar", "Vinod Ahirwar", 25, "Shivpur", "O+"),
    ("Archana Gautam", "Pawan Gautam", 28, "Chandrapur", "B+"),
    ("Neetu Paswan", "Chhotu Paswan", 21, "Gopalpur", "A+"),
    ("Sarita Manjhi", "Sukhram Manjhi", 37, "Bishnupur", "O-"),
    ("Madhuri Dixit", "Kamlesh Dixit", 26, "Rampur", "AB+"),
    ("Indira Barman", "Subhash Barman", 30, "Kalyanpur", "B+"),
    ("Sudha Shukla", "Dhananjay Shukla", 27, "Shantinagar", "A+"),
    ("Phoolmati Oraon", "Jitu Oraon", 23, "Haridaspur", "O+"),
    ("Sharda Vishwakarma", "Mohan Vishwakarma", 34, "Shivpur", "B+"),
    ("Kamla Khatun", "Nasir Khan", 28, "Chandrapur", "A+"),
    ("Parvati Munda", "Birsa Munda", 25, "Gopalpur", "O+"),
    ("Munni Bai", "Kalu Ram", 32, "Bishnupur", "B+"),
    ("Guddi Devi", "Satish Kumar", 24, "Rampur", "A+"),
    ("Hemlata Kurmi", "Rakesh Kurmi", 29, "Kalyanpur", "O+"),
]

CHILDREN = [
    ("Aarav Kumar", "Male", 45, 3.1), ("Ananya Sharma", "Female", 90, 2.9),
    ("Vivaan Yadav", "Male", 180, 3.4), ("Diya Patel", "Female", 15, 2.8),
    ("Kabir Singh", "Male", 300, 3.2), ("Isha Gupta", "Female", 60, 3.0),
    ("Reyansh Verma", "Male", 450, 3.5), ("Avni Mishra", "Female", 120, 2.9),
    ("Atharv Tiwari", "Male", 30, 3.3), ("Myra Sah", "Female", 210, 3.1),
    ("Rudra Soren", "Male", 80, 2.7), ("Zoya Parveen", "Female", 360, 3.0),
    ("Dhruv Lodhi", "Male", 150, 3.2), ("Prisha Bind", "Female", 20, 2.9),
    ("Shaurya Chauhan", "Male", 270, 3.4), ("Anika Sahu", "Female", 500, 3.1),
    ("Kian Rawat", "Male", 100, 3.0), ("Saanvi Mourya", "Female", 70, 2.8),
    ("Samarth Jha", "Male", 400, 3.3), ("Navya Pal", "Female", 14, 3.0),
    ("Yuvraj Lata", "Male", 230, 3.2), ("Tanvi Gond", "Female", 55, 2.7),
    ("Aditya Nishad", "Male", 320, 3.5), ("Riya Baghel", "Female", 110, 3.0),
    ("Shivansh Kashyap", "Male", 40, 3.1), ("Pari Sen", "Female", 260, 2.9),
    ("Vedant Kushwaha", "Male", 85, 3.3), ("Ahana Tripathi", "Female", 600, 3.2),
    ("Manish Baiga", "Male", 190, 2.8), ("Bhavya Kol", "Female", 130, 3.0),
]


def _worker_for(village: str) -> str:
    return "USR-HW-001" if village in RAMPUR_SECTOR_VILLAGES else "USR-HW-002"


def _phc_for(worker_id: str) -> str:
    return next(u["phc_center"] for u in USERS if u["id"] == worker_id)


async def seed_if_empty(session: AsyncSession) -> None:
    user_count = (await session.execute(select(func.count()).select_from(User))).scalar_one()
    preg_count = (await session.execute(select(func.count()).select_from(Pregnancy))).scalar_one()
    if user_count > 0 and preg_count >= 30:
        logger.info("Seed skipped: %s users, %s pregnancies already present.", user_count, preg_count)
        return

    logger.info("Seeding demonstration dataset into Postgres...")
    today = dt.date.today()
    now = dt.datetime.now(dt.timezone.utc)

    # 1. Users
    for u in USERS:
        exists = await session.get(User, u["id"])
        if exists:
            continue
        session.add(User(
            id=u["id"], username=u["username"],
            hashed_password=hash_password(u["password"]),
            role=u["role"], name=u["name"], mobile=u["mobile"],
            phc_center=u["phc_center"], sector=u["sector"],
            assigned_villages=u["assigned_villages"], is_active=True,
        ))
    await session.flush()

    # 2. Beneficiaries + Pregnancies + ANC visits + maternal immunizations
    for i, (m_name, h_name, age, village, bg) in enumerate(MOTHERS):
        p_id = f"PREG-2026-{1000 + i}"
        b_id = f"BEN-2026-{500 + i}"
        if await session.get(Pregnancy, p_id):
            continue

        weeks_pregnant = (i % 36) + 4
        lmp_date = today - dt.timedelta(days=weeks_pregnant * 7 + (i % 5))
        gest = calculate_gestational_info(lmp_date)

        is_hr_sim = (i % 7 == 0) or (age >= 35) or (age < 18)
        sys_bp = 145 if is_hr_sim else 118 + (i % 12)
        dia_bp = 95 if is_hr_sim else 76 + (i % 8)
        hb_val = 7.8 if is_hr_sim else round(11.2 + ((i % 4) * 0.4), 2)
        prev_history = (
            "Previous C-Section in 2023" if is_hr_sim and i % 2 == 0
            else "Normal previous delivery" if age > 25 else "Primigravida"
        )
        existing_cond = "Mild Gestational Hypertension" if is_hr_sim else "None"
        worker_id = _worker_for(village)

        session.add(Beneficiary(
            id=b_id, full_name=m_name, husband_name=h_name,
            dob=today - dt.timedelta(days=age * 365), age=age,
            mobile_number=f"98100{10000 + i}", address=f"House No. {12 + i}, {village}",
            village=village, block="Rampur Block", district="Siddharthnagar",
            blood_group=bg, allergies="No known drug allergies",
        ))

        risk_dict = dict(
            age=age, bp_systolic=sys_bp, bp_diastolic=dia_bp, hemoglobin=hb_val,
            gravida=(i % 4) + 1, previous_pregnancy_history=prev_history,
            existing_conditions=existing_cond, is_high_risk=is_hr_sim,
        )
        is_hr_calc, reasons_calc = assess_high_risk(risk_dict)

        session.add(Pregnancy(
            id=p_id, beneficiary_id=b_id, assigned_worker_id=worker_id,
            registration_date=lmp_date + dt.timedelta(days=45),
            lmp=lmp_date, edd=gest["edd_date"], trimester=gest["trimester"],
            gravida=(i % 4) + 1, para=i % 3,
            weight=round(48.0 + (i % 15) * 1.2, 2), bp_systolic=sys_bp,
            bp_diastolic=dia_bp, hemoglobin=hb_val,
            fundal_height=f"{weeks_pregnant} cm", fetal_heart_rate=140 + (i % 18),
            is_high_risk=is_hr_calc, high_risk_reasons=reasons_calc,
            previous_pregnancy_history=prev_history, existing_conditions=existing_cond,
            risk_factors="High Risk Monitored" if is_hr_calc else "Standard Care",
            status="active" if i < 45 else "delivered", sync_status="synced",
        ))
        await session.flush()

        num_visits = min(4, max(1, gest["gestational_weeks"] // 8))
        for v_num in range(1, num_visits + 1):
            session.add(ANCVisit(
                id=f"ANC-VISIT-{p_id}-{v_num}", pregnancy_id=p_id,
                health_worker_id=worker_id, visit_number=v_num,
                visit_date=lmp_date + dt.timedelta(days=v_num * 60),
                next_visit_date=today + dt.timedelta(days=21),
                gestational_weeks_at_visit=v_num * 8,
                weight=round(48.0 + (v_num * 2.1), 2), bp_systolic=sys_bp,
                bp_diastolic=dia_bp, hemoglobin=hb_val,
                fundal_height=f"{v_num * 8} cm", fetal_heart_rate=142 + (v_num * 2),
                symptoms="Normal fetal movements reported" if v_num > 1 else "Morning sickness managed",
                examination_notes="Uterus relaxed, fetal heart sounds audible and regular.",
                investigation_details="Urine Albumin/Sugar: Nil. Rapid Malaria/Syphilis: Negative.",
                risk_status="High Risk" if is_hr_calc else "Normal",
                advice="Nutritious diet with greens, IFA tablets daily at bedtime, institutional delivery.",
                status="Completed",
            ))

        for tmpl in DEMO_MATERNAL_VACCINE_TEMPLATES:
            due = lmp_date + dt.timedelta(weeks=tmpl["weeks_offset"])
            gw = gest["gestational_weeks"]
            if gw > tmpl["weeks_offset"] + 2:
                status_val = "Completed" if (i + tmpl["weeks_offset"]) % 3 != 0 else "Overdue"
            elif gw >= tmpl["weeks_offset"] - 1:
                status_val = "Due"
            else:
                status_val = "Upcoming"
            session.add(MaternalImmunization(
                id=f"MAT-IMM-{p_id}-{tmpl['vaccine_name'][:4].strip()}",
                pregnancy_id=p_id, health_worker_id=worker_id,
                vaccine_name=tmpl["vaccine_name"], dose=tmpl["dose"],
                description=tmpl["description"], recommended_date=due, due_date=due,
                administration_date=due if status_val == "Completed" else None,
                batch_number=f"BATCH-MCH-{202600 + i}" if status_val == "Completed" else "",
                status=status_val,
                remarks=("Administered at PHC clinic" if status_val == "Completed"
                         else "Scheduled on Village Health & Nutrition Day (VHND)"),
            ))
        await session.flush()

    # 3. Children + child immunizations
    for j, (c_name, gender, days_old, b_weight) in enumerate(CHILDREN):
        c_id = f"CHD-2026-{2000 + j}"
        if await session.get(Child, c_id):
            continue
        b_id = f"BEN-2026-{500 + j}"
        dob_date = today - dt.timedelta(days=days_old)
        village = MOTHERS[j % len(MOTHERS)][3]
        worker_id = _worker_for(village)

        session.add(Child(
            id=c_id, child_id=f"CHILD-MCH-{7000 + j}", beneficiary_id=b_id,
            health_worker_id=worker_id, child_name=c_name, gender=gender,
            dob=dob_date, birth_weight=b_weight,
            place_of_birth="PHC Hospital Rampur" if j % 2 == 0 else "District Hospital",
            address=f"Ward {(j % 5) + 1}, {village}", village=village,
            block="Rampur Block", district="Siddharthnagar",
        ))
        await session.flush()

        for tmpl in DEMO_CHILD_VACCINE_TEMPLATES:
            due = dob_date + dt.timedelta(days=tmpl["days_offset"])
            if days_old > tmpl["days_offset"] + 14:
                v_status = "Completed" if (j + tmpl["days_offset"]) % 5 != 0 else "Overdue"
            elif days_old >= tmpl["days_offset"] - 5:
                v_status = "Due"
            else:
                v_status = "Upcoming"
            session.add(ChildImmunization(
                id=f"CHD-IMM-{c_id}-{tmpl['vaccine_code']}", child_id=c_id,
                health_worker_id=worker_id, vaccine_code=tmpl["vaccine_code"],
                vaccine_name=tmpl["vaccine_name"], target_age_label=tmpl["target_age_label"],
                recommended_due_date=due,
                administered_date=due if v_status == "Completed" else None,
                route=tmpl.get("route", "Intramuscular"), status=v_status,
                batch_no=f"CHD-VAC-26{100 + j}" if v_status == "Completed" else "",
                adverse_event_reported=False,
                remarks=("Administered without adverse reaction" if v_status == "Completed"
                         else "Scheduled on Routine Immunization Day"),
            ))
        await session.flush()

    # 4. Notifications
    notifs = [
        dict(id="NOTIF-001", title="Monthly Routine Immunization Day (RI Day)",
             message="Scheduled for tomorrow at Sub-Centre Rampur. Ensure all cold chain carrier boxes and vaccine stocks are verified.",
             priority="HIGH", category="IMMUNIZATION",
             beneficiary_name="All Sector A Beneficiaries", is_read=False,
             target_user_id=None, created_at=now),
        dict(id="NOTIF-002", title="High Risk Follow-up: Sunita Devi & Geeta Patel",
             message="Immediate blood pressure check and hemoglobin repeat advised by Medical Officer.",
             priority="CRITICAL", category="HIGH_RISK",
             beneficiary_name="Sunita Devi, Geeta Patel", is_read=False,
             target_user_id="USR-HW-001", created_at=now - dt.timedelta(hours=4)),
        dict(id="NOTIF-003", title="Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)",
             message="Special ANC clinic on the 9th of every month. Organize transport for 2nd and 3rd trimester mothers.",
             priority="MEDIUM", category="CAMPAIGN",
             beneficiary_name="All Pregnant Women", is_read=True,
             target_user_id=None, created_at=now - dt.timedelta(days=2)),
    ]
    for n in notifs:
        if not await session.get(Notification, n["id"]):
            session.add(Notification(**n))
    await session.flush()

    # 5. Build the alert table once
    await alert_svc.full_sweep(session)
    await session.commit()
    logger.info("Seeding complete.")
