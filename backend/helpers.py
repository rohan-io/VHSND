"""Pure, DB-free computation helpers shared by the routes and the serializers."""

import datetime as dt
import logging
from typing import Optional, Union

import bcrypt

logger = logging.getLogger("mch_backend")

DateLike = Union[str, dt.date, dt.datetime, None]

_BCRYPT_MAX_BYTES = 72  # bcrypt hard limit; longer inputs are truncated (as passlib did)


def hash_password(password: str) -> str:
    pw = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        pw = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
        return bcrypt.checkpw(pw, hashed.encode("utf-8"))
    except Exception:
        return False


def parse_date(value: DateLike) -> Optional[dt.date]:
    """Best-effort parse of the date shapes the old Mongo layer accepted."""
    if value is None:
        return None
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S"):
        try:
            return dt.datetime.strptime(s[:10], "%Y-%m-%d").date()
        except Exception:
            continue
    return None


def fmt_date(value: Optional[dt.date]) -> Optional[str]:
    """date -> 'YYYY-MM-DD' (matches what the Mongo layer returned)."""
    if value is None:
        return None
    if isinstance(value, dt.datetime):
        value = value.date()
    return value.strftime("%Y-%m-%d")


def fmt_ts(value: Optional[dt.datetime]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def as_float(value) -> Optional[float]:
    return float(value) if value is not None else None


def age_label(days_old: int) -> str:
    return (
        f"{days_old // 30} Months {days_old % 30} Days"
        if days_old >= 30
        else f"{days_old} Days"
    )


def calculate_gestational_info(lmp: DateLike) -> dict:
    """Gestational weeks/days, EDD, trimester, days-to-EDD from an LMP date."""
    lmp_d = parse_date(lmp)
    try:
        if lmp_d is None:
            raise ValueError("no LMP")
        today = dt.date.today()
        total_days = max(0, (today - lmp_d).days)
        weeks, days = divmod(total_days, 7)
        edd = lmp_d + dt.timedelta(days=280)
        trimester = 1 if weeks <= 12 else 2 if weeks <= 27 else 3
        return {
            "gestational_weeks": weeks,
            "gestational_days": days,
            "gestational_age_label": f"{weeks} Weeks {days} Days",
            "edd": edd.strftime("%Y-%m-%d"),
            "edd_date": edd,
            "trimester": trimester,
            "days_to_edd": (edd - today).days,
        }
    except Exception as e:  # noqa: BLE001 - mirror old lenient behaviour
        logger.error(f"Error calculating gestational info: {e}")
        edd = dt.date.today() + dt.timedelta(days=280)
        return {
            "gestational_weeks": 0,
            "gestational_days": 0,
            "gestational_age_label": "0 Weeks",
            "edd": edd.strftime("%Y-%m-%d"),
            "edd_date": edd,
            "trimester": 1,
            "days_to_edd": 280,
        }


def assess_high_risk(data: dict) -> tuple[bool, list[str]]:
    """Clinical high-risk evaluation. `data` is a plain dict of pregnancy fields."""
    reasons: list[str] = []
    age = data.get("age") or 25
    if age < 18:
        reasons.append("Adolescent pregnancy (Age < 18)")
    elif age >= 35:
        reasons.append("Advanced maternal age (Age >= 35)")

    bp_sys = data.get("bp_systolic") or 120
    bp_dia = data.get("bp_diastolic") or 80
    if bp_sys >= 140 or bp_dia >= 90:
        reasons.append(f"Pregnancy Induced Hypertension (BP {bp_sys}/{bp_dia} mmHg)")

    hb = data.get("hemoglobin")
    if hb is not None:
        try:
            hb_val = float(hb)
            if hb_val < 7.0:
                reasons.append(f"Severe Anemia (Hb {hb_val} g/dL)")
            elif hb_val < 9.0:
                reasons.append(f"Moderate Anemia (Hb {hb_val} g/dL)")
        except (TypeError, ValueError):
            pass

    if (data.get("gravida") or 1) >= 5:
        reasons.append("Grand Multipara (Gravida >= 5)")

    history = str(data.get("previous_pregnancy_history", "")).lower()
    if any(k in history for k in ("eclampsia", "cesarean", "c-section", "stillbirth", "miscarriage", "bleeding")):
        reasons.append(f"Obstetric complication history: {data.get('previous_pregnancy_history')}")

    conditions = str(data.get("existing_conditions", "")).lower()
    if any(k in conditions for k in ("diabetes", "thyroid", "heart", "hiv", "asthma")):
        reasons.append(f"Pre-existing condition: {data.get('existing_conditions')}")

    is_high_risk = len(reasons) > 0 or bool(data.get("is_high_risk", False))
    return is_high_risk, reasons


# ---- Standard demo schedules (unchanged from the Mongo version) --------------

DEMO_MATERNAL_VACCINE_TEMPLATES = [
    {"vaccine_name": "TT-1 (Tetanus Toxoid 1)", "weeks_offset": 12, "dose": "0.5 ml IM", "description": "Early in pregnancy (1st Trimester)"},
    {"vaccine_name": "TT-2 (Tetanus Toxoid 2)", "weeks_offset": 16, "dose": "0.5 ml IM", "description": "4 weeks after TT-1"},
    {"vaccine_name": "TT Booster", "weeks_offset": 20, "dose": "0.5 ml IM", "description": "If received 2 TT in last 3 years"},
    {"vaccine_name": "IFA Supplementation (180 Tab)", "weeks_offset": 14, "dose": "1 Tab Daily", "description": "Iron Folic Acid from 2nd Trimester"},
    {"vaccine_name": "Calcium & Vit D3 (360 Tab)", "weeks_offset": 14, "dose": "2 Tab Daily", "description": "Calcium supplementation from 14 weeks"},
    {"vaccine_name": "Albendazole (Deworming)", "weeks_offset": 24, "dose": "400 mg single", "description": "Single dose after 1st Trimester"},
]

DEMO_CHILD_VACCINE_TEMPLATES = [
    {"vaccine_code": "BCG", "vaccine_name": "BCG (Bacillus Calmette-Guerin)", "target_age_label": "At Birth", "days_offset": 0, "route": "Intradermal"},
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
    {"vaccine_code": "OPV-B", "vaccine_name": "OPV Booster", "target_age_label": "16-24 Months", "days_offset": 480, "route": "Oral"},
]
