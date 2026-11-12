"""
Test credits for the invite-only beta.

Every signed-in person gets REWIRE_TEST_CREDITS credits (default 60) the first time they use Rewire. Analyses cost by
length, since GPU time grows with it: one credit per REWIRE_SECONDS_PER_CREDIT seconds of video (default 10, so about
the GPU cost of ten seconds), rounded up per video, at least one. A 30-second ad costs 3; comparing two costs 6.
Credits are taken when an analysis starts (once the videos' lengths are measured) and given back if it fails or is
cancelled. When the grant is raised, everyone who started under a lower one gets the difference. Admins (REWIRE_ADMINS, comma-separated Clerk user ids) can see every tester and add credits.

Each user's ledger is a small JSON file next to their runs (data/users/<id>/credits.json): the balance, totals, the
email they signed in with (for the admin list), and a history of every change. The API is the only writer (it runs
as one container), and a lock keeps concurrent requests from racing.

Without sign-in (local development) credits are not enforced.
"""
import json
import math
import os
import re
import threading
import time
from pathlib import Path

import auth
import runs

GRANT = int(os.environ.get("REWIRE_TEST_CREDITS", "60"))
SECONDS_PER_CREDIT = max(1, int(os.environ.get("REWIRE_SECONDS_PER_CREDIT", "10")))
GRACE_S = 0.5
ADMINS = {u.strip() for u in os.environ.get("REWIRE_ADMINS", "").split(",") if u.strip()}
HISTORY_KEPT = 200

_lock = threading.Lock()


class InsufficientCredits(Exception):
    def __init__(self, needed: int, balance: int):
        self.needed, self.balance = needed, balance
        super().__init__(f"This analysis needs {needed} credit{'s' if needed != 1 else ''}; you have {balance} left. "
                         "Ask the Rewire team for more.")


def enforced() -> bool:
    return auth.ENABLED


def is_admin(user: str | None = None) -> bool:
    return (user or auth.current_user()) in ADMINS


def cost(seconds: list[float]) -> int:
    """Credits for an analysis of videos of these lengths: per video, one per started SECONDS_PER_CREDIT, at least 1."""
    # Half a second of grace, so a 30.03-second "30-second ad" isn't charged for a fourth block of 10.
    return sum(max(1, math.ceil(max(0.0, s - GRACE_S) / SECONDS_PER_CREDIT - 1e-9)) for s in seconds) or 1


def _path(user: str) -> Path:
    return runs.DATA_DIR / "users" / user / "credits.json"


def _read(user: str) -> dict:
    path = _path(user)
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    # First use: the beta grant.
    now = time.time()
    return {"balance": GRANT, "granted": GRANT, "used": 0, "email": "", "created": now, "grant_level": GRANT,
            "history": [{"at": now, "change": GRANT, "reason": "Beta test credits", "balance": GRANT}]}


def _raise_grant(ledger: dict) -> bool:
    """If the beta grant went up since this person started, add the difference. Returns whether it changed."""
    level = ledger.get("grant_level", ledger["history"][0]["change"] if ledger.get("history") else GRANT)
    if GRANT <= level:
        ledger.setdefault("grant_level", level)
        return False
    extra = GRANT - level
    ledger["balance"] += extra
    ledger["granted"] += extra
    ledger["grant_level"] = GRANT
    ledger["history"].append({"at": time.time(), "change": extra, "reason": f"Beta credits raised to {GRANT}", "balance": ledger["balance"]})
    return True


def _write(user: str, ledger: dict):
    path = _path(user)
    path.parent.mkdir(parents=True, exist_ok=True)
    ledger["history"] = ledger["history"][-HISTORY_KEPT:]
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(ledger, indent=1))
    tmp.replace(path)


def _change(user: str, change: int, reason: str, ref: str | None = None) -> dict:
    ledger = _read(user)
    ledger["balance"] += change
    if change < 0 and ref and not reason.startswith("Refund"):
        ledger["used"] += -change
    elif change > 0 and reason.startswith("Refund"):
        ledger["used"] = max(0, ledger["used"] - change)
    elif change > 0:
        ledger["granted"] += change
    ledger["history"].append({"at": time.time(), "change": change, "reason": reason, "ref": ref, "balance": ledger["balance"]})
    _write(user, ledger)
    return ledger


def summary(user: str | None = None, email: str | None = None) -> dict:
    """The user's balance (created with the beta grant on first use). Records their email for the admin list."""
    user = user or auth.current_user()
    if not enforced():
        return {"enforced": False, "balance": None, "seconds_per_credit": SECONDS_PER_CREDIT, "admin": False}
    with _lock:
        ledger = _read(user)
        fresh = not _path(user).exists()
        fresh = _raise_grant(ledger) or fresh
        if email and EMAIL.fullmatch(email) and ledger.get("email") != email:
            ledger["email"] = email
            fresh = True
        if fresh:
            _write(user, ledger)
    return {"enforced": True, "balance": ledger["balance"], "granted": ledger["granted"], "used": ledger["used"],
            "seconds_per_credit": SECONDS_PER_CREDIT, "admin": is_admin(user)}


def charge(seconds: list[float], ref: str) -> int:
    """Takes the credits for an analysis of videos of these lengths, or raises InsufficientCredits. Returns the amount."""
    if not enforced():
        return 0
    amount = cost(seconds)
    user = auth.current_user()
    with _lock:
        ledger = _read(user)
        if _raise_grant(ledger):
            _write(user, ledger)
        if ledger["balance"] < amount:
            raise InsufficientCredits(amount, ledger["balance"])
        lengths = " and ".join(f"{round(s)}s" for s in seconds)
        _change(user, -amount, f"Analysis of {len(seconds)} video{'s' if len(seconds) != 1 else ''} ({lengths})", ref)
    return amount


def refund(amount: int, ref: str, why: str):
    """Gives back credits taken for an analysis that did not finish."""
    if not enforced() or amount <= 0:
        return
    with _lock:
        _change(auth.current_user(), amount, f"Refund: {why}", ref)


def grant(user: str, amount: int, reason: str = "Added by the Rewire team") -> dict:
    """Adds (or, with a negative amount, removes) credits for any user. Admin use."""
    if not auth.USER_ID.fullmatch(user):
        raise ValueError("Not a valid user id")
    with _lock:
        ledger = _change(user, amount, reason)
    return {"user": user, "balance": ledger["balance"]}


def everyone() -> list[dict]:
    """Every user with a ledger: who they are, their balance and usage, newest activity first. Admin use."""
    base = runs.DATA_DIR / "users"
    out = []
    for path in base.glob("*/credits.json") if base.exists() else []:
        try:
            ledger = json.loads(path.read_text())
        except Exception:
            continue
        user = path.parent.name
        runs_dir = path.parent / "runs"
        out.append({
            "user": user, "email": ledger.get("email", ""), "balance": ledger["balance"], "granted": ledger["granted"],
            "used": ledger["used"], "analyses": sum(1 for p in runs_dir.iterdir() if (p / "run.json").exists()) if runs_dir.exists() else 0,
            "last": max((h["at"] for h in ledger["history"]), default=ledger.get("created", 0)), "admin": user in ADMINS,
        })
    return sorted(out, key=lambda r: r["last"], reverse=True)


EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}$")
