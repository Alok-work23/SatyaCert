import base64
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main  # noqa: E402
import signing  # noqa: E402
from test_api import FakeCollection, as_institution, marksheet  # noqa: E402


def owned_record(institution_id="inst-A", **kwargs):
    return {**marksheet(**kwargs), "_meta": {"institution_id": institution_id,
                                             "uploaded_at": datetime(2026, 5, 1, tzinfo=timezone.utc)}}


@pytest.fixture(autouse=True)
def signing_key(tmp_path, monkeypatch):
    path = tmp_path / "signing-key.pem"
    path.write_bytes(Ed25519PrivateKey.generate().private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    monkeypatch.setenv("SIGNING_KEY_PATH", str(path))
    monkeypatch.setattr(signing, "_private_key", None)


@pytest.fixture
def collection(monkeypatch):
    col = FakeCollection(owned_record())
    monkeypatch.setattr(main, "get_mongo_collection", lambda: col)
    monkeypatch.setattr(main, "get_log_collection", lambda: FakeCollection())
    return col


@pytest.fixture
def client(collection):
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


# ── Token primitives ────────────────────────────────────────────────────────

def test_token_round_trip():
    payload = signing.read_token(signing.issue_token(owned_record()))
    assert payload["roll"] == "12345"
    assert payload["name"] == "ASHA KUMARI"
    assert payload["fp"] == signing.record_fingerprint(owned_record())


def test_edited_payload_fails_signature():
    payload_part, signature_part = signing.issue_token(owned_record()).split(".")
    forged = json.loads(base64.urlsafe_b64decode(payload_part + "=="))
    forged["cgpa"] = 9.9
    forged_part = base64.urlsafe_b64encode(json.dumps(forged).encode()).rstrip(b"=").decode()
    with pytest.raises(signing.InvalidToken):
        signing.read_token(f"{forged_part}.{signature_part}")


def test_fingerprint_ignores_internal_keys_but_not_content():
    base = signing.record_fingerprint(owned_record())
    assert signing.record_fingerprint({**owned_record(), "_extraction": "ocr"}) == base
    assert signing.record_fingerprint(owned_record(cgpa=9.0)) != base


def test_missing_key_is_reported(monkeypatch):
    monkeypatch.delenv("SIGNING_KEY_PATH")
    with pytest.raises(signing.SigningUnavailable):
        signing.issue_token(owned_record())


# ── Public verification endpoint ────────────────────────────────────────────

def verify(client, token):
    return client.get("/public/verify-qr", params={"token": token}).json()


def test_valid_qr_needs_no_sign_in(client):
    res = verify(client, signing.issue_token(owned_record()))
    assert res["status"] == "VALID"
    assert res["certificate"]["name"] == "ASHA KUMARI"


def test_qr_for_changed_record_is_outdated(client, collection):
    token = signing.issue_token(owned_record())
    collection.record = owned_record(cgpa=7.0)
    assert verify(client, token)["status"] == "OUTDATED"


def test_qr_for_deleted_record_is_revoked(client, collection):
    token = signing.issue_token(owned_record())
    collection.record = None
    assert verify(client, token)["status"] == "REVOKED"


@pytest.mark.parametrize("token", ["garbage", "a.b", ""])
def test_garbage_qr_is_invalid(client, token):
    assert verify(client, token)["status"] == "INVALID"


def test_public_key_is_published(client):
    assert "BEGIN PUBLIC KEY" in client.get("/public/signing-key").text


# ── Issuing QR codes ────────────────────────────────────────────────────────

def issue(client, institution_id):
    main.app.dependency_overrides[main.require_uploader] = lambda: as_institution(institution_id)
    return client.get("/institution/records/qr", params={"roll_no": "12345", "semester": "IV"})


def test_institution_issues_qr_for_own_record(client):
    res = issue(client, "inst-A")
    assert res.status_code == 200
    assert verify(client, res.json()["token"])["status"] == "VALID"


def test_institution_cannot_issue_qr_for_another_institutions_record(client):
    assert issue(client, "inst-B").status_code == 403
