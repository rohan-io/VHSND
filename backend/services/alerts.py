"""
Alert engine, Postgres edition.

Old behaviour: `run_alert_engine_internal()` scanned every pregnancy + child and
re-upserted every alert on *every* /api/dashboard and /api/alerts request
(~450 un-indexed round trips -> 8 min on Render).

New behaviour:
* `recompute_for_pregnancy` / `recompute_for_child` regenerate just one entity's
  alerts. Called from the write endpoints (register, ANC visit, mark vaccine, sync).
* `full_sweep` does the time-dependent part (age Due->Overdue, re-eval EDD/ANC
  windows, prune stale acknowledged alerts). Runs on an APScheduler timer, off the
  request path.
* GET /api/dashboard and GET /api/alerts just SELECT from the `alerts` table.

Alert ids stay deterministic so acknowledged alerts are never resurrected:
recompute deletes only ACTIVE rows for the entity and skips regenerating any id
that already exists as ACKNOWLEDGED/RESOLVED.
"""

from __future__ import annotations

import datetime as dt
from typing import Iterable

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from helpers import calculate_gestational_info
from db.models import (
    Alert,
    ANCVisit,
    Child,
    ChildImmunization,
    MaternalImmunization,
    Pregnancy,
)

PRUNE_AFTER_DAYS = 30
UPCOMING_TO_DUE_DAYS = 14
ACTIVE_PREG_STATUSES = ("active", "high_risk")

ANC_SCHEDULE = [
    (1, 12, "ANC 1 (1st Trimester - Up to 12 Weeks)"),
    (2, 24, "ANC 2 (2nd Trimester - 14-26 Weeks)"),
    (3, 32, "ANC 3 (3rd Trimester - 28-34 Weeks)"),
    (4, 36, "ANC 4 (3rd Trimester - 36+ Weeks)"),
]


# --------------------------------------------------------------------------- #
# generation (pure-ish: reads pre-loaded relationships, returns Alert kwargs)
# --------------------------------------------------------------------------- #

def _generate_pregnancy_alerts(p: Pregnancy) -> list[dict]:
    today = dt.date.today()
    gest = calculate_gestational_info(p.lmp)
    name = p.beneficiary.full_name if p.beneficiary else "Beneficiary"
    w_id = p.assigned_worker_id
    rows: list[dict] = []

    base = dict(
        related_entity_type="pregnancy",
        pregnancy_id=p.id,
        child_id=None,
        assigned_worker_id=w_id,
        status="ACTIVE",
    )

    # A. High-risk pregnancy
    if p.is_high_risk:
        reasons = ", ".join(p.high_risk_reasons or ["Clinical observation"])
        rows.append({
            **base,
            "id": f"ALERT-HR-{p.id}",
            "alert_type": "HIGH_RISK_PREGNANCY",
            "priority": "CRITICAL",
            "title": f"High Risk Pregnancy: {name}",
            "message": (
                f"Requires intensive monitoring: {reasons}. "
                f"Trimester {gest['trimester']} ({gest['gestational_age_label']})."
            ),
            "due_date": today,
        })

    # B. EDD approaching (within 15 days)
    days_to_edd = gest["days_to_edd"]
    if 0 <= days_to_edd <= 15:
        rows.append({
            **base,
            "id": f"ALERT-EDD-{p.id}",
            "alert_type": "EDD_APPROACHING",
            "priority": "CRITICAL" if days_to_edd <= 5 else "HIGH",
            "title": f"Delivery Approaching in {days_to_edd} Days: {name}",
            "message": (
                f"Expected Delivery Date is {gest['edd']}. "
                f"Prepare institutional birth plan and transport."
            ),
            "due_date": gest["edd_date"],
        })

    # C. Missed ANC (highest pending only)
    completed = sum(1 for v in (p.visits or []) if v.status == "Completed")
    gest_weeks = gest["gestational_weeks"]
    for num, target_wk, label in ANC_SCHEDULE:
        if gest_weeks >= target_wk and completed < num:
            overdue_weeks = gest_weeks - target_wk
            rows.append({
                **base,
                "id": f"ALERT-ANC-MISSED-{p.id}-{num}",
                "alert_type": "MISSED_ANC",
                "priority": "HIGH",
                "title": f"{label} Overdue by {overdue_weeks} Weeks",
                "message": (
                    f"Check-up missing for {name} (currently "
                    f"{gest['gestational_age_label']}). Record ANC visit."
                ),
                "due_date": today,
            })
            break

    # D. Maternal immunizations due / overdue
    for im in (p.immunizations or []):
        if im.status in ("Due", "Overdue"):
            is_overdue = im.status == "Overdue"
            rows.append({
                **base,
                "id": f"ALERT-MAT-IMM-{im.id}",
                "alert_type": "MATERNAL_VACCINE_OVERDUE" if is_overdue else "MATERNAL_VACCINE_DUE",
                "priority": "HIGH" if is_overdue else "MEDIUM",
                "title": f"Maternal Vaccine {'Overdue' if is_overdue else 'Due'}: {im.vaccine_name}",
                "message": (
                    f"{im.vaccine_name} scheduled for {name}. "
                    f"Due date: {im.due_date.strftime('%Y-%m-%d') if im.due_date else 'N/A'}"
                ),
                "due_date": im.due_date or today,
            })

    return rows


def _generate_child_alerts(c: Child) -> list[dict]:
    today = dt.date.today()
    ch_name = c.child_name
    m_name = c.beneficiary.full_name if c.beneficiary else ""
    rows: list[dict] = []

    base = dict(
        related_entity_type="child",
        pregnancy_id=None,
        child_id=c.id,
        assigned_worker_id=c.health_worker_id,
        status="ACTIVE",
    )

    for im in (c.immunizations or []):
        if im.status in ("Due", "Overdue"):
            is_overdue = im.status == "Overdue"
            rows.append({
                **base,
                "id": f"ALERT-CHD-IMM-{im.id}",
                "alert_type": "CHILD_VACCINE_OVERDUE" if is_overdue else "CHILD_VACCINE_DUE",
                "priority": "HIGH" if is_overdue else "MEDIUM",
                "title": f"Child Vaccine {'Overdue' if is_overdue else 'Due'}: {im.vaccine_code}",
                "message": (
                    f"{im.vaccine_name} ({im.target_age_label}) for {ch_name} "
                    f"(Mother: {m_name})."
                ),
                "due_date": im.recommended_due_date or today,
            })
    return rows


# --------------------------------------------------------------------------- #
# per-entity recompute (called on write)
# --------------------------------------------------------------------------- #

async def _skip_ids(session: AsyncSession, *, pregnancy_id=None, child_id=None) -> set[str]:
    q = select(Alert.id).where(Alert.status.in_(("ACKNOWLEDGED", "RESOLVED")))
    q = q.where(Alert.pregnancy_id == pregnancy_id) if pregnancy_id else q.where(Alert.child_id == child_id)
    return set((await session.execute(q)).scalars().all())


async def recompute_for_pregnancy(session: AsyncSession, pregnancy_id: str) -> int:
    p = (
        await session.execute(
            select(Pregnancy)
            .where(Pregnancy.id == pregnancy_id)
            .options(
                selectinload(Pregnancy.beneficiary),
                selectinload(Pregnancy.visits),
                selectinload(Pregnancy.immunizations),
            )
        )
    ).scalar_one_or_none()

    skip = await _skip_ids(session, pregnancy_id=pregnancy_id)
    await session.execute(
        delete(Alert).where(Alert.pregnancy_id == pregnancy_id, Alert.status == "ACTIVE")
    )
    if p is None or p.status not in ACTIVE_PREG_STATUSES:
        return 0

    made = 0
    for row in _generate_pregnancy_alerts(p):
        if row["id"] in skip:
            continue
        session.add(Alert(**row))
        made += 1
    await session.flush()
    return made


async def recompute_for_child(session: AsyncSession, child_id: str) -> int:
    c = (
        await session.execute(
            select(Child)
            .where(Child.id == child_id)
            .options(
                selectinload(Child.beneficiary),
                selectinload(Child.immunizations),
            )
        )
    ).scalar_one_or_none()

    skip = await _skip_ids(session, child_id=child_id)
    await session.execute(
        delete(Alert).where(Alert.child_id == child_id, Alert.status == "ACTIVE")
    )
    if c is None:
        return 0

    made = 0
    for row in _generate_child_alerts(c):
        if row["id"] in skip:
            continue
        session.add(Alert(**row))
        made += 1
    await session.flush()
    return made


# --------------------------------------------------------------------------- #
# scheduled full sweep (time-dependent maintenance)
# --------------------------------------------------------------------------- #

async def _age_immunization_statuses(session: AsyncSession) -> int:
    today = dt.date.today()
    horizon = today + dt.timedelta(days=UPCOMING_TO_DUE_DAYS)
    changed = 0
    for model, date_col in (
        (MaternalImmunization, MaternalImmunization.due_date),
        (ChildImmunization, ChildImmunization.recommended_due_date),
    ):
        r1 = await session.execute(
            update(model)
            .where(model.status == "Due", date_col < today)
            .values(status="Overdue")
        )
        r2 = await session.execute(
            update(model)
            .where(model.status == "Upcoming", date_col <= horizon)
            .values(status="Due")
        )
        changed += (r1.rowcount or 0) + (r2.rowcount or 0)
    return changed


async def _prune_old_alerts(session: AsyncSession) -> int:
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=PRUNE_AFTER_DAYS)
    res = await session.execute(
        delete(Alert).where(
            Alert.status.in_(("ACKNOWLEDGED", "RESOLVED")),
            Alert.created_at < cutoff,
        )
    )
    return res.rowcount or 0


async def full_sweep(session: AsyncSession) -> dict:
    aged = await _age_immunization_statuses(session)

    preg_ids: Iterable[str] = (
        await session.execute(
            select(Pregnancy.id).where(Pregnancy.status.in_(ACTIVE_PREG_STATUSES))
        )
    ).scalars().all()
    child_ids: Iterable[str] = (await session.execute(select(Child.id))).scalars().all()

    made = 0
    for pid in preg_ids:
        made += await recompute_for_pregnancy(session, pid)
    for cid in child_ids:
        made += await recompute_for_child(session, cid)

    pruned = await _prune_old_alerts(session)
    await session.flush()
    return {"generated_active_alerts": made, "aged_immunizations": aged, "pruned": pruned}


async def count_active(session: AsyncSession) -> int:
    return (
        await session.execute(
            select(func.count()).select_from(Alert).where(Alert.status == "ACTIVE")
        )
    ).scalar_one()
