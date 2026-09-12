"""
Turn ORM rows (with their relationships pre-loaded by the caller) back into the
exact JSON dict shapes the Mongo layer returned, so the frontend sees no change.

Every function assumes the relevant relationships are already loaded
(selectinload / joinedload in the endpoint) — no lazy IO happens here.
"""

from __future__ import annotations

import datetime as dt
from typing import Optional

from helpers import (
    age_label,
    as_float,
    calculate_gestational_info,
    fmt_date,
    fmt_ts,
)
from db.models import (
    Alert,
    AuditLog,
    Beneficiary,
    Child,
    ChildImmunization,
    ANCVisit,
    MaternalImmunization,
    Notification,
    Pregnancy,
    User,
)


# --------------------------------------------------------------------------- #
# users
# --------------------------------------------------------------------------- #

def user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "name": u.name,
        "role": u.role,
        "mobile": u.mobile or "",
        "phc_center": u.phc_center or "",
        "sector": u.sector or "",
        "assigned_villages": list(u.assigned_villages or []),
    }


# --------------------------------------------------------------------------- #
# pregnancies
# --------------------------------------------------------------------------- #

def pregnancy_dict(p: Pregnancy, *, include_days_to_edd: bool = False) -> dict:
    b: Beneficiary = p.beneficiary
    w: Optional[User] = p.worker
    gest = calculate_gestational_info(p.lmp)

    out = {
        "id": p.id,
        "beneficiary_id": p.beneficiary_id,
        "full_name": b.full_name,
        "husband_name": b.husband_name or "",
        "age": b.age,
        "dob": fmt_date(b.dob),
        "mobile_number": b.mobile_number or "",
        "address": b.address or "",
        "village": b.village or "",
        "block": b.block or "",
        "district": b.district or "",
        "registration_date": fmt_date(p.registration_date),
        "lmp": fmt_date(p.lmp),
        "edd": gest["edd"],
        "gestational_weeks": gest["gestational_weeks"],
        "gestational_days": gest["gestational_days"],
        "gestational_age_label": gest["gestational_age_label"],
        "trimester": gest["trimester"],
        "gravida": p.gravida,
        "para": p.para,
        "blood_group": b.blood_group or "",
        "weight": as_float(p.weight),
        "bp_systolic": p.bp_systolic,
        "bp_diastolic": p.bp_diastolic,
        "hemoglobin": as_float(p.hemoglobin),
        "fundal_height": p.fundal_height or "",
        "fetal_heart_rate": p.fetal_heart_rate,
        "is_high_risk": p.is_high_risk,
        "high_risk_reasons": list(p.high_risk_reasons or []),
        "previous_pregnancy_history": p.previous_pregnancy_history or "",
        "existing_conditions": p.existing_conditions or "",
        "allergies": b.allergies or "None",
        "risk_factors": p.risk_factors or "Standard Care",
        "assigned_worker_id": p.assigned_worker_id or "",
        "assigned_worker_name": (w.name if w else "") or "",
        "health_centre": (w.phc_center if w else "") or "",
        "status": p.status,
        "delivery_details": p.delivery_details,
        "created_at": fmt_ts(p.created_at),
        "updated_at": fmt_ts(p.updated_at),
        "sync_status": p.sync_status,
    }
    if include_days_to_edd:
        out["days_to_edd"] = gest["days_to_edd"]
    return out


# --------------------------------------------------------------------------- #
# ANC visits
# --------------------------------------------------------------------------- #

def anc_visit_dict(v: ANCVisit) -> dict:
    p: Pregnancy = v.pregnancy
    w: Optional[User] = v.worker
    return {
        "id": v.id,
        "pregnancy_id": v.pregnancy_id,
        "beneficiary_id": p.beneficiary_id if p else None,
        "mother_name": p.beneficiary.full_name if p and p.beneficiary else None,
        "visit_number": v.visit_number,
        "visit_date": fmt_date(v.visit_date),
        "gestational_weeks_at_visit": v.gestational_weeks_at_visit,
        "weight": as_float(v.weight),
        "bp_systolic": v.bp_systolic,
        "bp_diastolic": v.bp_diastolic,
        "hemoglobin": as_float(v.hemoglobin),
        "fundal_height": v.fundal_height or "",
        "fetal_heart_rate": v.fetal_heart_rate,
        "symptoms": v.symptoms or "",
        "examination_notes": v.examination_notes or "",
        "investigation_details": v.investigation_details or "",
        "risk_status": v.risk_status or "Normal",
        "advice": v.advice or "",
        "next_visit_date": fmt_date(v.next_visit_date),
        "health_worker_id": v.health_worker_id or (p.assigned_worker_id if p else ""),
        "health_worker_name": (w.name if w else "") or "",
        "status": v.status,
        "created_at": fmt_ts(v.created_at),
    }


# --------------------------------------------------------------------------- #
# maternal immunizations
# --------------------------------------------------------------------------- #

def maternal_imm_dict(im: MaternalImmunization) -> dict:
    p: Pregnancy = im.pregnancy
    w: Optional[User] = im.worker
    return {
        "id": im.id,
        "pregnancy_id": im.pregnancy_id,
        "beneficiary_id": p.beneficiary_id if p else None,
        "mother_name": p.beneficiary.full_name if p and p.beneficiary else None,
        "vaccine_name": im.vaccine_name,
        "dose": im.dose or "",
        "description": im.description or "",
        "recommended_date": fmt_date(im.recommended_date),
        "due_date": fmt_date(im.due_date),
        "administration_date": fmt_date(im.administration_date),
        "batch_number": im.batch_number or "",
        "status": im.status,
        "remarks": im.remarks or "",
        "health_worker_name": (w.name if w else "") or "",
    }


# --------------------------------------------------------------------------- #
# children
# --------------------------------------------------------------------------- #

def _child_age(dob: dt.date) -> tuple[int, str]:
    days = max(0, (dt.date.today() - dob).days) if dob else 0
    return days, age_label(days)


def child_dict(c: Child, *, vaccine_stats: Optional[dict] = None) -> dict:
    b: Beneficiary = c.beneficiary
    w: Optional[User] = c.worker
    days_old, label = _child_age(c.dob)
    out = {
        "id": c.id,
        "child_id": c.child_id,
        "mother_id": c.beneficiary_id,
        "mother_name": b.full_name if b else "",
        "mother_mobile": (b.mobile_number if b else "") or "",
        "child_name": c.child_name,
        "gender": c.gender,
        "dob": fmt_date(c.dob),
        "age_days": days_old,
        "age_label": label,
        "birth_weight": as_float(c.birth_weight),
        "place_of_birth": c.place_of_birth or "",
        "address": c.address or "",
        "village": c.village or "",
        "block": c.block or "",
        "district": c.district or "",
        "health_worker_id": c.health_worker_id or "",
        "health_worker_name": (w.name if w else "") or "",
        "created_at": fmt_ts(c.created_at),
        "updated_at": fmt_ts(c.updated_at),
    }
    if vaccine_stats is not None:
        out["vaccine_stats"] = vaccine_stats
    return out


def vaccine_stats(total: int, completed: int, overdue: int, due: int) -> dict:
    return {
        "total": total,
        "completed": completed,
        "overdue": overdue,
        "due": due,
        "progress_percent": int((completed / max(1, total)) * 100),
    }


# --------------------------------------------------------------------------- #
# child immunizations
# --------------------------------------------------------------------------- #

def child_imm_dict(im: ChildImmunization) -> dict:
    w: Optional[User] = im.worker
    return {
        "id": im.id,
        "child_id": im.child_id,
        "child_name": im.child.child_name if im.child else "",
        "vaccine_code": im.vaccine_code,
        "vaccine_name": im.vaccine_name,
        "target_age_label": im.target_age_label or "",
        "recommended_due_date": fmt_date(im.recommended_due_date),
        "administered_date": fmt_date(im.administered_date),
        "route": im.route or "Intramuscular",
        "status": im.status,
        "batch_no": im.batch_no or "",
        "adverse_event_reported": im.adverse_event_reported,
        "remarks": im.remarks or "",
        "administered_by": (w.name if w else "") or "",
    }


# --------------------------------------------------------------------------- #
# alerts
# --------------------------------------------------------------------------- #

def alert_dict(a: Alert) -> dict:
    if a.related_entity_type == "pregnancy":
        p: Pregnancy = a.pregnancy
        beneficiary_name = p.beneficiary.full_name if p and p.beneficiary else ""
        beneficiary_id = p.beneficiary_id if p else ""
        related_entity_id = a.pregnancy_id
    else:
        c: Child = a.child
        m = c.beneficiary.full_name if c and c.beneficiary else ""
        beneficiary_name = f"{c.child_name} ({m})" if c else ""
        beneficiary_id = c.child_id if c else ""
        related_entity_id = a.child_id

    w: Optional[User] = a.worker
    return {
        "id": a.id,
        "alert_type": a.alert_type,
        "priority": a.priority,
        "title": a.title,
        "message": a.message,
        "beneficiary_name": beneficiary_name,
        "beneficiary_id": beneficiary_id,
        "related_entity_type": a.related_entity_type,
        "related_entity_id": related_entity_id,
        "due_date": fmt_date(a.due_date),
        "assigned_worker_id": a.assigned_worker_id or "",
        "assigned_worker_name": (w.name if w else "") or "",
        "status": a.status,
        "created_at": fmt_ts(a.created_at),
    }


# --------------------------------------------------------------------------- #
# notifications
# --------------------------------------------------------------------------- #

def notification_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "title": n.title,
        "message": n.message,
        "priority": n.priority,
        "category": n.category,
        "beneficiary_name": n.beneficiary_name or "",
        "created_at": fmt_ts(n.created_at),
        "is_read": n.is_read,
        "target_user_id": n.target_user_id or "all",
    }


# --------------------------------------------------------------------------- #
# audit logs
# --------------------------------------------------------------------------- #

def audit_dict(a: AuditLog) -> dict:
    return {
        "id": a.id,
        "action": a.action,
        "username": a.username or "",
        "role": a.role or "",
        "record_id": a.record_id or "",
        "details": a.details or "",
        "ip_address": a.ip_address or "127.0.0.1",
        "timestamp": fmt_ts(a.timestamp),
    }
