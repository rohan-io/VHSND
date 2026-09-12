# HEALTH CONNECT — Maternal & Child Health Worker Management System

## Problem Statement
A government-style demo app for field health workers (ANM/ASHA) and administrators to
register pregnant women, monitor pregnancy/trimesters, track ANC visits, maternal &
child immunisation, alerts, offline sync, and an admin analytics dashboard.

## Stack
- Frontend: Expo React Native + TypeScript, expo-router (tabs + stack)
- Backend: FastAPI + MongoDB (JWT auth, RBAC, dynamic alert engine, seed data)

## Roles / Demo Credentials
- Administrator: `admin` / `Admin@123` — Dilip Acharya (CMO)
- Health Worker: `worker01` / `Worker@123` — Smruti Malla (ANM)
- Also worker02..05 / `Worker@123`

## Implemented (2026-06)
- Auth: one-tap demo persona switcher, JWT login, role-based redirect
- Health Worker tabs: Home dashboard, Pregnancy registry, Children registry, Alerts, Profile
- Pregnancy: list (search + trimester/high-risk filters), detail (trimester timeline,
  ANC visits, maternal immunisation, vitals), registration form (offline-capable)
- ANC visit form with auto high-risk detection; maternal vaccine mark-complete
- Children: list with vaccine progress, detail with immunisation schedule + mark-complete
- Alert Engine screen (segmented filters, acknowledge); dynamic backend recalculation
- Notifications (mock FCM), Offline Sync Center (simulated offline toggle, queue, Sync Now)
- Admin dashboard: KPIs, trimester distribution, village-wise stats, worker performance
- App renamed to HEALTH CONNECT; names Smruti Malla (ANM), Dilip Acharya (Admin)
- Added Jajapur Block demo data: villages Abdalpur, Ankula, Aradapada, Badasuar, Baibhuin
  (8 mothers across trimesters + high-risk, 5 children) with due/overdue vaccine & ANC alerts

## Backlog (P1/P2)
- P2: Audit log viewer UI, reschedule child vaccine UI, admin district filters
- P2: Charts library upgrade, CSV export
