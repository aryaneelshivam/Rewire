"""
Who is making each request, and signed links for media.

Sign-in is Clerk. The browser sends Clerk's session token as `Authorization: Bearer <token>`; this module checks it
against Clerk's public signing keys and returns the user id. Only the publishable key is needed (it names the Clerk
instance), so no Clerk secret lives on this server.

  CLERK_PUBLISHABLE_KEY      pk_test_... or pk_live_...; without it, sign-in is off and everything belongs to one
                             local user, as before. VITE_CLERK_PUBLISHABLE_KEY is read too, so one .env can serve both.
  CLERK_AUTHORIZED_PARTIES   comma-separated origins the app is served from (default: the local dev server)
  REWIRE_AUTH=off            turn sign-in off even when a key is set
  REWIRE_MEDIA_SECRET        key for signed media links; generated and kept in backend/data/ when not set

<video> and <img> cannot send a token, so the API hands out short-lived signed links for a run's videos and images.
"""
import base64
import contextvars
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _load_dotenv(path: Path):
    """KEY=VALUE lines from backend/.env, without overriding the real environment."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_dotenv(HERE / ".env")

LOCAL_USER = "local"
_user: contextvars.ContextVar[str] = contextvars.ContextVar("rewire_user", default=LOCAL_USER)


def current_user() -> str:
    return _user.get()


def set_user(user_id: str):
    return _user.set(user_id)


def reset_user(token):
    _user.reset(token)


class AuthError(Exception):
    pass


PUBLISHABLE_KEY = os.environ.get("CLERK_PUBLISHABLE_KEY") or os.environ.get("VITE_CLERK_PUBLISHABLE_KEY") or ""
ENABLED = bool(PUBLISHABLE_KEY) and os.environ.get("REWIRE_AUTH", "on").lower() != "off"
AUTHORIZED_PARTIES = {o.strip().rstrip("/") for o in os.environ.get(
    "CLERK_AUTHORIZED_PARTIES", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()}
USER_ID = re.compile(r"^[A-Za-z0-9_-]{3,64}$")


def frontend_api(publishable_key: str) -> str:
    """The Clerk instance's host, encoded in the publishable key: pk_<env>_<base64 of "host$">."""
    try:
        encoded = publishable_key.split("_", 2)[2]
        host = base64.b64decode(encoded + "=" * (-len(encoded) % 4)).decode().rstrip("$")
    except Exception as exc:
        raise ValueError("CLERK_PUBLISHABLE_KEY is not a valid Clerk publishable key") from exc
    if not re.fullmatch(r"[A-Za-z0-9.-]+", host):
        raise ValueError("CLERK_PUBLISHABLE_KEY is not a valid Clerk publishable key")
    return host


ISSUER = f"https://{frontend_api(PUBLISHABLE_KEY)}" if ENABLED else ""
_jwks = None


def _signing_key(token: str):
    global _jwks
    if _jwks is None:
        import jwt
        _jwks = jwt.PyJWKClient(f"{ISSUER}/.well-known/jwks.json", cache_keys=True, lifespan=3600, timeout=10)
    return _jwks.get_signing_key_from_jwt(token).key


def verify(token: str) -> str:
    """The user id in a valid Clerk session token, or AuthError."""
    import jwt
    try:
        claims = jwt.decode(
            token, _signing_key(token), algorithms=["RS256"], issuer=ISSUER, leeway=5,
            options={"require": ["exp", "iat", "sub", "iss"], "verify_aud": False},
        )
    except Exception as exc:  # expired, wrong signature or issuer, unreachable key endpoint
        raise AuthError("Your session has expired. Sign in again.") from exc
    azp = claims.get("azp")
    if azp and azp.rstrip("/") not in AUTHORIZED_PARTIES:
        raise AuthError("This sign-in is not valid for this app.")
    # A session with unfinished tasks (such as choosing an organisation) is not signed in yet.
    if claims.get("sts") not in (None, "active"):
        raise AuthError("Finish signing in first.")
    user_id = claims["sub"]
    if not USER_ID.fullmatch(user_id):
        raise AuthError("This sign-in is not valid for this app.")
    return user_id


# ── Signed media links ───────────────────────────────────────────────────

def _media_secret() -> bytes:
    value = os.environ.get("REWIRE_MEDIA_SECRET")
    if value:
        return value.encode()
    path = HERE / "data" / ".media_secret"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(secrets.token_urlsafe(48))
        path.chmod(0o600)
    return path.read_text().strip().encode()


_SECRET = _media_secret()
MEDIA_TTL = 12 * 3600
_b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
_unb64 = lambda text: base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign_media(run_id: str, variant: str, kind: str, user_id: str | None = None, ttl: int = MEDIA_TTL) -> str:
    """A token naming one file of one run, for one user, valid for `ttl` seconds."""
    body = _b64(json.dumps({"u": user_id or current_user(), "r": run_id, "v": variant, "k": kind,
                            "e": int(time.time()) + ttl}, separators=(",", ":")).encode())
    mac = _b64(hmac.new(_SECRET, body.encode(), hashlib.sha256).digest()[:24])
    return f"{body}.{mac}"


def read_media(token: str) -> dict:
    """The file a media token names, or AuthError if it was altered or has expired."""
    try:
        body, mac = token.split(".", 1)
        expected = _b64(hmac.new(_SECRET, body.encode(), hashlib.sha256).digest()[:24])
        if not hmac.compare_digest(mac, expected):
            raise ValueError("bad signature")
        claims = json.loads(_unb64(body))
    except Exception as exc:
        raise AuthError("This link is not valid.") from exc
    if claims.get("e", 0) < time.time():
        raise AuthError("This link has expired. Reload the page.")
    return claims
