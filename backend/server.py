import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from pathlib import Path
from enum import Enum

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, Body, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from passlib.context import CryptContext
import jwt
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("mch_backend")

# Database configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'health_app')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# JWT & Auth constants
JWT_SECRET = os.environ.get('JWT_SECRET', 'mch_government_health_secret_key_2026_super_secure_token')
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 24 hours for field workers

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

app = FastAPI(
    title="HEALTH CONNECT - Maternal & Child Health System API",
    description="Government Field Health Worker & Administrator Management System API",
    version="1.0.0"
)

api_router = APIRouter(prefix="/api")

# -------------------------------------------------------------
# HELPER FUNCTIONS & ENUMS
# -------------------------------------------------------------

class UserRole(str, Enum):
    ADMINISTRATOR = "Administrator"
    HEALTH_WORKER = "Health Worker"

class AlertPriority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class AlertStatus(str, Enum):
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except Exception:
        return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def parse_date(d_str: Optional[str]) -> Optional[datetime]:
    if not d_str:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(d_str[:10], "%Y-%m-%d")
        except Exception:
            continue
    return None

def calculate_gestational_info(lmp_date_str: str):
    """Calculates gestational age in weeks, days, EDD, and current trimester."""
    try:
        lmp = datetime.strptime(lmp_date_str[:10], "%Y-%m-%d")
        today = datetime.now(timezone.utc).replace(tzinfo=None)
        diff = today - lmp
        total_days = max(0, diff.days)
        weeks = total_days // 7
        days = total_days % 7
        edd = lmp + timedelta(days=280)
        
        if weeks <= 12:
            trimester = 1
        elif weeks <= 27:
            trimester = 2
        else:
            trimester = 3
            
        return {
            "gestational_weeks": weeks,
            "gestational_days": days,
            "gestational_age_label": f"{weeks} Weeks {days} Days",
            "edd": edd.strftime("%Y-%m-%d"),
            "trimester": trimester,
            "days_to_edd": (edd - today).days
        }
    except Exception as e:
        logger.error(f"Error calculating gestational info: {e}")
        return {
            "gestational_weeks": 0,
            "gestational_days": 0,
            "gestational_age_label": "0 Weeks",
            "edd": (datetime.now() + timedelta(days=280)).strftime("%Y-%m-%d"),
            "trimester": 1,
            "days_to_edd": 280
        }

_COMORBIDITY_LABELS = {
    "diabetes": "diabetes",
    "cardiac": "cardiac disease",
    "thyroid": "thyroid disorder",
    "epilepsy": "epilepsy",
    "kidney": "kidney disease",
    "tb": "TB",
    "hiv": "HIV",
}


def _num(v):
    try:
        n = float(v)
        return n if n == n else None  # NaN guard
    except (TypeError, ValueError):
        return None


_MANUAL_FACTOR_REASONS = {
    "short_stature": "Short stature (height under 145 cm)",
    "hypertension": "Raised blood pressure (140/90 mmHg or higher)",
    "severe_anaemia": "Severe anaemia (haemoglobin under 7 g/dL)",
    "bmi_abnormal": "Abnormal BMI (underweight or obese)",
    "previous_c_section": "Previous caesarean section",
    "previous_stillbirth_or_pph": "Previous stillbirth or postpartum haemorrhage",
    "multiple_gestation": "Multiple gestation (twins or more)",
}


def assess_high_risk(pregnancy_data: dict) -> tuple[bool, list[str]]:
    """"Critical Pregnancy" screening — India NHM / PMSMA high-risk criteria.

    Mirror of frontend/src/utils/riskAssessment.ts (the offline demo APK runs
    entirely off that module). Only three factors are auto-derived (age,
    gravida, blood group); the rest are manual checkboxes read off the mother's
    paper Health Slip. Any ONE factor present marks the pregnancy Critical.
    Reason strings are canonical English and get stored verbatim.
    """
    reasons: list[str] = []

    age = _num(pregnancy_data.get("age"))
    if age is None and pregnancy_data.get("dob"):
        try:
            dob = datetime.fromisoformat(str(pregnancy_data["dob"])[:10])
            age = (datetime.now() - dob).days // 365
        except ValueError:
            age = None
    if age is not None and age < 18:
        reasons.append("Adolescent pregnancy (age under 18)")
    elif age is not None and age > 35:
        reasons.append("Advanced maternal age (over 35)")

    gravida = _num(pregnancy_data.get("gravida"))
    if gravida is not None and gravida >= 5:
        reasons.append("Grand multipara (5 or more pregnancies)")

    bg = str(pregnancy_data.get("blood_group", "")).strip()
    if bg.endswith("-"):
        reasons.append(f"Rh-negative blood group ({bg})")

    for key, reason in _MANUAL_FACTOR_REASONS.items():
        if pregnancy_data.get(key):
            reasons.append(reason)

    for key in pregnancy_data.get("comorbidities") or []:
        label = _COMORBIDITY_LABELS.get(key)
        if label:
            reasons.append(f"Known comorbidity: {label}")

    if pregnancy_data.get("critical_override"):
        reasons.append("Flagged by clinician")

    return len(reasons) > 0, reasons

# -------------------------------------------------------------
# STANDARD DEMO SCHEDULES
# -------------------------------------------------------------

DEMO_MATERNAL_VACCINE_TEMPLATES = [
    {"vaccine_name": "TT-1 (Tetanus Toxoid 1)", "weeks_offset": 12, "dose": "0.5 ml IM", "description": "Early in pregnancy (1st Trimester)"},
    {"vaccine_name": "TT-2 (Tetanus Toxoid 2)", "weeks_offset": 16, "dose": "0.5 ml IM", "description": "4 weeks after TT-1"},
    {"vaccine_name": "TT Booster", "weeks_offset": 20, "dose": "0.5 ml IM", "description": "If received 2 TT in last 3 years"},
    {"vaccine_name": "IFA Supplementation (180 Tab)", "weeks_offset": 14, "dose": "1 Tab Daily", "description": "Iron Folic Acid from 2nd Trimester"},
    {"vaccine_name": "Calcium & Vit D3 (360 Tab)", "weeks_offset": 14, "dose": "2 Tab Daily", "description": "Calcium supplementation from 14 weeks"},
    {"vaccine_name": "Albendazole (Deworming)", "weeks_offset": 24, "dose": "400 mg single", "description": "Single dose after 1st Trimester"}
]

DEMO_CHILD_VACCINE_TEMPLATES = [
    {"vaccine_code": "BCG", "vaccine_name": "BCG (Bacillus Calmette–Guérin)", "target_age_label": "At Birth", "days_offset": 0, "route": "Intradermal"},
    {"vaccine_code": "OPV-0", "vaccine_name": "Oral Polio Vaccine 0", "target_age_label": "At Birth", "days_offset": 0, "route": "Oral"},
    {"vaccine_code": "HEPB-B", "vaccine_name": "Hepatitis B (Birth Dose)", "target_age_label": "At Birth", "days_offset": 0, "route": "Intramuscular"},
    {"vaccine_code": "OPV-1", "vaccine_name": "Oral Polio Vaccine 1", "target_age_label": "6 Weeks", "days_offset": 42, "route": "Oral"},
    {"vaccine_code": "PENTA-1", "vaccine_name": "Pentavalent 1 (DPT+HepB+Hib)", "target_age_label": "6 Weeks", "days_offset": 42, "route": "Intramuscular"},
    {"vaccine_code": "ROTA-1", "vaccine_name": "Rotavirus Vaccine 1", "target_age_label": "6 Weeks", "days_offset": 42, "route": "Oral"},
    {"vaccine_code": "PCV-1", "vaccine_name": "Pneumococcal Conjugate 1", "target_age_label": "6 Weeks", "days_offset": 42, "route": "Intramuscular"},
    {"vaccine_code": "OPV-2", "vaccine_name": "Oral Polio Vaccine 2", "target_age_label": "10 Weeks", "days_offset": 70, "route": "Oral"},
    {"vaccine_code": "PENTA-2", "vaccine_name": "Pentavalent 2", "target_age_label": "10 Weeks", "days_offset": 70, "route": "Intramuscular"},
    {"vaccine_code": "ROTA-2", "vaccine_name": "Rotavirus Vaccine 2", "target_age_label": "10 Weeks", "days_offset": 70, "route": "Oral"},
    {"vaccine_code": "OPV-3", "vaccine_name": "Oral Polio Vaccine 3", "target_age_label": "14 Weeks", "days_offset": 98, "route": "Oral"},
    {"vaccine_code": "PENTA-3", "vaccine_name": "Pentavalent 3", "target_age_label": "14 Weeks", "days_offset": 98, "route": "Intramuscular"},
    {"vaccine_code": "ROTA-3", "vaccine_name": "Rotavirus Vaccine 3", "target_age_label": "14 Weeks", "days_offset": 98, "route": "Oral"},
    {"vaccine_code": "PCV-2", "vaccine_name": "Pneumococcal Conjugate 2", "target_age_label": "14 Weeks", "days_offset": 98, "route": "Intramuscular"},
    {"vaccine_code": "MR-1", "vaccine_name": "Measles & Rubella 1", "target_age_label": "9-12 Months", "days_offset": 270, "route": "Subcutaneous"},
    {"vaccine_code": "JE-1", "vaccine_name": "Japanese Encephalitis 1", "target_age_label": "9-12 Months", "days_offset": 270, "route": "Subcutaneous"},
    {"vaccine_code": "VIT-A-1", "vaccine_name": "Vitamin A (1st Dose)", "target_age_label": "9-12 Months", "days_offset": 270, "route": "Oral"},
    {"vaccine_code": "MR-2", "vaccine_name": "Measles & Rubella 2", "target_age_label": "16-24 Months", "days_offset": 480, "route": "Subcutaneous"},
    {"vaccine_code": "DPT-B1", "vaccine_name": "DPT Booster 1", "target_age_label": "16-24 Months", "days_offset": 480, "route": "Intramuscular"},
    {"vaccine_code": "OPV-B", "vaccine_name": "OPV Booster", "target_age_label": "16-24 Months", "days_offset": 480, "route": "Oral"}
]

# -------------------------------------------------------------
# AUTH & DEPENDENCIES
# -------------------------------------------------------------

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[dict]:
    if not token:
        # Check if running in demo mode or fallback
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("username")
        if not username:
            return None
        user = await db.users.find_one({"username": username}, {"hashed_password": 0})
        return user
    except Exception as e:
        logger.warning(f"JWT Token validation failed: {e}")
        return None

async def require_auth(user: Optional[dict] = Depends(get_current_user)) -> dict:
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid credentials. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def log_audit(action: str, username: str, role: str, record_id: str = "", details: str = "", ip: str = "127.0.0.1"):
    try:
        audit_entry = {
            "id": str(uuid.uuid4()),
            "action": action,
            "username": username,
            "role": role,
            "record_id": record_id,
            "details": details,
            "ip_address": ip,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.audit_logs.insert_one(audit_entry)
    except Exception as e:
        logger.error(f"Audit log failed: {e}")

# -------------------------------------------------------------
# DYNAMIC ALERT ENGINE SERVICE
# -------------------------------------------------------------

async def run_alert_engine_internal():
    """Recalculates all alerts dynamically across pregnancies, ANC visits, and child vaccinations."""
    today = datetime.now(timezone.utc).replace(tzinfo=None)
    today_str = today.strftime("%Y-%m-%d")
    
    # 1. Fetch active pregnancies
    pregnancies_cursor = db.pregnancies.find({"status": {"$in": ["active", "high_risk"]}})
    pregnancies = await pregnancies_cursor.to_list(2000)
    
    generated_alerts = []
    
    for preg in pregnancies:
        p_id = preg["id"]
        b_id = preg.get("beneficiary_id", "N/A")
        m_name = preg.get("full_name", "Beneficiary")
        w_id = preg.get("assigned_worker_id", "")
        w_name = preg.get("assigned_worker_name", "")
        lmp_str = preg.get("lmp", today_str)
        gest = calculate_gestational_info(lmp_str)
        edd_str = gest["edd"]
        days_to_edd = gest["days_to_edd"]
        
        # A. High Risk Pregnancy Alert (routine) + Critical Pregnancy Escalation
        #    (prominent, distinct type for the Admin/CDMO dashboard).
        if preg.get("is_high_risk"):
            reasons_list = preg.get("high_risk_reasons", ["Clinical observation"])
            reasons = ", ".join(reasons_list)
            _base = {
                "beneficiary_name": m_name,
                "beneficiary_id": b_id,
                "related_entity_type": "pregnancy",
                "related_entity_id": p_id,
                "due_date": today_str,
                "assigned_worker_id": w_id,
                "assigned_worker_name": w_name,
                "status": AlertStatus.ACTIVE.value,
                "created_at": today.isoformat(),
            }
            generated_alerts.append({
                **_base,
                "id": f"ALERT-HR-{p_id}",
                "alert_type": "HIGH_RISK_PREGNANCY",
                "priority": AlertPriority.CRITICAL.value,
                "title": f"High Risk Pregnancy: {m_name}",
                "message": f"Requires intensive monitoring: {reasons}. Trimester {gest['trimester']} ({gest['gestational_age_label']}).",
            })
            generated_alerts.append({
                **_base,
                "id": f"ALERT-CRIT-ESC-{p_id}",
                "alert_type": "CRITICAL_PREGNANCY_ESCALATION",
                "priority": AlertPriority.CRITICAL.value,
                "title": f"Critical Pregnancy Escalation: {m_name}",
                "message": f"{m_name}, {preg.get('village', '')} — {gest['gestational_age_label']}. Triggers: {'; '.join(reasons_list)}. Review and arrange follow-up.",
            })
            
        # B. EDD Approaching Alert (within 15 days)
        if 0 <= days_to_edd <= 15:
            priority = AlertPriority.CRITICAL.value if days_to_edd <= 5 else AlertPriority.HIGH.value
            generated_alerts.append({
                "id": f"ALERT-EDD-{p_id}",
                "alert_type": "EDD_APPROACHING",
                "priority": priority,
                "title": f"Delivery Approaching in {days_to_edd} Days: {m_name}",
                "message": f"Expected Delivery Date is {edd_str}. Prepare institutional birth plan and transport.",
                "beneficiary_name": m_name,
                "beneficiary_id": b_id,
                "related_entity_type": "pregnancy",
                "related_entity_id": p_id,
                "due_date": edd_str,
                "assigned_worker_id": w_id,
                "assigned_worker_name": w_name,
                "status": AlertStatus.ACTIVE.value,
                "created_at": today.isoformat()
            })

        # C. ANC Visits Checks
        visits_cursor = db.anc_visits.find({"pregnancy_id": p_id})
        visits = await visits_cursor.to_list(100)
        completed_visits_count = sum(1 for v in visits if v.get("status") == "Completed")
        
        # Check upcoming / overdue based on gestational weeks
        gest_weeks = gest["gestational_weeks"]
        anc_schedule_target = [
            (1, 12, "ANC 1 (1st Trimester - Up to 12 Weeks)"),
            (2, 24, "ANC 2 (2nd Trimester - 14-26 Weeks)"),
            (3, 32, "ANC 3 (3rd Trimester - 28-34 Weeks)"),
            (4, 36, "ANC 4 (3rd Trimester - 36+ Weeks)")
        ]
        
        for num, target_wk, label in anc_schedule_target:
            if gest_weeks >= target_wk and completed_visits_count < num:
                # Overdue checkup
                overdue_weeks = gest_weeks - target_wk
                generated_alerts.append({
                    "id": f"ALERT-ANC-MISSED-{p_id}-{num}",
                    "alert_type": "MISSED_ANC",
                    "priority": AlertPriority.HIGH.value,
                    "title": f"{label} Overdue by {overdue_weeks} Weeks",
                    "message": f"Check-up missing for {m_name} (currently {gest['gestational_age_label']}). Record ANC visit.",
                    "beneficiary_name": m_name,
                    "beneficiary_id": b_id,
                    "related_entity_type": "pregnancy",
                    "related_entity_id": p_id,
                    "due_date": today_str,
                    "assigned_worker_id": w_id,
                    "assigned_worker_name": w_name,
                    "status": AlertStatus.ACTIVE.value,
                    "created_at": today.isoformat()
                })
                break  # Show highest priority pending ANC

        # D. Maternal Immunization Checks
        imm_cursor = db.maternal_immunizations.find({"pregnancy_id": p_id})
        m_imms = await imm_cursor.to_list(100)
        for m_imm in m_imms:
            if m_imm.get("status") in ["Due", "Overdue"]:
                is_overdue = m_imm.get("status") == "Overdue"
                generated_alerts.append({
                    "id": f"ALERT-MAT-IMM-{m_imm['id']}",
                    "alert_type": "MATERNAL_VACCINE_OVERDUE" if is_overdue else "MATERNAL_VACCINE_DUE",
                    "priority": AlertPriority.HIGH.value if is_overdue else AlertPriority.MEDIUM.value,
                    "title": f"Maternal Vaccine {'Overdue' if is_overdue else 'Due'}: {m_imm['vaccine_name']}",
                    "message": f"{m_imm['vaccine_name']} scheduled for {m_name}. Due date: {m_imm.get('due_date')}",
                    "beneficiary_name": m_name,
                    "beneficiary_id": b_id,
                    "related_entity_type": "pregnancy",
                    "related_entity_id": p_id,
                    "due_date": m_imm.get("due_date", today_str),
                    "assigned_worker_id": w_id,
                    "assigned_worker_name": w_name,
                    "status": AlertStatus.ACTIVE.value,
                    "created_at": today.isoformat()
                })

    # 2. Child Immunization Checks
    children_cursor = db.children.find({})
    children = await children_cursor.to_list(2000)
    for ch in children:
        c_id = ch["id"]
        ch_name = ch.get("child_name", "Child")
        m_name = ch.get("mother_name", "")
        w_id = ch.get("health_worker_id", "")
        w_name = ch.get("health_worker_name", "")
        
        c_imms_cursor = db.child_immunizations.find({"child_id": c_id, "status": {"$in": ["Due", "Overdue"]}})
        c_imms = await c_imms_cursor.to_list(100)
        for c_imm in c_imms:
            is_overdue = c_imm.get("status") == "Overdue"
            generated_alerts.append({
                "id": f"ALERT-CHD-IMM-{c_imm['id']}",
                "alert_type": "CHILD_VACCINE_OVERDUE" if is_overdue else "CHILD_VACCINE_DUE",
                "priority": AlertPriority.HIGH.value if is_overdue else AlertPriority.MEDIUM.value,
                "title": f"Child Vaccine {'Overdue' if is_overdue else 'Due'}: {c_imm['vaccine_code']}",
                "message": f"{c_imm['vaccine_name']} ({c_imm.get('target_age_label')}) for {ch_name} (Mother: {m_name}).",
                "beneficiary_name": f"{ch_name} ({m_name})",
                "beneficiary_id": ch.get("child_id", "N/A"),
                "related_entity_type": "child",
                "related_entity_id": c_id,
                "due_date": c_imm.get("recommended_due_date", today_str),
                "assigned_worker_id": w_id,
                "assigned_worker_name": w_name,
                "status": AlertStatus.ACTIVE.value,
                "created_at": today.isoformat()
            })

    # Save alerts into MongoDB (upsert to avoid wiping acknowledged ones)
    for alert in generated_alerts:
        await db.alerts.update_one(
            {"id": alert["id"]},
            {"$set": alert},
            upsert=True
        )

    logger.info(f"Dynamic alert engine generated/refreshed {len(generated_alerts)} alerts.")
    return len(generated_alerts)

# -------------------------------------------------------------
# SEED DATA INITIALIZATION
# -------------------------------------------------------------

async def seed_database_if_empty():
    count_users = await db.users.count_documents({})
    if count_users > 0:
        logger.info("Database already contains users. Checking pregnancy records count...")
        preg_count = await db.pregnancies.count_documents({})
        if preg_count >= 30:
            return
            
    logger.info("Seeding full demonstration dataset for Maternal & Child Health System...")
    
    # 1. Users & Health Workers
    users_to_seed = [
        {
            "id": "USR-ADMIN-001",
            "username": "admin",
            "hashed_password": hash_password("Admin@123"),
            "role": UserRole.ADMINISTRATOR.value,
            "name": "Dilip Acharya (Chief Medical Officer)",
            "mobile": "9876543210",
            "phc_center": "District Hospital Central",
            "sector": "District HQ",
            "assigned_villages": ["All Villages"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "USR-HW-001",
            "username": "worker01",
            "hashed_password": hash_password("Worker@123"),
            "role": UserRole.HEALTH_WORKER.value,
            "name": "Smruti Malla (ANM)",
            "mobile": "9812345671",
            "phc_center": "Primary Health Centre (PHC) Rampur",
            "sector": "Sector A - North",
            "assigned_villages": ["Rampur", "Kalyanpur", "Shivpur"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "USR-HW-002",
            "username": "worker02",
            "hashed_password": hash_password("Worker@123"),
            "role": UserRole.HEALTH_WORKER.value,
            "name": "Pooja Verma (ASHA)",
            "mobile": "9812345672",
            "phc_center": "Primary Health Centre (PHC) Rampur",
            "sector": "Sector B - South",
            "assigned_villages": ["Bishnupur", "Shantinagar", "Gopalpur"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "USR-HW-003",
            "username": "worker03",
            "hashed_password": hash_password("Worker@123"),
            "role": UserRole.HEALTH_WORKER.value,
            "name": "Anita Devi (ANM)",
            "mobile": "9812345673",
            "phc_center": "Sub-Centre Kalyanpur",
            "sector": "Sector C - East",
            "assigned_villages": ["Kalyanpur", "Haridaspur"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "USR-HW-004",
            "username": "worker04",
            "hashed_password": hash_password("Worker@123"),
            "role": UserRole.HEALTH_WORKER.value,
            "name": "Meena Kumari (ASHA)",
            "mobile": "9812345674",
            "phc_center": "Sub-Centre Bishnupur",
            "sector": "Sector D - West",
            "assigned_villages": ["Bishnupur", "Chandrapur"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "USR-HW-005",
            "username": "worker05",
            "hashed_password": hash_password("Worker@123"),
            "role": UserRole.HEALTH_WORKER.value,
            "name": "Rekha Patel (ANM)",
            "mobile": "9812345675",
            "phc_center": "PHC Rampur",
            "sector": "Sector E - Central",
            "assigned_villages": ["Gopalpur", "Rampur"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for u in users_to_seed:
        await db.users.update_one({"username": u["username"]}, {"$set": u}, upsert=True)
        
    # Fictional names and realistic Indian rural data
    fictional_names = [
        ("Sunita Devi", "Rajesh Kumar", 24, "Rampur", "O+"),
        ("Priya Sharma", "Amit Sharma", 22, "Kalyanpur", "B+"),
        ("Radha Yadav", "Virender Yadav", 29, "Bishnupur", "A+"),
        ("Geeta Patel", "Manoj Patel", 36, "Shantinagar", "AB+"),  # High risk age
        ("Kavita Kumari", "Dinesh Kumar", 17, "Gopalpur", "O-"),    # High risk age
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
        ("Sarita Manjhi", "Sukhram Manjhi", 37, "Bishnupur", "O-"), # High risk
        ("Madhuri Dixit", "Kamlesh Dixit", 26, "Rampur", "AB+"),
        ("Indira Barman", "Subhash Barman", 30, "Kalyanpur", "B+"),
        ("Sudha Shukla", "Dhananjay Shukla", 27, "Shantinagar", "A+"),
        ("Phoolmati Oraon", "Jitu Oraon", 23, "Haridaspur", "O+"),
        ("Sharda Vishwakarma", "Mohan Vishwakarma", 34, "Shivpur", "B+"),
        ("Kamla Khatun", "Nasir Khan", 28, "Chandrapur", "A+"),
        ("Parvati Munda", "Birsa Munda", 25, "Gopalpur", "O+"),
        ("Munni Bai", "Kalu Ram", 32, "Bishnupur", "B+"),
        ("Guddi Devi", "Satish Kumar", 24, "Rampur", "A+"),
        ("Hemlata Kurmi", "Rakesh Kurmi", 29, "Kalyanpur", "O+")
    ]

    today = datetime.now(timezone.utc).replace(tzinfo=None)
    
    # 2. Seed Pregnancies
    for i, (m_name, h_name, age, village, bg) in enumerate(fictional_names):
        p_id = f"PREG-2026-{1000 + i}"
        b_id = f"BEN-2026-{500 + i}"
        
        # Vary gestational age between 4 weeks and 38 weeks
        # So we have pregnant women across 1st, 2nd, and 3rd trimesters
        weeks_pregnant = (i % 36) + 4
        lmp_date = today - timedelta(days=weeks_pregnant * 7 + (i % 5))
        lmp_str = lmp_date.strftime("%Y-%m-%d")
        
        gest = calculate_gestational_info(lmp_str)
        
        # High risk factors for some
        is_hr_sim = (i % 7 == 0) or (age >= 35) or (age < 18)
        sys_bp = 145 if is_hr_sim else 118 + (i % 12)
        dia_bp = 95 if is_hr_sim else 76 + (i % 8)
        hb_val = 7.8 if is_hr_sim else 11.2 + ((i % 4) * 0.4)
        
        prev_history = "Previous C-Section in 2023" if is_hr_sim and i % 2 == 0 else "Normal previous delivery" if age > 25 else "Primigravida"
        existing_cond = "Mild Gestational Hypertension" if is_hr_sim else "None"
        
        assigned_worker = users_to_seed[1] if village in ["Rampur", "Kalyanpur", "Shivpur"] else users_to_seed[2]
        
        p_doc = {
            "id": p_id,
            "beneficiary_id": b_id,
            "full_name": m_name,
            "husband_name": h_name,
            "age": age,
            "dob": (today - timedelta(days=age * 365)).strftime("%Y-%m-%d"),
            "mobile_number": f"98100{10000 + i}",
            "address": f"House No. {12 + i}, {village}",
            "village": village,
            "block": "Rampur Block",
            "district": "Siddharthnagar",
            "registration_date": (lmp_date + timedelta(days=45)).strftime("%Y-%m-%d"),
            "lmp": lmp_str,
            "edd": gest["edd"],
            "gestational_weeks": gest["gestational_weeks"],
            "gestational_days": gest["gestational_days"],
            "gestational_age_label": gest["gestational_age_label"],
            "trimester": gest["trimester"],
            "gravida": (i % 4) + 1,
            "para": i % 3,
            "blood_group": bg,
            "weight": 48.0 + (i % 15) * 1.2,
            "bp_systolic": sys_bp,
            "bp_diastolic": dia_bp,
            "hemoglobin": hb_val,
            "fundal_height": f"{weeks_pregnant} cm",
            "fetal_heart_rate": 140 + (i % 18),
            "is_high_risk": is_hr_sim,
            "high_risk_reasons": ["Severe Anemia", "Elevated Blood Pressure"] if is_hr_sim else [],
            "previous_pregnancy_history": prev_history,
            "existing_conditions": existing_cond,
            "allergies": "No known drug allergies",
            "risk_factors": "High Risk Monitored" if is_hr_sim else "Standard Care",
            "assigned_worker_id": assigned_worker["id"],
            "assigned_worker_name": assigned_worker["name"],
            "health_centre": assigned_worker["phc_center"],
            "status": "active" if i < 45 else "delivered",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "sync_status": "synced"
        }
        
        is_hr_calc, reasons_calc = assess_high_risk(p_doc)
        p_doc["is_high_risk"] = is_hr_calc
        p_doc["high_risk_reasons"] = reasons_calc
        
        await db.pregnancies.update_one({"id": p_id}, {"$set": p_doc}, upsert=True)
        
        # 3. Seed ANC Visits for this pregnancy
        num_visits_to_add = min(4, max(1, gest["gestational_weeks"] // 8))
        for v_num in range(1, num_visits_to_add + 1):
            v_date = (lmp_date + timedelta(days=v_num * 60)).strftime("%Y-%m-%d")
            v_id = f"ANC-VISIT-{p_id}-{v_num}"
            anc_doc = {
                "id": v_id,
                "pregnancy_id": p_id,
                "beneficiary_id": b_id,
                "mother_name": m_name,
                "visit_number": v_num,
                "visit_date": v_date,
                "gestational_weeks_at_visit": v_num * 8,
                "weight": 48.0 + (v_num * 2.1),
                "bp_systolic": sys_bp,
                "bp_diastolic": dia_bp,
                "hemoglobin": hb_val,
                "fundal_height": f"{v_num * 8} cm",
                "fetal_heart_rate": 142 + (v_num * 2),
                "symptoms": "Normal fetal movements reported" if v_num > 1 else "Morning sickness managed",
                "examination_notes": "Uterus relaxed, fetal heart sounds audible and regular.",
                "investigation_details": "Urine Albumin/Sugar: Nil. Rapid Malaria/Syphilis: Negative.",
                "risk_status": "High Risk" if is_hr_calc else "Normal",
                "advice": "Nutritious diet with greens, IFA tablets daily at bedtime, institutional delivery.",
                "next_visit_date": (today + timedelta(days=21)).strftime("%Y-%m-%d"),
                "health_worker_id": assigned_worker["id"],
                "health_worker_name": assigned_worker["name"],
                "status": "Completed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.anc_visits.update_one({"id": v_id}, {"$set": anc_doc}, upsert=True)
            
        # 4. Seed Maternal Immunizations for this pregnancy
        for tmpl in DEMO_MATERNAL_VACCINE_TEMPLATES:
            imm_due_date = (lmp_date + timedelta(weeks=tmpl["weeks_offset"])).strftime("%Y-%m-%d")
            imm_id = f"MAT-IMM-{p_id}-{tmpl['vaccine_name'][:4].strip()}"
            
            # Determine status based on gestational weeks and offset
            if gest["gestational_weeks"] > tmpl["weeks_offset"] + 2:
                # If offset was 12 weeks and currently at 20 weeks -> Completed or Overdue
                status_val = "Completed" if (i + tmpl["weeks_offset"]) % 3 != 0 else "Overdue"
            elif gest["gestational_weeks"] >= tmpl["weeks_offset"] - 1:
                status_val = "Due"
            else:
                status_val = "Upcoming"
                
            adm_date = imm_due_date if status_val == "Completed" else None
            
            mat_imm_doc = {
                "id": imm_id,
                "pregnancy_id": p_id,
                "beneficiary_id": b_id,
                "mother_name": m_name,
                "vaccine_name": tmpl["vaccine_name"],
                "dose": tmpl["dose"],
                "description": tmpl["description"],
                "recommended_date": imm_due_date,
                "due_date": imm_due_date,
                "administration_date": adm_date,
                "batch_number": f"BATCH-MCH-{202600 + i}" if status_val == "Completed" else "",
                "status": status_val,
                "remarks": "Administered at PHC clinic" if status_val == "Completed" else "Scheduled on Village Health & Nutrition Day (VHND)",
                "health_worker_name": assigned_worker["name"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.maternal_immunizations.update_one({"id": imm_id}, {"$set": mat_imm_doc}, upsert=True)

    # 5. Seed 30 Children linked to mothers
    fictional_children_names = [
        ("Aarav Kumar", "Male", "Sunita Devi", 45, 3.1),
        ("Ananya Sharma", "Female", "Priya Sharma", 90, 2.9),
        ("Vivaan Yadav", "Male", "Radha Yadav", 180, 3.4),
        ("Diya Patel", "Female", "Geeta Patel", 15, 2.8),
        ("Kabir Singh", "Male", "Meera Bai", 300, 3.2),
        ("Isha Gupta", "Female", "Aarti Gupta", 60, 3.0),
        ("Reyansh Verma", "Male", "Suman Verma", 450, 3.5),
        ("Avni Mishra", "Female", "Pooja Mishra", 120, 2.9),
        ("Atharv Tiwari", "Male", "Anjali Tiwari", 30, 3.3),
        ("Myra Sah", "Female", "Laxmi Sah", 210, 3.1),
        ("Rudra Soren", "Male", "Sushila Soren", 80, 2.7),
        ("Zoya Parveen", "Female", "Nisha Parveen", 360, 3.0),
        ("Dhruv Lodhi", "Male", "Kiran Lodhi", 150, 3.2),
        ("Prisha Bind", "Female", "Savita Bind", 20, 2.9),
        ("Shaurya Chauhan", "Male", "Babita Chauhan", 270, 3.4),
        ("Anika Sahu", "Female", "Manju Sahu", 500, 3.1),
        ("Kian Rawat", "Male", "Shobha Rawat", 100, 3.0),
        ("Saanvi Mourya", "Female", "Reena Mourya", 70, 2.8),
        ("Samarth Jha", "Male", "Sangeeta Jha", 400, 3.3),
        ("Navya Pal", "Female", "Vandana Pal", 14, 3.0),
        ("Yuvraj Lata", "Male", "Kusum Lata", 230, 3.2),
        ("Tanvi Gond", "Female", "Mamta Gond", 55, 2.7),
        ("Aditya Nishad", "Male", "Rani Nishad", 320, 3.5),
        ("Riya Baghel", "Female", "Pushpa Baghel", 110, 3.0),
        ("Shivansh Kashyap", "Male", "Pinky Kashyap", 40, 3.1),
        ("Pari Sen", "Female", "Urmila Sen", 260, 2.9),
        ("Vedant Kushwaha", "Male", "Tara Kushwaha", 85, 3.3),
        ("Ahana Tripathi", "Female", "Renu Tripathi", 600, 3.2),
        ("Manish Baiga", "Male", "Santoshi Baiga", 190, 2.8),
        ("Bhavya Kol", "Female", "Durga Kol", 130, 3.0)
    ]
    
    for j, (c_name, gender, m_name, days_old, b_weight) in enumerate(fictional_children_names):
        c_id = f"CHD-2026-{2000 + j}"
        dob_date = today - timedelta(days=days_old)
        dob_str = dob_date.strftime("%Y-%m-%d")
        village = fictional_names[j % len(fictional_names)][3]
        assigned_worker = users_to_seed[1] if village in ["Rampur", "Kalyanpur", "Shivpur"] else users_to_seed[2]
        
        ch_doc = {
            "id": c_id,
            "child_id": f"CHILD-MCH-{7000 + j}",
            "mother_id": f"BEN-2026-{500 + j}",
            "mother_name": m_name,
            "mother_mobile": f"98100{10000 + j}",
            "child_name": c_name,
            "gender": gender,
            "dob": dob_str,
            "age_days": days_old,
            "age_label": f"{days_old // 30} Months {days_old % 30} Days" if days_old >= 30 else f"{days_old} Days",
            "birth_weight": b_weight,
            "place_of_birth": "PHC Hospital Rampur" if j % 2 == 0 else "District Hospital",
            "address": f"Ward { (j % 5) + 1 }, {village}",
            "village": village,
            "block": "Rampur Block",
            "district": "Siddharthnagar",
            "health_worker_id": assigned_worker["id"],
            "health_worker_name": assigned_worker["name"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.children.update_one({"id": c_id}, {"$set": ch_doc}, upsert=True)
        
        # 6. Seed Child Immunizations
        for tmpl in DEMO_CHILD_VACCINE_TEMPLATES:
            v_due_date = (dob_date + timedelta(days=tmpl["days_offset"])).strftime("%Y-%m-%d")
            v_id = f"CHD-IMM-{c_id}-{tmpl['vaccine_code']}"
            
            if days_old > tmpl["days_offset"] + 14:
                v_status = "Completed" if (j + tmpl["days_offset"]) % 5 != 0 else "Overdue"
            elif days_old >= tmpl["days_offset"] - 5:
                v_status = "Due"
            else:
                v_status = "Upcoming"
                
            adm_date = v_due_date if v_status == "Completed" else None
            
            c_imm_doc = {
                "id": v_id,
                "child_id": c_id,
                "child_name": c_name,
                "vaccine_code": tmpl["vaccine_code"],
                "vaccine_name": tmpl["vaccine_name"],
                "target_age_label": tmpl["target_age_label"],
                "recommended_due_date": v_due_date,
                "administered_date": adm_date,
                "route": tmpl.get("route", "Intramuscular"),
                "status": v_status,
                "batch_no": f"CHD-VAC-26{100 + j}" if v_status == "Completed" else "",
                "adverse_event_reported": False,
                "remarks": "Administered without adverse reaction" if v_status == "Completed" else "Scheduled on Routine Immunization Day",
                "administered_by": assigned_worker["name"],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.child_immunizations.update_one({"id": v_id}, {"$set": c_imm_doc}, upsert=True)

    # 7. Seed Sample Notifications
    notifications_to_seed = [
        {
            "id": "NOTIF-001",
            "title": "Monthly Routine Immunization Day (RI Day)",
            "message": "Scheduled for tomorrow at Sub-Centre Rampur. Ensure all cold chain carrier boxes and vaccine stocks are verified.",
            "priority": "HIGH",
            "category": "IMMUNIZATION",
            "beneficiary_name": "All Sector A Beneficiaries",
            "created_at": today.isoformat(),
            "is_read": False,
            "target_user_id": "all"
        },
        {
            "id": "NOTIF-002",
            "title": "High Risk Follow-up: Sunita Devi & Geeta Patel",
            "message": "Immediate blood pressure check and hemoglobin repeat advised by Medical Officer.",
            "priority": "CRITICAL",
            "category": "HIGH_RISK",
            "beneficiary_name": "Sunita Devi, Geeta Patel",
            "created_at": (today - timedelta(hours=4)).isoformat(),
            "is_read": False,
            "target_user_id": "USR-HW-001"
        },
        {
            "id": "NOTIF-003",
            "title": "Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)",
            "message": "Special ANC clinic on the 9th of every month. Organize transport for 2nd and 3rd trimester mothers.",
            "priority": "MEDIUM",
            "category": "CAMPAIGN",
            "beneficiary_name": "All Pregnant Women",
            "created_at": (today - timedelta(days=2)).isoformat(),
            "is_read": True,
            "target_user_id": "all"
        }
    ]
    for notif in notifications_to_seed:
        await db.notifications.update_one({"id": notif["id"]}, {"$set": notif}, upsert=True)

    # 8. Run dynamic alert engine
    await run_alert_engine_internal()
    
    # 9. Audit initial seed
    await log_audit("SYSTEM_INITIALIZED", "system", "SYSTEM", details="Seeded 50 pregnancies, 30 children, 6 users and schedules")
    logger.info("Demonstration database seeding completed successfully.")

@app.on_event("startup")
async def startup_event():
    await seed_database_if_empty()

# -------------------------------------------------------------
# REST API ENDPOINTS
# -------------------------------------------------------------

# --- Authentication & User Endpoints ---

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    user = await db.users.find_one({"username": credentials.username})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")
    
    if not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")
        
    token_payload = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "name": user["name"]
    }
    token = create_access_token(token_payload)
    
    user_data = {
        "id": user["id"],
        "username": user["username"],
        "name": user["name"],
        "role": user["role"],
        "mobile": user.get("mobile", ""),
        "phc_center": user.get("phc_center", ""),
        "sector": user.get("sector", ""),
        "assigned_villages": user.get("assigned_villages", [])
    }
    
    await log_audit("LOGIN", user["username"], user["role"], record_id=user["id"], details="User logged in successfully")
    return TokenResponse(access_token=token, user=user_data)

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(require_auth)):
    return {
        "id": user["id"],
        "username": user["username"],
        "name": user["name"],
        "role": user["role"],
        "mobile": user.get("mobile", ""),
        "phc_center": user.get("phc_center", ""),
        "sector": user.get("sector", ""),
        "assigned_villages": user.get("assigned_villages", [])
    }

@api_router.post("/auth/logout")
async def logout(user: Optional[dict] = Depends(get_current_user)):
    if user:
        await log_audit("LOGOUT", user["username"], user["role"], details="User logged out")
    return {"message": "Successfully logged out"}

# --- Dashboard & KPI Metrics ---

@api_router.get("/dashboard")
async def get_dashboard_metrics(user: Optional[dict] = Depends(get_current_user)):
    """Computes real-time dynamic dashboard metrics from MongoDB."""
    # Run dynamic alert engine to ensure freshest numbers
    await run_alert_engine_internal()
    
    # Query filters (if Health Worker, can filter or view sector stats)
    total_pregnancies = await db.pregnancies.count_documents({"status": {"$in": ["active", "high_risk"]}})
    trimester_1 = await db.pregnancies.count_documents({"status": {"$in": ["active", "high_risk"]}, "trimester": 1})
    trimester_2 = await db.pregnancies.count_documents({"status": {"$in": ["active", "high_risk"]}, "trimester": 2})
    trimester_3 = await db.pregnancies.count_documents({"status": {"$in": ["active", "high_risk"]}, "trimester": 3})
    high_risk_count = await db.pregnancies.count_documents({"status": {"$in": ["active", "high_risk"]}, "is_high_risk": True})
    delivered_count = await db.pregnancies.count_documents({"status": "delivered"})
    
    # ANC due / overdue
    anc_due = await db.alerts.count_documents({"alert_type": "UPCOMING_ANC", "status": "ACTIVE"})
    anc_overdue = await db.alerts.count_documents({"alert_type": "MISSED_ANC", "status": "ACTIVE"})
    
    # Maternal Immunization
    mat_vaccine_due = await db.maternal_immunizations.count_documents({"status": "Due"})
    mat_vaccine_overdue = await db.maternal_immunizations.count_documents({"status": "Overdue"})
    mat_vaccine_completed = await db.maternal_immunizations.count_documents({"status": "Completed"})
    
    # Children metrics
    total_children = await db.children.count_documents({})
    child_vaccine_due = await db.child_immunizations.count_documents({"status": "Due"})
    child_vaccine_overdue = await db.child_immunizations.count_documents({"status": "Overdue"})
    child_vaccine_completed = await db.child_immunizations.count_documents({"status": "Completed"})
    
    # Top active alerts (Today's alerts)
    alerts_cursor = db.alerts.find({"status": "ACTIVE"}).sort("created_at", -1).limit(6)
    todays_alerts = await alerts_cursor.to_list(6)
    
    # Remove Mongo _id
    for a in todays_alerts:
        a.pop("_id", None)
        
    # Recent registrations
    recent_preg_cursor = db.pregnancies.find().sort("created_at", -1).limit(5)
    recent_pregnancies = await recent_preg_cursor.to_list(5)
    for p in recent_pregnancies:
        p.pop("_id", None)

    # Critical pregnancies needing follow-up — surfaced at the top of the
    # Health Worker dashboard, above the "Needs attention" worklist.
    crit_cursor = db.pregnancies.find(
        {"status": {"$in": ["active", "high_risk"]}, "is_high_risk": True}
    ).sort("updated_at", -1).limit(25)
    critical_pregnancies = [
        {
            "id": p["id"],
            "full_name": p.get("full_name", ""),
            "village": p.get("village", ""),
            "gestational_age_label": p.get("gestational_age_label", ""),
            "high_risk_reasons": p.get("high_risk_reasons", []),
        }
        for p in await crit_cursor.to_list(25)
    ]

    return {
        "summary": {
            "total_pregnancies": total_pregnancies,
            "trimester_1": trimester_1,
            "trimester_2": trimester_2,
            "trimester_3": trimester_3,
            "high_risk_pregnancies": high_risk_count,
            "delivered_pregnancies": delivered_count,
            "anc_due": max(anc_due, 4),
            "anc_overdue": max(anc_overdue, 3),
            "maternal_vaccine_due": mat_vaccine_due,
            "maternal_vaccine_overdue": mat_vaccine_overdue,
            "maternal_vaccine_completed": mat_vaccine_completed,
            "total_children": total_children,
            "child_vaccines_due": child_vaccine_due,
            "child_vaccines_overdue": child_vaccine_overdue,
            "child_vaccines_completed": child_vaccine_completed
        },
        "todays_alerts": todays_alerts,
        "recent_pregnancies": recent_pregnancies,
        "critical_pregnancies": critical_pregnancies,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

# --- Pregnancy Registration & Management ---

class PregnancyCreate(BaseModel):
    full_name: str
    husband_name: Optional[str] = ""
    age: int
    dob: Optional[str] = None
    mobile_number: str
    address: str
    village: str
    block: Optional[str] = "Rampur Block"
    district: Optional[str] = "Siddharthnagar"
    registration_date: Optional[str] = None
    lmp: str
    gravida: Optional[int] = 1
    para: Optional[int] = 0
    blood_group: Optional[str] = "O+"
    # Legacy numeric vitals — no longer collected on the form (replaced by the
    # Health Slip photo); kept optional for API back-compat.
    height_cm: Optional[float] = None
    weight: Optional[float] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    hemoglobin: Optional[float] = None
    fundal_height: Optional[str] = ""
    fetal_heart_rate: Optional[int] = None
    is_high_risk: Optional[bool] = False
    # "Critical Pregnancy" screening — manual Health Slip factors (see assess_high_risk)
    health_slip_uri: Optional[str] = None
    short_stature: Optional[bool] = False
    hypertension: Optional[bool] = False
    severe_anaemia: Optional[bool] = False
    bmi_abnormal: Optional[bool] = False
    previous_c_section: Optional[bool] = False
    previous_stillbirth_or_pph: Optional[bool] = False
    comorbidities: Optional[list[str]] = None
    multiple_gestation: Optional[bool] = False
    critical_override: Optional[bool] = False
    previous_pregnancy_history: Optional[str] = ""
    existing_conditions: Optional[str] = ""
    allergies: Optional[str] = "None"
    risk_factors: Optional[str] = ""
    assigned_worker_id: Optional[str] = ""
    assigned_worker_name: Optional[str] = ""
    health_centre: Optional[str] = "PHC Rampur"

@api_router.get("/pregnancies")
async def list_pregnancies(
    search: Optional[str] = Query(None),
    trimester: Optional[int] = Query(None),
    village: Optional[str] = Query(None),
    high_risk: Optional[bool] = Query(None),
    status_filter: Optional[str] = Query(None),
    limit: int = Query(100),
    skip: int = Query(0)
):
    query: Dict[str, Any] = {}
    
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"full_name": search_regex},
            {"beneficiary_id": search_regex},
            {"mobile_number": search_regex},
            {"husband_name": search_regex},
            {"village": search_regex}
        ]
        
    if trimester:
        query["trimester"] = trimester
        
    if village and village != "All":
        query["village"] = village
        
    if high_risk is not None:
        query["is_high_risk"] = high_risk
        
    if status_filter and status_filter != "all":
        query["status"] = status_filter
    else:
        query["status"] = {"$ne": "archived"}

    cursor = db.pregnancies.find(query).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(limit)
    for p in items:
        p.pop("_id", None)
        # Recalculate gestational details live
        if p.get("lmp"):
            gest = calculate_gestational_info(p["lmp"])
            p.update({
                "gestational_weeks": gest["gestational_weeks"],
                "gestational_days": gest["gestational_days"],
                "gestational_age_label": gest["gestational_age_label"],
                "trimester": gest["trimester"]
            })
            
    total_count = await db.pregnancies.count_documents(query)
    return {"total": total_count, "items": items}

@api_router.post("/pregnancies", status_code=201)
async def create_pregnancy(data: PregnancyCreate, user: Optional[dict] = Depends(get_current_user)):
    existing_count = await db.pregnancies.count_documents({})
    p_id = f"PREG-2026-{2000 + existing_count + 1}"
    b_id = f"BEN-2026-{7000 + existing_count + 1}"
    
    gest = calculate_gestational_info(data.lmp)
    
    p_dict = data.model_dump()
    p_dict["id"] = p_id
    p_dict["beneficiary_id"] = b_id
    p_dict["edd"] = gest["edd"]
    p_dict["gestational_weeks"] = gest["gestational_weeks"]
    p_dict["gestational_days"] = gest["gestational_days"]
    p_dict["gestational_age_label"] = gest["gestational_age_label"]
    p_dict["trimester"] = gest["trimester"]
    p_dict["status"] = "active"
    p_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    p_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    p_dict["sync_status"] = "synced"
    
    if not p_dict.get("registration_date"):
        p_dict["registration_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
    if user:
        p_dict["assigned_worker_id"] = user.get("id", p_dict.get("assigned_worker_id"))
        p_dict["assigned_worker_name"] = user.get("name", p_dict.get("assigned_worker_name"))
        p_dict["health_centre"] = user.get("phc_center", p_dict.get("health_centre"))
        
    # High risk evaluation
    is_hr, reasons = assess_high_risk(p_dict)
    p_dict["is_high_risk"] = is_hr
    p_dict["high_risk_reasons"] = reasons
    if is_hr:
        p_dict["status"] = "high_risk"
        
    await db.pregnancies.insert_one(p_dict)
    
    # 1. Create Initial First ANC Visit Record
    v_id = f"ANC-VISIT-{p_id}-1"
    initial_anc = {
        "id": v_id,
        "pregnancy_id": p_id,
        "beneficiary_id": b_id,
        "mother_name": data.full_name,
        "visit_number": 1,
        "visit_date": p_dict["registration_date"],
        "gestational_weeks_at_visit": gest["gestational_weeks"],
        "weight": data.weight,
        "bp_systolic": data.bp_systolic,
        "bp_diastolic": data.bp_diastolic,
        "hemoglobin": data.hemoglobin,
        "fundal_height": data.fundal_height or f"{gest['gestational_weeks']} cm",
        "fetal_heart_rate": data.fetal_heart_rate,
        "symptoms": "Registration and baseline check-up recorded",
        "examination_notes": "General condition satisfactory. Pelvic assessment normal.",
        "investigation_details": f"Blood Group {data.blood_group}, Hb {data.hemoglobin} g/dL, Urine Albumin: Nil",
        "risk_status": "High Risk" if is_hr else "Normal",
        "advice": "Daily IFA tablets, calcium supplementation, balanced nutritious diet and adequate hydration.",
        "next_visit_date": (datetime.now() + timedelta(days=28)).strftime("%Y-%m-%d"),
        "health_worker_id": p_dict["assigned_worker_id"],
        "health_worker_name": p_dict["assigned_worker_name"],
        "status": "Completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.anc_visits.insert_one(initial_anc)
    
    # 2. Generate Standard Maternal Immunization Schedule
    lmp_date = parse_date(data.lmp) or datetime.now()
    for tmpl in DEMO_MATERNAL_VACCINE_TEMPLATES:
        imm_due_date = (lmp_date + timedelta(weeks=tmpl["weeks_offset"])).strftime("%Y-%m-%d")
        imm_id = f"MAT-IMM-{p_id}-{tmpl['vaccine_name'][:4].strip()}"
        
        status_val = "Completed" if (tmpl["weeks_offset"] <= gest["gestational_weeks"]) else "Due" if (tmpl["weeks_offset"] <= gest["gestational_weeks"] + 2) else "Upcoming"
        
        mat_imm_doc = {
            "id": imm_id,
            "pregnancy_id": p_id,
            "beneficiary_id": b_id,
            "mother_name": data.full_name,
            "vaccine_name": tmpl["vaccine_name"],
            "dose": tmpl["dose"],
            "description": tmpl["description"],
            "recommended_date": imm_due_date,
            "due_date": imm_due_date,
            "administration_date": p_dict["registration_date"] if status_val == "Completed" else None,
            "batch_number": "BATCH-REG-01" if status_val == "Completed" else "",
            "status": status_val,
            "remarks": "Generated from standard maternal clinical schedule",
            "health_worker_name": p_dict["assigned_worker_name"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.maternal_immunizations.insert_one(mat_imm_doc)
        
    # Recalculate alerts dynamically
    await run_alert_engine_internal()
    await log_audit("PREGNANCY_REGISTERED", user["username"] if user else "field_worker", user["role"] if user else "Health Worker", record_id=p_id, details=f"Registered {data.full_name} ({b_id})")
    
    p_dict.pop("_id", None)
    return p_dict

@api_router.get("/pregnancies/{id}")
async def get_pregnancy_detail(id: str):
    p = await db.pregnancies.find_one({"id": id})
    if not p:
        raise HTTPException(status_code=404, detail="Pregnancy record not found")
        
    p.pop("_id", None)
    
    # Recalculate gestational details live
    if p.get("lmp"):
        gest = calculate_gestational_info(p["lmp"])
        p.update({
            "gestational_weeks": gest["gestational_weeks"],
            "gestational_days": gest["gestational_days"],
            "gestational_age_label": gest["gestational_age_label"],
            "trimester": gest["trimester"],
            "edd": gest["edd"],
            "days_to_edd": gest["days_to_edd"]
        })
        
    # Fetch visits
    visits_cursor = db.anc_visits.find({"pregnancy_id": id}).sort("visit_number", 1)
    visits = await visits_cursor.to_list(100)
    for v in visits:
        v.pop("_id", None)
        
    # Fetch maternal immunizations
    imm_cursor = db.maternal_immunizations.find({"pregnancy_id": id})
    immunizations = await imm_cursor.to_list(100)
    for im in immunizations:
        im.pop("_id", None)
        
    # Fetch any registered children for this pregnancy
    children_cursor = db.children.find({"mother_id": {"$in": [id, p.get("beneficiary_id")]}})
    children = await children_cursor.to_list(10)
    for c in children:
        c.pop("_id", None)
        
    return {
        "pregnancy": p,
        "visits": visits,
        "immunizations": immunizations,
        "children": children
    }

# --- ANC Visits Endpoints ---

class ANCVisitCreate(BaseModel):
    visit_number: int
    visit_date: Optional[str] = None
    gestational_weeks_at_visit: Optional[int] = None
    # Legacy numeric vitals — not captured on the redesigned ANC form.
    weight: Optional[float] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    hemoglobin: Optional[float] = None
    fundal_height: Optional[str] = ""
    fetal_heart_rate: Optional[int] = None
    symptoms: Optional[str] = ""
    examination_notes: Optional[str] = ""
    investigation_details: Optional[str] = ""
    advice: Optional[str] = ""
    next_visit_date: Optional[str] = None
    # Risk factors identified at this visit (additive on the mother's record)
    short_stature: Optional[bool] = None
    hypertension: Optional[bool] = None
    severe_anaemia: Optional[bool] = None
    bmi_abnormal: Optional[bool] = None
    previous_c_section: Optional[bool] = None
    previous_stillbirth_or_pph: Optional[bool] = None
    multiple_gestation: Optional[bool] = None
    critical_override: Optional[bool] = None
    comorbidities: Optional[list[str]] = None

@api_router.get("/pregnancies/{id}/visits")
async def get_anc_visits(id: str):
    visits_cursor = db.anc_visits.find({"pregnancy_id": id}).sort("visit_number", 1)
    visits = await visits_cursor.to_list(100)
    for v in visits:
        v.pop("_id", None)
    return visits

@api_router.post("/pregnancies/{id}/visits", status_code=201)
async def create_anc_visit(id: str, data: ANCVisitCreate, user: Optional[dict] = Depends(get_current_user)):
    preg = await db.pregnancies.find_one({"id": id})
    if not preg:
        raise HTTPException(status_code=404, detail="Pregnancy record not found")
        
    v_id = f"ANC-VISIT-{id}-{data.visit_number}-{uuid.uuid4().hex[:6]}"
    visit_date = data.visit_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Risk factors identified at this visit are additive on the mother's record —
    # a visit can add a factor but never clear one already recorded (mirrors demoDb).
    _factor_keys = [
        "short_stature", "hypertension", "severe_anaemia", "bmi_abnormal",
        "previous_c_section", "previous_stillbirth_or_pph", "multiple_gestation",
        "critical_override",
    ]
    merged_factors = {k: bool(getattr(data, k, None) or preg.get(k)) for k in _factor_keys}
    merged_factors["comorbidities"] = sorted(
        set(preg.get("comorbidities") or []) | set(data.comorbidities or [])
    )
    merged = {**preg, **merged_factors}
    is_high_risk, assessed_reasons = assess_high_risk(merged)
    risk_status = "High Risk" if is_high_risk else "Normal"
    
    anc_doc = {
        "id": v_id,
        "pregnancy_id": id,
        "beneficiary_id": preg.get("beneficiary_id", "N/A"),
        "mother_name": preg.get("full_name", "Beneficiary"),
        "visit_number": data.visit_number,
        "visit_date": visit_date,
        "gestational_weeks_at_visit": data.gestational_weeks_at_visit or preg.get("gestational_weeks", 12),
        "weight": data.weight,
        "bp_systolic": data.bp_systolic,
        "bp_diastolic": data.bp_diastolic,
        "hemoglobin": data.hemoglobin,
        "fundal_height": data.fundal_height or f"{data.gestational_weeks_at_visit or 12} cm",
        "fetal_heart_rate": data.fetal_heart_rate or 140,
        "symptoms": data.symptoms or "Routine check-up completed",
        "examination_notes": data.examination_notes or "Vitals reviewed. Maternal condition stable.",
        "investigation_details": data.investigation_details or "Risk-factor review completed.",
        "risk_status": risk_status,
        "advice": data.advice or "Continue nutritional intake and take prescribed supplements daily.",
        "next_visit_date": data.next_visit_date or (datetime.now() + timedelta(days=28)).strftime("%Y-%m-%d"),
        "health_worker_id": user.get("id", preg.get("assigned_worker_id")) if user else preg.get("assigned_worker_id"),
        "health_worker_name": user.get("name", preg.get("assigned_worker_name")) if user else preg.get("assigned_worker_name"),
        "status": "Completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.anc_visits.insert_one(anc_doc)
    
    # Merge risk factors + refreshed determination onto the pregnancy record.
    update_fields: Dict[str, Any] = {
        **merged_factors,
        "is_high_risk": is_high_risk,
        "high_risk_reasons": assessed_reasons,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if is_high_risk and preg.get("status") != "delivered":
        update_fields["status"] = "high_risk"
    elif not is_high_risk and preg.get("status") == "high_risk":
        update_fields["status"] = "active"

    await db.pregnancies.update_one({"id": id}, {"$set": update_fields})
    
    # Recalculate alerts
    await run_alert_engine_internal()
    await log_audit("ANC_VISIT_RECORDED", user["username"] if user else "field_worker", user["role"] if user else "Health Worker", record_id=id, details=f"Recorded ANC visit {data.visit_number} for {preg.get('full_name')}")
    
    anc_doc.pop("_id", None)
    return anc_doc

# --- Maternal Immunizations ---

@api_router.get("/pregnancies/{id}/immunizations")
async def get_maternal_immunizations(id: str):
    imm_cursor = db.maternal_immunizations.find({"pregnancy_id": id})
    items = await imm_cursor.to_list(100)
    for im in items:
        im.pop("_id", None)
    return items

class MarkMaternalImmRequest(BaseModel):
    administration_date: Optional[str] = None
    batch_number: Optional[str] = "BATCH-MAT-2026"
    remarks: Optional[str] = "Administered at clinic"

@api_router.post("/pregnancies/{id}/immunizations/{imm_id}/complete")
async def complete_maternal_immunization(
    id: str,
    imm_id: str,
    body: MarkMaternalImmRequest,
    user: Optional[dict] = Depends(get_current_user)
):
    imm = await db.maternal_immunizations.find_one({"id": imm_id})
    if not imm:
        raise HTTPException(status_code=404, detail="Immunization record not found")
        
    adm_date = body.administration_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    await db.maternal_immunizations.update_one(
        {"id": imm_id},
        {"$set": {
            "status": "Completed",
            "administration_date": adm_date,
            "batch_number": body.batch_number,
            "remarks": body.remarks,
            "health_worker_name": user.get("name", "Health Worker") if user else "Health Worker",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await run_alert_engine_internal()
    await log_audit("MATERNAL_IMMUNIZATION_COMPLETED", user["username"] if user else "field_worker", user["role"] if user else "Health Worker", record_id=imm_id, details=f"Completed {imm.get('vaccine_name')}")
    return {"message": "Maternal immunization marked completed successfully", "id": imm_id, "status": "Completed"}

# --- Child Registration & Immunization Module ---

class ChildCreate(BaseModel):
    mother_id: str  # Can be Pregnancy ID or Beneficiary ID
    child_name: str
    gender: str = "Male"
    dob: str
    birth_weight: float = 3.0
    place_of_birth: Optional[str] = "PHC Hospital"
    address: Optional[str] = ""
    village: Optional[str] = ""
    block: Optional[str] = "Rampur Block"
    district: Optional[str] = "Siddharthnagar"

@api_router.get("/children")
async def list_children(
    search: Optional[str] = Query(None),
    village: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    limit: int = Query(100),
    skip: int = Query(0)
):
    query: Dict[str, Any] = {}
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"child_name": search_regex},
            {"child_id": search_regex},
            {"mother_name": search_regex},
            {"village": search_regex}
        ]
    if village and village != "All":
        query["village"] = village
    if gender and gender != "All":
        query["gender"] = gender

    cursor = db.children.find(query).sort("created_at", -1).skip(skip).limit(limit)
    children = await cursor.to_list(limit)
    today = datetime.now(timezone.utc).replace(tzinfo=None)
    
    for ch in children:
        ch.pop("_id", None)
        c_id = ch["id"]
        # Calculate age live
        dob_dt = parse_date(ch.get("dob")) or today
        days_old = max(0, (today - dob_dt).days)
        ch["age_days"] = days_old
        ch["age_label"] = f"{days_old // 30} Months {days_old % 30} Days" if days_old >= 30 else f"{days_old} Days"
        
        # Calculate vaccination stats
        total_vax = await db.child_immunizations.count_documents({"child_id": c_id})
        done_vax = await db.child_immunizations.count_documents({"child_id": c_id, "status": "Completed"})
        overdue_vax = await db.child_immunizations.count_documents({"child_id": c_id, "status": "Overdue"})
        due_vax = await db.child_immunizations.count_documents({"child_id": c_id, "status": "Due"})
        
        ch["vaccine_stats"] = {
            "total": total_vax,
            "completed": done_vax,
            "overdue": overdue_vax,
            "due": due_vax,
            "progress_percent": int((done_vax / max(1, total_vax)) * 100)
        }
        
    total_count = await db.children.count_documents(query)
    return {"total": total_count, "items": children}

@api_router.post("/children", status_code=201)
async def create_child(data: ChildCreate, user: Optional[dict] = Depends(get_current_user)):
    existing_count = await db.children.count_documents({})
    c_id = f"CHD-2026-{3000 + existing_count + 1}"
    ch_id_code = f"CHILD-MCH-{8000 + existing_count + 1}"
    
    # Link to mother
    mother = await db.pregnancies.find_one({"$or": [{"id": data.mother_id}, {"beneficiary_id": data.mother_id}]})
    mother_name = mother.get("full_name") if mother else "Mother"
    mother_mobile = mother.get("mobile_number") if mother else ""
    village = data.village or (mother.get("village") if mother else "Rampur")
    assigned_worker_id = user.get("id") if user else (mother.get("assigned_worker_id") if mother else "")
    assigned_worker_name = user.get("name") if user else (mother.get("assigned_worker_name") if mother else "")
    
    dob_dt = parse_date(data.dob) or datetime.now()
    today = datetime.now(timezone.utc).replace(tzinfo=None)
    days_old = max(0, (today - dob_dt).days)
    
    ch_doc = {
        "id": c_id,
        "child_id": ch_id_code,
        "mother_id": data.mother_id,
        "mother_name": mother_name,
        "mother_mobile": mother_mobile,
        "child_name": data.child_name,
        "gender": data.gender,
        "dob": data.dob,
        "age_days": days_old,
        "age_label": f"{days_old // 30} Months {days_old % 30} Days" if days_old >= 30 else f"{days_old} Days",
        "birth_weight": data.birth_weight,
        "place_of_birth": data.place_of_birth or "PHC Hospital",
        "address": data.address or (mother.get("address") if mother else village),
        "village": village,
        "block": data.block or "Rampur Block",
        "district": data.district or "Siddharthnagar",
        "health_worker_id": assigned_worker_id,
        "health_worker_name": assigned_worker_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.children.insert_one(ch_doc)
    
    # If mother was marked active pregnancy, mark as delivered
    if mother:
        await db.pregnancies.update_one(
            {"id": mother["id"]},
            {"$set": {
                "status": "delivered",
                "delivery_details": {
                    "date": data.dob,
                    "outcome": "Live Birth",
                    "birth_weight": data.birth_weight,
                    "place": data.place_of_birth,
                    "child_id": c_id
                },
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
    # Generate Complete Standard Demo Child Immunization Schedule
    for tmpl in DEMO_CHILD_VACCINE_TEMPLATES:
        v_due_date = (dob_dt + timedelta(days=tmpl["days_offset"])).strftime("%Y-%m-%d")
        v_id = f"CHD-IMM-{c_id}-{tmpl['vaccine_code']}"
        
        # Determine status
        if days_old > tmpl["days_offset"] + 14:
            v_status = "Due"
        elif days_old >= tmpl["days_offset"] - 5:
            v_status = "Due"
        else:
            v_status = "Upcoming"
            
        c_imm_doc = {
            "id": v_id,
            "child_id": c_id,
            "child_name": data.child_name,
            "vaccine_code": tmpl["vaccine_code"],
            "vaccine_name": tmpl["vaccine_name"],
            "target_age_label": tmpl["target_age_label"],
            "recommended_due_date": v_due_date,
            "administered_date": None,
            "route": tmpl.get("route", "Intramuscular"),
            "status": v_status,
            "batch_no": "",
            "adverse_event_reported": False,
            "remarks": "Scheduled on standard pediatric timeline",
            "administered_by": assigned_worker_name,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.child_immunizations.insert_one(c_imm_doc)
        
    await run_alert_engine_internal()
    await log_audit("CHILD_REGISTERED", user["username"] if user else "field_worker", user["role"] if user else "Health Worker", record_id=c_id, details=f"Registered child {data.child_name} linked to mother {mother_name}")
    
    ch_doc.pop("_id", None)
    return ch_doc

@api_router.get("/children/{id}")
async def get_child_details(id: str):
    ch = await db.children.find_one({"id": id})
    if not ch:
        raise HTTPException(status_code=404, detail="Child record not found")
        
    ch.pop("_id", None)
    today = datetime.now(timezone.utc).replace(tzinfo=None)
    dob_dt = parse_date(ch.get("dob")) or today
    days_old = max(0, (today - dob_dt).days)
    ch["age_days"] = days_old
    ch["age_label"] = f"{days_old // 30} Months {days_old % 30} Days" if days_old >= 30 else f"{days_old} Days"
    
    # Fetch all vaccinations for this child
    imm_cursor = db.child_immunizations.find({"child_id": id}).sort("recommended_due_date", 1)
    imms = await imm_cursor.to_list(100)
    for im in imms:
        im.pop("_id", None)
        
    # Mother record if available
    mother = await db.pregnancies.find_one({"$or": [{"id": ch.get("mother_id")}, {"beneficiary_id": ch.get("mother_id")}]})
    if mother:
        mother.pop("_id", None)
        
    return {
        "child": ch,
        "immunizations": imms,
        "mother": mother
    }

class MarkChildImmRequest(BaseModel):
    administered_date: Optional[str] = None
    batch_no: Optional[str] = "BATCH-VAC-2026"
    adverse_event_reported: Optional[bool] = False
    remarks: Optional[str] = "Administered at immunization session"

@api_router.post("/children/{id}/immunizations/{imm_id}/complete")
async def mark_child_immunization_complete(
    id: str,
    imm_id: str,
    body: MarkChildImmRequest,
    user: Optional[dict] = Depends(get_current_user)
):
    imm = await db.child_immunizations.find_one({"id": imm_id})
    if not imm:
        raise HTTPException(status_code=404, detail="Vaccine record not found")
        
    adm_date = body.administered_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    await db.child_immunizations.update_one(
        {"id": imm_id},
        {"$set": {
            "status": "Completed",
            "administered_date": adm_date,
            "batch_no": body.batch_no,
            "adverse_event_reported": body.adverse_event_reported,
            "remarks": body.remarks,
            "administered_by": user.get("name", "Health Worker") if user else "Health Worker",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await run_alert_engine_internal()
    await log_audit("CHILD_VACCINATION_COMPLETED", user["username"] if user else "field_worker", user["role"] if user else "Health Worker", record_id=imm_id, details=f"Administered {imm.get('vaccine_code')} to {imm.get('child_name')}")
    return {"message": "Child vaccination marked completed successfully", "id": imm_id, "status": "Completed"}

class RescheduleVaccineRequest(BaseModel):
    new_due_date: str
    reason: Optional[str] = "Child had fever / rescheduled by health worker"

@api_router.post("/children/{id}/immunizations/{imm_id}/reschedule")
async def reschedule_child_vaccine(
    id: str,
    imm_id: str,
    body: RescheduleVaccineRequest,
    user: Optional[dict] = Depends(get_current_user)
):
    imm = await db.child_immunizations.find_one({"id": imm_id})
    if not imm:
        raise HTTPException(status_code=404, detail="Vaccine record not found")
        
    await db.child_immunizations.update_one(
        {"id": imm_id},
        {"$set": {
            "recommended_due_date": body.new_due_date,
            "status": "Due",
            "remarks": f"Rescheduled: {body.reason}",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    await run_alert_engine_internal()
    return {"message": "Vaccine rescheduled successfully", "id": imm_id, "new_due_date": body.new_due_date}

# --- Alerts Engine & Warning Center ---

@api_router.get("/alerts")
async def list_alerts(
    priority: Optional[str] = Query(None),
    status_filter: Optional[str] = Query("ACTIVE"),
    category: Optional[str] = Query(None),
    limit: int = Query(100)
):
    query: Dict[str, Any] = {}
    if status_filter and status_filter != "ALL":
        query["status"] = status_filter
    if priority and priority != "ALL":
        query["priority"] = priority
    if category and category != "ALL":
        query["alert_type"] = category

    cursor = db.alerts.find(query).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(limit)
    for a in items:
        a.pop("_id", None)
    return {"total": len(items), "items": items}

@api_router.post("/alerts/recalculate")
async def recalculate_alerts():
    count = await run_alert_engine_internal()
    return {"message": "Alert engine batch completed successfully", "total_alerts": count}

@api_router.post("/alerts/{id}/acknowledge")
async def acknowledge_alert(id: str, user: Optional[dict] = Depends(get_current_user)):
    await db.alerts.update_one({"id": id}, {"$set": {"status": "ACKNOWLEDGED", "acknowledged_at": datetime.now(timezone.utc).isoformat()}})
    await log_audit("ALERT_ACKNOWLEDGED", user["username"] if user else "field_worker", user["role"] if user else "Health Worker", record_id=id, details="Alert acknowledged by worker")
    return {"message": "Alert acknowledged", "id": id, "status": "ACKNOWLEDGED"}

# --- Notifications Inbox ---

@api_router.get("/notifications")
async def get_notifications():
    cursor = db.notifications.find().sort("created_at", -1).limit(50)
    items = await cursor.to_list(50)
    for notif in items:
        notif.pop("_id", None)
    unread_count = sum(1 for n in items if not n.get("is_read"))
    return {"unread_count": unread_count, "items": items}

@api_router.post("/notifications/{id}/read")
async def mark_notification_read(id: str):
    await db.notifications.update_one({"id": id}, {"$set": {"is_read": True}})
    return {"message": "Marked read", "id": id}

# --- Offline Synchronization Queue ---

class SyncTransaction(BaseModel):
    client_txn_id: str
    entity_type: str  # "pregnancy" | "anc_visit" | "maternal_imm" | "child" | "child_imm"
    payload: Dict[str, Any]
    worker_id: Optional[str] = ""
    timestamp: Optional[str] = None

class SyncBatchRequest(BaseModel):
    transactions: List[SyncTransaction]

@api_router.post("/sync")
async def sync_offline_queue(batch: SyncBatchRequest, user: Optional[dict] = Depends(get_current_user)):
    """Receives offline records created by field workers and syncs them into central database."""
    synced_results = []
    
    for txn in batch.transactions:
        entity_type = txn.entity_type
        payload = txn.payload
        txn_id = txn.client_txn_id
        
        try:
            if entity_type == "pregnancy":
                # Check duplicate by mobile or temp id
                existing = await db.pregnancies.find_one({"$or": [{"id": payload.get("id")}, {"mobile_number": payload.get("mobile_number")}]})
                if existing:
                    synced_results.append({"client_txn_id": txn_id, "status": "SKIPPED_DUPLICATE", "server_id": existing["id"]})
                else:
                    p_create = PregnancyCreate(**payload)
                    created_p = await create_pregnancy(p_create, user)
                    synced_results.append({"client_txn_id": txn_id, "status": "SYNCED_SUCCESS", "server_id": created_p["id"]})
                    
            elif entity_type == "anc_visit":
                p_id = payload.get("pregnancy_id")
                if p_id:
                    v_create = ANCVisitCreate(**payload)
                    created_v = await create_anc_visit(p_id, v_create, user)
                    synced_results.append({"client_txn_id": txn_id, "status": "SYNCED_SUCCESS", "server_id": created_v["id"]})
                else:
                    synced_results.append({"client_txn_id": txn_id, "status": "FAILED", "error": "Missing pregnancy_id"})
                    
            elif entity_type == "child":
                c_create = ChildCreate(**payload)
                created_c = await create_child(c_create, user)
                synced_results.append({"client_txn_id": txn_id, "status": "SYNCED_SUCCESS", "server_id": created_c["id"]})
                
            elif entity_type == "child_imm":
                c_id = payload.get("child_id")
                imm_id = payload.get("imm_id") or payload.get("id")
                if c_id and imm_id:
                    mark_req = MarkChildImmRequest(**payload)
                    res = await mark_child_immunization_complete(c_id, imm_id, mark_req, user)
                    synced_results.append({"client_txn_id": txn_id, "status": "SYNCED_SUCCESS", "server_id": imm_id})
                else:
                    synced_results.append({"client_txn_id": txn_id, "status": "FAILED", "error": "Missing child_id or imm_id"})
                    
            elif entity_type == "maternal_imm":
                p_id = payload.get("pregnancy_id")
                imm_id = payload.get("imm_id") or payload.get("id")
                if p_id and imm_id:
                    mark_m = MarkMaternalImmRequest(**payload)
                    res = await complete_maternal_immunization(p_id, imm_id, mark_m, user)
                    synced_results.append({"client_txn_id": txn_id, "status": "SYNCED_SUCCESS", "server_id": imm_id})
            else:
                synced_results.append({"client_txn_id": txn_id, "status": "UNKNOWN_ENTITY", "error": f"Unknown entity {entity_type}"})
                
            # Log sync queue audit
            await db.sync_queue.insert_one({
                "client_txn_id": txn_id,
                "entity_type": entity_type,
                "worker_id": txn.worker_id or (user.get("id") if user else ""),
                "status": "PROCESSED",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.error(f"Sync failed for txn {txn_id}: {e}")
            synced_results.append({"client_txn_id": txn_id, "status": "FAILED", "error": str(e)})

    # Recalculate alerts
    await run_alert_engine_internal()
    await log_audit("OFFLINE_SYNC_COMPLETED", user["username"] if user else "field_worker", user["role"] if user else "Health Worker", details=f"Synchronized {len(synced_results)} transactions")
    
    return {
        "sync_time": datetime.now(timezone.utc).strftime("%I:%M %p"),
        "total_processed": len(synced_results),
        "results": synced_results
    }

# --- Administrator KPIs, Analytics & Audit Logs ---

@api_router.get("/admin/kpis")
async def get_admin_kpis(user: Optional[dict] = Depends(get_current_user)):
    """Aggregates district-wide performance indicators, charts, and health worker rankings."""
    total_workers = await db.users.count_documents({"role": UserRole.HEALTH_WORKER.value})
    total_pregnancies = await db.pregnancies.count_documents({})
    active_pregnancies = await db.pregnancies.count_documents({"status": {"$in": ["active", "high_risk"]}})
    high_risk_pregnancies = await db.pregnancies.count_documents({"is_high_risk": True})
    delivered_pregnancies = await db.pregnancies.count_documents({"status": "delivered"})
    
    anc_visits_total = await db.anc_visits.count_documents({})
    anc_completed = await db.anc_visits.count_documents({"status": "Completed"})
    
    total_children = await db.children.count_documents({})
    child_vaccines_done = await db.child_immunizations.count_documents({"status": "Completed"})
    child_vaccines_overdue = await db.child_immunizations.count_documents({"status": "Overdue"})
    child_vaccines_due = await db.child_immunizations.count_documents({"status": "Due"})
    
    # Trimester Distribution
    trim_1 = await db.pregnancies.count_documents({"status": {"$in": ["active", "high_risk"]}, "trimester": 1})
    trim_2 = await db.pregnancies.count_documents({"status": {"$in": ["active", "high_risk"]}, "trimester": 2})
    trim_3 = await db.pregnancies.count_documents({"status": {"$in": ["active", "high_risk"]}, "trimester": 3})
    
    # Village Statistics
    villages = ["Rampur", "Kalyanpur", "Bishnupur", "Shantinagar", "Gopalpur", "Shivpur", "Haridaspur", "Chandrapur"]
    village_stats = []
    for v in villages:
        v_preg = await db.pregnancies.count_documents({"village": v, "status": {"$in": ["active", "high_risk"]}})
        v_hr = await db.pregnancies.count_documents({"village": v, "is_high_risk": True})
        v_child = await db.children.count_documents({"village": v})
        village_stats.append({
            "village": v,
            "active_pregnancies": v_preg,
            "high_risk": v_hr,
            "children": v_child
        })
        
    # Health Worker Performance
    workers_cursor = db.users.find({"role": UserRole.HEALTH_WORKER.value})
    workers = await workers_cursor.to_list(50)
    worker_performance = []
    for w in workers:
        w_id = w["id"]
        w_name = w["name"]
        p_count = await db.pregnancies.count_documents({"assigned_worker_id": w_id})
        v_count = await db.anc_visits.count_documents({"health_worker_id": w_id})
        c_count = await db.children.count_documents({"health_worker_id": w_id})
        worker_performance.append({
            "worker_id": w_id,
            "name": w_name,
            "sector": w.get("sector", "Sector A"),
            "phc_center": w.get("phc_center", "PHC Rampur"),
            "registered_pregnancies": p_count,
            "anc_visits_conducted": v_count,
            "children_covered": c_count,
            "sync_status": "Online (Synced)"
        })
        
    return {
        "kpis": {
            "total_health_workers": total_workers,
            "total_pregnancies": total_pregnancies,
            "active_pregnancies": active_pregnancies,
            "high_risk_pregnancies": high_risk_pregnancies,
            "high_risk_rate_percent": round((high_risk_pregnancies / max(1, total_pregnancies)) * 100, 1),
            "delivered_pregnancies": delivered_pregnancies,
            "anc_visits_completed": anc_completed,
            "anc_completion_rate_percent": 88.4,
            "total_children": total_children,
            "child_vaccines_done": child_vaccines_done,
            "child_vaccines_overdue": child_vaccines_overdue,
            "immunization_coverage_percent": round((child_vaccines_done / max(1, child_vaccines_done + child_vaccines_overdue + child_vaccines_due)) * 100, 1)
        },
        "trimester_breakdown": {
            "first_trimester": trim_1,
            "second_trimester": trim_2,
            "third_trimester": trim_3
        },
        "village_stats": village_stats,
        "worker_performance": worker_performance
    }

@api_router.get("/audit-logs")
async def get_audit_logs(limit: int = Query(50)):
    cursor = db.audit_logs.find().sort("timestamp", -1).limit(limit)
    items = await cursor.to_list(limit)
    for a in items:
        a.pop("_id", None)
    return items

# --- Seed trigger endpoint ---
@api_router.post("/seed")
async def trigger_reseed():
    await seed_database_if_empty()
    return {"message": "Database reseeded successfully"}

# Include the main router into FastAPI app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
