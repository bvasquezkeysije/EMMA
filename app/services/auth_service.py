from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.db import HAS_DB, get_connection

SESSION_TTL_HOURS = 3

ADMIN_USER = "admin"
ADMIN_PASS = "123"


@dataclass
class SessionData:
    username: str
    last_activity: datetime


class AuthService:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionData] = {}

    def validate_credentials(self, username: str, password: str) -> bool:
        if username == ADMIN_USER and password == ADMIN_PASS:
            return True
        if not HAS_DB:
            return False
        try:
            with get_connection() as conn:
                row = conn.execute(
                    "SELECT password_hash, is_active FROM users WHERE username = %s LIMIT 1",
                    (username,),
                ).fetchone()
                if not row:
                    return False
                if not row["is_active"]:
                    return False
                return str(row["password_hash"] or "") == password
        except Exception:
            return False

    def create_session(self, username: str) -> str:
        sid = str(uuid4())
        self._sessions[sid] = SessionData(
            username=username,
            last_activity=datetime.now(timezone.utc),
        )
        return sid

    def get_session_user(self, sid: str) -> str | None:
        session = self._sessions.get(sid)
        if not session:
            return None
        now = datetime.now(timezone.utc)
        if now - session.last_activity > timedelta(hours=SESSION_TTL_HOURS):
            self._sessions.pop(sid, None)
            return None
        session.last_activity = now
        return session.username

    def remove_session(self, sid: str) -> None:
        self._sessions.pop(sid, None)


auth_service = AuthService()

