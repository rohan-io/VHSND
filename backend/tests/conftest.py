import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://anc-tracker-app.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def worker_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "worker01", "password": "Worker@123"})
    assert r.status_code == 200, f"Worker login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def worker_headers(worker_token):
    return {"Authorization": f"Bearer {worker_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
