"""Comprehensive backend API tests for HEALTHCARE CONNECT MCH Worker Management System."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://anc-tracker-app.preview.emergentagent.com").rstrip("/")


# ---------------- AUTH ----------------
class TestAuth:
    def test_login_worker_success(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "worker01", "password": "Worker@123"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["username"] == "worker01"
        assert data["user"]["role"] == "Health Worker"

    def test_login_admin_success(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "Admin@123"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["role"] == "Administrator"
        assert "access_token" in data

    def test_login_invalid(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "worker01", "password": "wrong"})
        assert r.status_code in (400, 401)

    def test_me_endpoint(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=worker_headers)
        assert r.status_code == 200
        assert r.json()["username"] == "worker01"


# ---------------- DASHBOARD ----------------
class TestDashboard:
    def test_dashboard_shape(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/dashboard", headers=worker_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "summary" in data
        assert "todays_alerts" in data
        assert "recent_pregnancies" in data
        s = data["summary"]
        for key in [
            "total_pregnancies", "trimester_1", "trimester_2", "trimester_3",
            "anc_due", "anc_overdue",
            "maternal_vaccine_due", "maternal_vaccine_overdue", "maternal_vaccine_completed",
            "total_children", "child_vaccines_due", "child_vaccines_overdue", "child_vaccines_completed"
        ]:
            assert key in s, f"Missing key {key} in summary"
        assert isinstance(s["total_pregnancies"], int)
        assert s["total_pregnancies"] >= 1


# ---------------- PREGNANCIES ----------------
class TestPregnancies:
    def test_list_pregnancies(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/pregnancies", headers=worker_headers)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "total" in data
        assert data["total"] >= 1
        # verify no _id leaked
        for item in data["items"][:5]:
            assert "_id" not in item
            assert "trimester" in item

    def test_filter_trimester(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/pregnancies", headers=worker_headers, params={"trimester": 2})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["trimester"] == 2

    def test_filter_high_risk(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/pregnancies", headers=worker_headers, params={"high_risk": "true"})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it.get("is_high_risk") is True

    def test_filter_delivered(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/pregnancies", headers=worker_headers, params={"status_filter": "delivered"})
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["status"] == "delivered"

    def test_search(self, api, worker_headers):
        listr = api.get(f"{BASE_URL}/api/pregnancies", headers=worker_headers).json()
        if listr["items"]:
            name = listr["items"][0]["full_name"].split()[0]
            r = api.get(f"{BASE_URL}/api/pregnancies", headers=worker_headers, params={"search": name})
            assert r.status_code == 200
            assert r.json()["total"] >= 1

    def test_get_pregnancy_detail(self, api, worker_headers):
        listr = api.get(f"{BASE_URL}/api/pregnancies", headers=worker_headers).json()
        assert listr["items"], "No pregnancies to detail-check"
        pid = listr["items"][0]["id"]
        r = api.get(f"{BASE_URL}/api/pregnancies/{pid}", headers=worker_headers)
        assert r.status_code == 200
        data = r.json()
        # API returns wrapper: {pregnancy, visits, immunizations, children}
        assert "pregnancy" in data
        assert data["pregnancy"]["id"] == pid
        assert "visits" in data
        assert "immunizations" in data
        assert "children" in data

    def test_create_pregnancy_and_dashboard_increment(self, api, worker_headers):
        # Baseline count
        d0 = api.get(f"{BASE_URL}/api/dashboard", headers=worker_headers).json()["summary"]["total_pregnancies"]
        payload = {
            "full_name": f"TEST_Mother_{uuid.uuid4().hex[:6]}",
            "husband_name": "TEST Husband",
            "age": 26,
            "mobile_number": f"98{uuid.uuid4().int % 100000000:08d}",
            "address": "Test Address",
            "village": "Rampur",
            "lmp": "2025-06-01",
            "blood_group": "O+",
            "weight": 55.0,
            "bp_systolic": 118,
            "bp_diastolic": 78,
            "hemoglobin": 11.5,
        }
        r = api.post(f"{BASE_URL}/api/pregnancies", headers=worker_headers, json=payload)
        assert r.status_code == 201, r.text
        created = r.json()
        assert created["full_name"] == payload["full_name"]
        assert created["edd"], "EDD should be auto-calculated"
        assert created["trimester"] in (1, 2, 3)
        pytest.created_preg_id = created["id"]
        # Verify GET
        g = api.get(f"{BASE_URL}/api/pregnancies/{created['id']}", headers=worker_headers)
        assert g.status_code == 200
        assert g.json()["pregnancy"]["id"] == created["id"]
        # Dashboard increment
        d1 = api.get(f"{BASE_URL}/api/dashboard", headers=worker_headers).json()["summary"]["total_pregnancies"]
        assert d1 == d0 + 1, f"Dashboard count did not increment: {d0} -> {d1}"

    def test_create_pregnancy_high_risk_autodetect(self, api, worker_headers):
        payload = {
            "full_name": f"TEST_HR_{uuid.uuid4().hex[:6]}",
            "age": 40,  # high risk age
            "mobile_number": f"97{uuid.uuid4().int % 100000000:08d}",
            "address": "Addr",
            "village": "Rampur",
            "lmp": "2025-05-01",
            "hemoglobin": 8.2,  # anemia
            "bp_systolic": 150,
            "bp_diastolic": 95,
        }
        r = api.post(f"{BASE_URL}/api/pregnancies", headers=worker_headers, json=payload)
        assert r.status_code == 201
        c = r.json()
        assert c["is_high_risk"] is True
        assert len(c["high_risk_reasons"]) >= 1

    def test_record_anc_visit(self, api, worker_headers):
        pid = getattr(pytest, "created_preg_id", None)
        if not pid:
            pytest.skip("No created pregnancy id from earlier test")
        payload = {
            "visit_number": 2,
            "visit_date": "2026-01-10",
            "gestational_weeks_at_visit": 24,
            "weight": 58.0,
            "bp_systolic": 120,
            "bp_diastolic": 80,
            "hemoglobin": 11.2,
            "fetal_heart_rate": 140,
            "symptoms": "None",
        }
        r = api.post(f"{BASE_URL}/api/pregnancies/{pid}/visits", headers=worker_headers, json=payload)
        assert r.status_code == 201, r.text
        visit = r.json()
        assert visit["visit_number"] == 2
        assert visit["pregnancy_id"] == pid

    def test_complete_maternal_immunization(self, api, worker_headers):
        pid = getattr(pytest, "created_preg_id", None)
        if not pid:
            pytest.skip("No created pregnancy id")
        imm = api.get(f"{BASE_URL}/api/pregnancies/{pid}/immunizations", headers=worker_headers)
        assert imm.status_code == 200
        items = imm.json()
        assert isinstance(items, list) and len(items) >= 1
        target = next((i for i in items if i["status"] != "Completed"), items[0])
        r = api.post(
            f"{BASE_URL}/api/pregnancies/{pid}/immunizations/{target['id']}/complete",
            headers=worker_headers,
            json={"batch_number": "TEST-BATCH-01"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Completed"


# ---------------- CHILDREN ----------------
class TestChildren:
    def test_list_children(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/children", headers=worker_headers)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "total" in data
        if data["items"]:
            assert "vaccine_stats" in data["items"][0]

    def test_filter_gender(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/children", headers=worker_headers, params={"gender": "Female"})
        assert r.status_code == 200
        for c in r.json()["items"]:
            assert c["gender"] == "Female"

    def test_create_child(self, api, worker_headers):
        # Use an active pregnancy as mother
        preg = api.get(f"{BASE_URL}/api/pregnancies", headers=worker_headers, params={"limit": 5}).json()
        mother = next((p for p in preg["items"] if p["status"] in ("active", "high_risk")), preg["items"][0])
        payload = {
            "mother_id": mother["id"],
            "child_name": f"TEST_Baby_{uuid.uuid4().hex[:6]}",
            "gender": "Female",
            "dob": "2026-01-05",
            "birth_weight": 3.1,
            "village": mother.get("village", "Rampur"),
        }
        r = api.post(f"{BASE_URL}/api/children", headers=worker_headers, json=payload)
        assert r.status_code == 201, r.text
        created = r.json()
        assert created["child_name"] == payload["child_name"]
        pytest.created_child_id = created["id"]

        # Verify mother marked delivered
        mother_after = api.get(f"{BASE_URL}/api/pregnancies/{mother['id']}", headers=worker_headers).json()
        m_status = mother_after.get("pregnancy", mother_after).get("status")
        assert m_status == "delivered", f"Mother status not delivered: {m_status}"

        # Verify immunization schedule generated
        detail = api.get(f"{BASE_URL}/api/children/{created['id']}", headers=worker_headers).json()
        imm = detail.get("immunizations", [])
        assert len(imm) >= 1, "Child immunization schedule not created"

    def test_get_child_detail(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/children", headers=worker_headers).json()
        assert r["items"]
        cid = r["items"][0]["id"]
        d = api.get(f"{BASE_URL}/api/children/{cid}", headers=worker_headers)
        assert d.status_code == 200
        data = d.json()
        assert "child" in data
        assert data["child"]["id"] == cid
        assert "immunizations" in data

    def test_complete_child_immunization(self, api, worker_headers):
        cid = getattr(pytest, "created_child_id", None)
        if not cid:
            r = api.get(f"{BASE_URL}/api/children", headers=worker_headers).json()
            cid = r["items"][0]["id"] if r["items"] else None
        if not cid:
            pytest.skip("No child available")
        detail = api.get(f"{BASE_URL}/api/children/{cid}", headers=worker_headers).json()
        imm_list = detail.get("immunizations", [])
        target = next((i for i in imm_list if i.get("status") != "Completed"), None)
        if not target:
            pytest.skip("No pending immunization")
        r = api.post(
            f"{BASE_URL}/api/children/{cid}/immunizations/{target['id']}/complete",
            headers=worker_headers,
            json={"batch_number": "TEST-CHILD-01"},
        )
        assert r.status_code == 200, r.text


# ---------------- ALERTS ----------------
class TestAlerts:
    def test_list_alerts(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/alerts", headers=worker_headers, params={"status_filter": "ACTIVE"})
        assert r.status_code == 200
        data = r.json()
        assert "items" in data

    def test_recalculate_alerts(self, api, worker_headers):
        r = api.post(f"{BASE_URL}/api/alerts/recalculate", headers=worker_headers)
        assert r.status_code == 200
        assert "total_alerts" in r.json()

    def test_acknowledge_alert(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/alerts", headers=worker_headers, params={"status_filter": "ACTIVE"}).json()
        if not r["items"]:
            pytest.skip("No active alerts")
        aid = r["items"][0]["id"]
        ack = api.post(f"{BASE_URL}/api/alerts/{aid}/acknowledge", headers=worker_headers)
        assert ack.status_code == 200
        assert ack.json()["status"] == "ACKNOWLEDGED"


# ---------------- NOTIFICATIONS ----------------
class TestNotifications:
    def test_list_notifications(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/notifications", headers=worker_headers)
        assert r.status_code == 200
        assert "items" in r.json() and "unread_count" in r.json()

    def test_mark_read(self, api, worker_headers):
        r = api.get(f"{BASE_URL}/api/notifications", headers=worker_headers).json()
        unread = [n for n in r["items"] if not n.get("is_read")]
        if not unread:
            pytest.skip("No unread notifications")
        nid = unread[0]["id"]
        mr = api.post(f"{BASE_URL}/api/notifications/{nid}/read", headers=worker_headers)
        assert mr.status_code == 200


# ---------------- SYNC ----------------
class TestSync:
    def test_offline_sync_batch(self, api, worker_headers):
        txn_id = f"TEST_TXN_{uuid.uuid4().hex[:8]}"
        payload = {
            "transactions": [
                {
                    "client_txn_id": txn_id,
                    "entity_type": "pregnancy",
                    "payload": {
                        "full_name": f"TEST_Offline_{uuid.uuid4().hex[:6]}",
                        "age": 25,
                        "mobile_number": f"96{uuid.uuid4().int % 100000000:08d}",
                        "address": "Off",
                        "village": "Rampur",
                        "lmp": "2025-08-01",
                    },
                }
            ]
        }
        r = api.post(f"{BASE_URL}/api/sync", headers=worker_headers, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total_processed"] == 1
        assert data["results"][0]["status"] in ("SYNCED_SUCCESS", "SKIPPED_DUPLICATE")

    def test_offline_sync_dedupe(self, api, worker_headers):
        # sending same mobile twice - second should be SKIPPED_DUPLICATE
        mobile = f"95{uuid.uuid4().int % 100000000:08d}"
        payload = {
            "transactions": [
                {
                    "client_txn_id": f"DUP1_{uuid.uuid4().hex[:6]}",
                    "entity_type": "pregnancy",
                    "payload": {
                        "full_name": "TEST_Dedup",
                        "age": 27,
                        "mobile_number": mobile,
                        "address": "Addr",
                        "village": "Rampur",
                        "lmp": "2025-07-01",
                    },
                }
            ]
        }
        r1 = api.post(f"{BASE_URL}/api/sync", headers=worker_headers, json=payload)
        assert r1.status_code == 200
        payload["transactions"][0]["client_txn_id"] = f"DUP2_{uuid.uuid4().hex[:6]}"
        r2 = api.post(f"{BASE_URL}/api/sync", headers=worker_headers, json=payload)
        assert r2.status_code == 200
        assert r2.json()["results"][0]["status"] == "SKIPPED_DUPLICATE"


# ---------------- ADMIN ----------------
class TestAdmin:
    def test_admin_kpis(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/kpis", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # Shape checks
        assert any(k in data for k in ["kpis", "total_pregnancies", "total_workers"])
        assert any(k in data for k in ["trimester_breakdown", "village_stats", "worker_performance"])
