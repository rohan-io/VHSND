"""
Proposed PostgreSQL schema for the HEALTH CONNECT backend (MongoDB -> Postgres migration).

STATUS: DESIGN FOR REVIEW. No migration or query code depends on this yet.

Design notes
------------
* Business-code strings are the primary keys (PREG-2026-1049, BEN-2026-500,
  USR-HW-001, CHILD-MCH-7029). The API exposes these as `id`; keeping them as PKs
  makes the query rewrite a mechanical translation with no ID-mapping layer.
* `beneficiaries` is extracted out of the old `pregnancies` document: the mother /
  person lives here once; a pregnancy is now just an episode that references her.
* Every denormalized `*_name`, `beneficiary_id`, `health_centre`, `mother_name`,
  `mother_mobile`, `administered_by` column from Mongo is GONE. The API's flat JSON
  shapes are rebuilt with JOINs in the data layer (Step 3), so the frontend sees
  no change.
* Not stored (computed in the response layer): gestational_weeks / gestational_days
  / gestational_age_label, child age_days / age_label, child vaccine_stats.
  Stored + indexed for dashboard count queries: pregnancies.trimester, pregnancies.edd.
* `alerts` is a materialized table: written when an entity changes + refreshed by a
  scheduled sweep (Step 4), read directly on GET. It holds FKs + the pre-rendered
  title/message; display names come from a JOIN.
* Dates -> Date. Timestamps -> DateTime(timezone=True). Clinical measures ->
  Numeric(5,2). Closed value sets -> PG ENUM. The two list fields -> TEXT[].
  delivery_details -> JSONB.
"""

from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enums  (closed value sets seen in server.py)
# ---------------------------------------------------------------------------

user_role = SAEnum("Administrator", "Health Worker", name="user_role")
pregnancy_status = SAEnum(
    "active", "high_risk", "delivered", "archived", name="pregnancy_status"
)
visit_status = SAEnum("Completed", "Upcoming", "Overdue", name="visit_status")
immunization_status = SAEnum(
    "Upcoming", "Due", "Completed", "Overdue", name="immunization_status"
)
gender = SAEnum("Male", "Female", name="gender")
alert_priority = SAEnum("CRITICAL", "HIGH", "MEDIUM", "LOW", name="alert_priority")
alert_status = SAEnum("ACTIVE", "ACKNOWLEDGED", "RESOLVED", name="alert_status")
related_entity_type = SAEnum("pregnancy", "child", name="related_entity_type")
# alert_type, notification.category, audit.action stay plain strings (open-ended).


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)          # USR-HW-001
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(user_role, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)         # "Smruti Malla (ANM)"
    mobile: Mapped[Optional[str]] = mapped_column(String(20))
    phc_center: Mapped[Optional[str]] = mapped_column(String(120))
    sector: Mapped[Optional[str]] = mapped_column(String(80))
    assigned_villages: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (Index("ix_users_role", "role"),)


# ---------------------------------------------------------------------------
# beneficiaries  (NEW -- the mother/person, extracted out of pregnancies)
# ---------------------------------------------------------------------------

class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)          # BEN-2026-500
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    husband_name: Mapped[Optional[str]] = mapped_column(String(120))
    dob: Mapped[Optional[dt.date]] = mapped_column(Date)
    age: Mapped[Optional[int]] = mapped_column(Integer)                    # snapshot at registration
    mobile_number: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(Text)
    village: Mapped[Optional[str]] = mapped_column(String(80))
    block: Mapped[Optional[str]] = mapped_column(String(80))
    district: Mapped[Optional[str]] = mapped_column(String(80))
    blood_group: Mapped[Optional[str]] = mapped_column(String(4))
    allergies: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    pregnancies: Mapped[list["Pregnancy"]] = relationship(back_populates="beneficiary")
    children: Mapped[list["Child"]] = relationship(back_populates="beneficiary")

    __table_args__ = (
        Index("ix_beneficiaries_village", "village"),
        Index("ix_beneficiaries_mobile", "mobile_number"),
        Index("ix_beneficiaries_full_name", "full_name"),
    )


# ---------------------------------------------------------------------------
# pregnancies  (now the pregnancy EPISODE only)
# ---------------------------------------------------------------------------

class Pregnancy(Base):
    __tablename__ = "pregnancies"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)          # PREG-2026-1049
    beneficiary_id: Mapped[str] = mapped_column(
        ForeignKey("beneficiaries.id", ondelete="RESTRICT"), nullable=False
    )
    assigned_worker_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    registration_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    lmp: Mapped[dt.date] = mapped_column(Date, nullable=False)
    edd: Mapped[Optional[dt.date]] = mapped_column(Date)                   # derived from lmp, stored
    trimester: Mapped[Optional[int]] = mapped_column(Integer)             # derived, stored + indexed for counts

    gravida: Mapped[Optional[int]] = mapped_column(Integer)
    para: Mapped[Optional[int]] = mapped_column(Integer)

    # latest recorded vitals (updated from the newest ANC visit)
    weight: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    bp_systolic: Mapped[Optional[int]] = mapped_column(Integer)
    bp_diastolic: Mapped[Optional[int]] = mapped_column(Integer)
    hemoglobin: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    fundal_height: Mapped[Optional[str]] = mapped_column(String(20))       # "17 cm"
    fetal_heart_rate: Mapped[Optional[int]] = mapped_column(Integer)

    is_high_risk: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    high_risk_reasons: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default="{}"
    )
    previous_pregnancy_history: Mapped[Optional[str]] = mapped_column(Text)
    existing_conditions: Mapped[Optional[str]] = mapped_column(Text)
    risk_factors: Mapped[Optional[str]] = mapped_column(String(40))        # "High Risk Monitored" | "Standard Care"

    status: Mapped[str] = mapped_column(pregnancy_status, nullable=False, server_default="active")
    delivery_details: Mapped[Optional[dict]] = mapped_column(JSONB)        # {date, outcome, birth_weight, place, child_id}
    sync_status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="synced")

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    beneficiary: Mapped["Beneficiary"] = relationship(back_populates="pregnancies")
    worker: Mapped[Optional["User"]] = relationship()
    visits: Mapped[list["ANCVisit"]] = relationship(
        back_populates="pregnancy", cascade="all, delete-orphan"
    )
    immunizations: Mapped[list["MaternalImmunization"]] = relationship(
        back_populates="pregnancy", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_pregnancies_beneficiary", "beneficiary_id"),
        Index("ix_pregnancies_worker", "assigned_worker_id"),
        Index("ix_pregnancies_status", "status"),
        Index("ix_pregnancies_created_at", "created_at"),
        # composites for the dashboard / admin count queries
        Index("ix_pregnancies_status_trimester", "status", "trimester"),
        Index("ix_pregnancies_status_high_risk", "status", "is_high_risk"),
    )


# ---------------------------------------------------------------------------
# anc_visits
# ---------------------------------------------------------------------------

class ANCVisit(Base):
    __tablename__ = "anc_visits"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)          # ANC-VISIT-...-<uuid6>
    pregnancy_id: Mapped[str] = mapped_column(
        ForeignKey("pregnancies.id", ondelete="CASCADE"), nullable=False
    )
    health_worker_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    visit_number: Mapped[int] = mapped_column(Integer, nullable=False)
    visit_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    next_visit_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    gestational_weeks_at_visit: Mapped[Optional[int]] = mapped_column(Integer)

    weight: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    bp_systolic: Mapped[Optional[int]] = mapped_column(Integer)
    bp_diastolic: Mapped[Optional[int]] = mapped_column(Integer)
    hemoglobin: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    fundal_height: Mapped[Optional[str]] = mapped_column(String(20))
    fetal_heart_rate: Mapped[Optional[int]] = mapped_column(Integer)

    symptoms: Mapped[Optional[str]] = mapped_column(Text)
    examination_notes: Mapped[Optional[str]] = mapped_column(Text)
    investigation_details: Mapped[Optional[str]] = mapped_column(Text)
    advice: Mapped[Optional[str]] = mapped_column(Text)
    risk_status: Mapped[Optional[str]] = mapped_column(String(12))         # "High Risk" | "Normal"
    status: Mapped[str] = mapped_column(visit_status, nullable=False, server_default="Completed")

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    pregnancy: Mapped["Pregnancy"] = relationship(back_populates="visits")
    worker: Mapped[Optional["User"]] = relationship()

    __table_args__ = (
        Index("ix_anc_visits_pregnancy", "pregnancy_id"),
        Index("ix_anc_visits_worker", "health_worker_id"),
        Index("ix_anc_visits_status", "status"),
        Index("ix_anc_visits_pregnancy_visitnum", "pregnancy_id", "visit_number"),
    )


# ---------------------------------------------------------------------------
# maternal_immunizations
# ---------------------------------------------------------------------------

class MaternalImmunization(Base):
    __tablename__ = "maternal_immunizations"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)          # MAT-IMM-<pid>-<vax4>
    pregnancy_id: Mapped[str] = mapped_column(
        ForeignKey("pregnancies.id", ondelete="CASCADE"), nullable=False
    )
    health_worker_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    vaccine_name: Mapped[str] = mapped_column(String(80), nullable=False)
    dose: Mapped[Optional[str]] = mapped_column(String(40))
    description: Mapped[Optional[str]] = mapped_column(Text)
    recommended_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    due_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    administration_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    batch_number: Mapped[Optional[str]] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(immunization_status, nullable=False, server_default="Upcoming")
    remarks: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    pregnancy: Mapped["Pregnancy"] = relationship(back_populates="immunizations")
    worker: Mapped[Optional["User"]] = relationship()

    __table_args__ = (
        Index("ix_mat_imm_pregnancy", "pregnancy_id"),
        Index("ix_mat_imm_status", "status"),
    )


# ---------------------------------------------------------------------------
# children
# ---------------------------------------------------------------------------

class Child(Base):
    __tablename__ = "children"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)          # CHD-2026-2029
    child_id: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)  # CHILD-MCH-7029
    beneficiary_id: Mapped[str] = mapped_column(
        ForeignKey("beneficiaries.id", ondelete="RESTRICT"), nullable=False
    )
    health_worker_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    child_name: Mapped[str] = mapped_column(String(120), nullable=False)
    gender: Mapped[str] = mapped_column(gender, nullable=False)
    dob: Mapped[dt.date] = mapped_column(Date, nullable=False)
    birth_weight: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    place_of_birth: Mapped[Optional[str]] = mapped_column(String(120))
    address: Mapped[Optional[str]] = mapped_column(Text)
    village: Mapped[Optional[str]] = mapped_column(String(80))
    block: Mapped[Optional[str]] = mapped_column(String(80))
    district: Mapped[Optional[str]] = mapped_column(String(80))

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    beneficiary: Mapped["Beneficiary"] = relationship(back_populates="children")
    worker: Mapped[Optional["User"]] = relationship()
    immunizations: Mapped[list["ChildImmunization"]] = relationship(
        back_populates="child", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_children_beneficiary", "beneficiary_id"),
        Index("ix_children_worker", "health_worker_id"),
        Index("ix_children_village", "village"),
        Index("ix_children_gender", "gender"),
        Index("ix_children_created_at", "created_at"),
    )


# ---------------------------------------------------------------------------
# child_immunizations
# ---------------------------------------------------------------------------

class ChildImmunization(Base):
    __tablename__ = "child_immunizations"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)          # CHD-IMM-<cid>-<code>
    child_id: Mapped[str] = mapped_column(
        ForeignKey("children.id", ondelete="CASCADE"), nullable=False
    )
    health_worker_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    vaccine_code: Mapped[str] = mapped_column(String(20), nullable=False)
    vaccine_name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_age_label: Mapped[Optional[str]] = mapped_column(String(40))
    recommended_due_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    administered_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    route: Mapped[Optional[str]] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(immunization_status, nullable=False, server_default="Upcoming")
    batch_no: Mapped[Optional[str]] = mapped_column(String(40))
    adverse_event_reported: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    remarks: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    child: Mapped["Child"] = relationship(back_populates="immunizations")
    worker: Mapped[Optional["User"]] = relationship()

    __table_args__ = (
        Index("ix_child_imm_child", "child_id"),
        Index("ix_child_imm_status", "status"),
        Index("ix_child_imm_child_status", "child_id", "status"),  # powers vaccine_stats GROUP BY
    )


# ---------------------------------------------------------------------------
# alerts  (materialized: written on entity change + scheduled sweep, read on GET)
# ---------------------------------------------------------------------------

class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)         # deterministic ALERT-* key
    alert_type: Mapped[str] = mapped_column(String(40), nullable=False)    # open-ended
    priority: Mapped[str] = mapped_column(alert_priority, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)              # pre-rendered
    message: Mapped[str] = mapped_column(Text, nullable=False)            # pre-rendered

    related_entity_type: Mapped[str] = mapped_column(related_entity_type, nullable=False)
    pregnancy_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("pregnancies.id", ondelete="CASCADE")
    )
    child_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("children.id", ondelete="CASCADE")
    )
    assigned_worker_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    due_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    status: Mapped[str] = mapped_column(alert_status, nullable=False, server_default="ACTIVE")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    acknowledged_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))

    pregnancy: Mapped[Optional["Pregnancy"]] = relationship()
    child: Mapped[Optional["Child"]] = relationship()
    worker: Mapped[Optional["User"]] = relationship()

    __table_args__ = (
        CheckConstraint(
            "(related_entity_type = 'pregnancy' AND pregnancy_id IS NOT NULL AND child_id IS NULL) OR "
            "(related_entity_type = 'child' AND child_id IS NOT NULL AND pregnancy_id IS NULL)",
            name="ck_alerts_entity_ref",
        ),
        Index("ix_alerts_status", "status"),
        Index("ix_alerts_type", "alert_type"),
        Index("ix_alerts_priority", "priority"),
        Index("ix_alerts_pregnancy", "pregnancy_id"),
        Index("ix_alerts_child", "child_id"),
        Index("ix_alerts_worker", "assigned_worker_id"),
        Index("ix_alerts_status_created", "status", "created_at"),
        Index("ix_alerts_status_type", "status", "alert_type"),
    )


# ---------------------------------------------------------------------------
# notifications
# ---------------------------------------------------------------------------

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)          # NOTIF-001
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(alert_priority, nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)      # IMMUNIZATION | HIGH_RISK | CAMPAIGN
    beneficiary_name: Mapped[Optional[str]] = mapped_column(String(200))   # free text label
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    # NULL target = broadcast (was the "all" sentinel). FK when addressed to one worker.
    target_user_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_notifications_target", "target_user_id"),
        Index("ix_notifications_created_at", "created_at"),
    )


# ---------------------------------------------------------------------------
# audit_logs
# ---------------------------------------------------------------------------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)          # uuid4
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(60))
    role: Mapped[Optional[str]] = mapped_column(String(30))
    record_id: Mapped[Optional[str]] = mapped_column(String(120))
    details: Mapped[Optional[str]] = mapped_column(Text)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    timestamp: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_audit_timestamp", "timestamp"),
        Index("ix_audit_username", "username"),
        Index("ix_audit_action", "action"),
    )


# ---------------------------------------------------------------------------
# sync_queue  (audit trail of processed offline transactions)
# ---------------------------------------------------------------------------

class SyncQueueEntry(Base):
    __tablename__ = "sync_queue"

    client_txn_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    worker_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="PROCESSED")
    timestamp: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_sync_queue_worker", "worker_id"),
        Index("ix_sync_queue_timestamp", "timestamp"),
    )
