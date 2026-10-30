"""
Digitally signed QR codes for certificates.

For each ground-truth record SatyaCert can issue a token: a compact summary of the record
signed with the platform's Ed25519 key. Printed on the certificate as a QR code, it lets anyone
confirm that the details were issued through SatyaCert and have not been altered (offline,
with the public key from /public/signing-key), and, online, that the record is still current.

Token format:  base64url(payload JSON) "." base64url(Ed25519 signature over the payload bytes)
"""
import base64
import hashlib
import json
import os

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

TOKEN_VERSION = 1

_private_key: Ed25519PrivateKey | None = None


class SigningUnavailable(Exception):
    """No signing key is configured on this server."""


class InvalidToken(Exception):
    """The token is malformed or its signature does not verify."""


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _canonical(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str).encode()


def private_key() -> Ed25519PrivateKey:
    """Load the key from SIGNING_KEY_PATH (PEM, created by generate_signing_key.py) once."""
    global _private_key
    if _private_key is None:
        path = os.getenv("SIGNING_KEY_PATH")
        if not path or not os.path.exists(path):
            raise SigningUnavailable("QR signing is not configured on this server (SIGNING_KEY_PATH).")
        with open(path, "rb") as f:
            key = serialization.load_pem_private_key(f.read(), password=None)
        if not isinstance(key, Ed25519PrivateKey):
            raise SigningUnavailable("SIGNING_KEY_PATH must point to an Ed25519 private key.")
        _private_key = key
    return _private_key


def public_key_pem() -> str:
    return private_key().public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()


def record_fingerprint(record: dict) -> str:
    """SHA-256 of the record's content (internal _ keys excluded), so any later change is detectable."""
    content = {k: v for k, v in record.items() if not k.startswith("_")}
    return hashlib.sha256(_canonical(content)).hexdigest()[:32]


def summarize(record: dict) -> dict:
    """The human-readable facts carried in the QR, plus the record fingerprint."""
    sheet = record.get("marksheet", {})
    academic = sheet.get("academic_info", {})
    uploaded_at = record.get("_meta", {}).get("uploaded_at")
    return {
        "v": TOKEN_VERSION,
        "roll": sheet.get("rollNo"),
        "sem": academic.get("semester"),
        "name": sheet.get("student_info", {}).get("name"),
        "cgpa": academic.get("cgpa"),
        "sgpa": academic.get("sgpa"),
        "result": academic.get("result_status"),
        "uni": sheet.get("university"),
        "iat": int(uploaded_at.timestamp()) if uploaded_at else None,
        "fp": record_fingerprint(record),
    }


def issue_token(record: dict) -> str:
    payload = _canonical(summarize(record))
    return f"{_b64encode(payload)}.{_b64encode(private_key().sign(payload))}"


def read_token(token: str) -> dict:
    """Return the signed payload, or raise InvalidToken."""
    try:
        payload_part, signature_part = token.split(".")
        payload, signature = _b64decode(payload_part), _b64decode(signature_part)
    except (ValueError, TypeError):
        raise InvalidToken("This QR code is not a valid SatyaCert code.")
    try:
        private_key().public_key().verify(signature, payload)
    except InvalidSignature:
        raise InvalidToken("Signature check failed: this QR code was not issued by SatyaCert or has been altered.")
    return json.loads(payload)
