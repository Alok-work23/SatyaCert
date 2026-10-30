"""
Firebase authentication for the API.

Every protected endpoint receives `Authorization: Bearer <Firebase ID token>`.
Roles are never taken from the client:
  - ADMIN        → custom claim `admin: true` (set with set_admin.py)
  - INSTITUTION  → Firestore `institutions` doc owned by the uid with status ACTIVE
"""
from dataclasses import dataclass
import os

from fastapi import Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials, firestore


@dataclass
class CurrentUser:
    uid: str
    email: str | None
    is_admin: bool


@dataclass
class Uploader:
    """A caller allowed to write ground-truth records."""
    user: CurrentUser
    institution_id: str | None  # None when the caller is an admin without an institution


def init_firebase() -> None:
    """Initialise the Admin SDK once. Uses FIREBASE_CREDENTIALS (service-account JSON path) if set."""
    if firebase_admin._apps:
        return
    cred_path = os.getenv("FIREBASE_CREDENTIALS")
    cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred)


def _bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Sign in required.", headers={"WWW-Authenticate": "Bearer"})
    return token


async def get_current_user(request: Request) -> CurrentUser:
    token = _bearer_token(request)
    try:
        decoded = await run_in_threadpool(firebase_auth.verify_id_token, token, None, True)
    except (firebase_auth.RevokedIdTokenError, firebase_auth.UserDisabledError):
        raise HTTPException(status_code=401, detail="Session revoked. Please sign in again.")
    except (firebase_auth.InvalidIdTokenError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired session. Please sign in again.")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Authentication service unavailable: {e}")
    return CurrentUser(uid=decoded["uid"], email=decoded.get("email"), is_admin=decoded.get("admin") is True)


def _active_institution_id(uid: str) -> str | None:
    docs = (
        firestore.client().collection("institutions")
        .where(filter=firestore.FieldFilter("uid", "==", uid))
        .where(filter=firestore.FieldFilter("status", "==", "ACTIVE"))
        .limit(1).get()
    )
    return docs[0].id if docs else None


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return user


async def require_uploader(user: CurrentUser = Depends(get_current_user)) -> Uploader:
    """Only approved institutions (or admins) may write ground-truth records."""
    try:
        institution_id = await run_in_threadpool(_active_institution_id, user.uid)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Could not check institution status: {e}")
    if not institution_id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Only approved institutions can upload certificate records.")
    return Uploader(user=user, institution_id=institution_id)
