"""Waterdrop Survivor - backend: saves, runs, leaderboard, Google auth, Stripe paywall."""
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response, Cookie, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# Stripe integration via emergent library
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
GAME_PRICE_USD = float(os.environ.get("GAME_PRICE_USD", "1.99"))
GAME_TITLE = os.environ.get("GAME_TITLE", "Waterdrop Survivor")

# Emergent auth — fixed URL per playbook
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Waterdrop Survivor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
#                         MODELS
# ============================================================

class SaveData(BaseModel):
    player_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    data: Dict[str, Any]


class RunResult(BaseModel):
    player_id: str
    duration: float
    level: int
    kills: int
    gold: int
    wave: int


class ScoreSubmit(BaseModel):
    time: float
    level: int
    kills: int
    victory: bool = False
    no_hit: bool = False


class PaymentCheckoutReq(BaseModel):
    origin_url: str


# ============================================================
#                      AUTH HELPERS
# ============================================================

async def get_current_user(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> Optional[Dict[str, Any]]:
    """Look up the current user from session_token cookie OR Bearer header."""
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    if not token:
        return None
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    expires_at = sess.get("expires_at")
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at)
        except Exception:
            return None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    return user


async def require_user(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    user = await get_current_user(session_token=session_token, authorization=authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ============================================================
#                         HEALTH / SAVE / RUN
# ============================================================

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "waterdrop-survivor", "price_usd": GAME_PRICE_USD}


@app.get("/api/save/{player_id}")
async def get_save(player_id: str):
    doc = await db.saves.find_one({"player_id": player_id}, {"_id": 0})
    if not doc:
        return {"player_id": player_id, "data": None}
    return {"player_id": player_id, "data": doc.get("data")}


@app.post("/api/save")
async def post_save(payload: SaveData):
    now = datetime.now(timezone.utc).isoformat()
    await db.saves.update_one(
        {"player_id": payload.player_id},
        {"$set": {"data": payload.data, "updated_at": now}},
        upsert=True,
    )
    return {"player_id": payload.player_id, "saved_at": now}


@app.post("/api/run-result")
async def post_run(payload: RunResult):
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc["created_at"] = now
    doc["id"] = str(uuid.uuid4())
    await db.runs.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


# ============================================================
#                      EMERGENT GOOGLE AUTH
# ============================================================
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

@app.post("/api/auth/session")
async def auth_exchange(request: Request, response: Response):
    """Exchange a session_id from the URL fragment for a long-lived session_token."""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # Call Emergent's session-data endpoint (must be server-side per playbook)
    async with httpx.AsyncClient(timeout=15) as http:
        try:
            r = await http.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": session_id})
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"auth upstream error: {exc}")
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail=f"emergent auth rejected ({r.status_code})")
    payload = r.json()

    email = payload.get("email")
    name = payload.get("name")
    picture = payload.get("picture")
    session_token = payload.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=502, detail="invalid auth payload")

    # Upsert user (custom user_id, NEVER expose _id)
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    now = datetime.now(timezone.utc)
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_login": now.isoformat()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": now.isoformat(),
            "last_login": now.isoformat(),
        })

    # Store session with 7-day expiry
    expires_at = now + timedelta(days=7)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": now,
        }},
        upsert=True,
    )

    # Set httpOnly cookie (cross-site for prod)
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7 * 24 * 60 * 60,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )

    return {"user_id": user_id, "email": email, "name": name, "picture": picture}


@app.get("/api/auth/me")
async def auth_me(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@app.post("/api/auth/logout")
async def auth_logout(
    response: Response,
    session_token: Optional[str] = Cookie(None),
):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}


# ============================================================
#                     STRIPE PAYWALL ($1.99 one-time)
# ============================================================

@app.get("/api/entitlement")
async def get_entitlement(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    if not user:
        return {"paid": False, "user": None, "price_usd": GAME_PRICE_USD, "title": GAME_TITLE}
    ent = await db.entitlements.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {
        "paid": bool(ent and ent.get("paid")),
        "user": {"name": user.get("name"), "email": user.get("email"), "picture": user.get("picture")},
        "price_usd": GAME_PRICE_USD,
        "title": GAME_TITLE,
    }


@app.post("/api/payment/checkout")
async def create_checkout(
    payload: PaymentCheckoutReq,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Login required to purchase")

    # If already entitled, no need
    ent = await db.entitlements.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if ent and ent.get("paid"):
        return {"already_paid": True}

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    # Frontend supplies origin; backend supplies amount (security: never trust price from FE)
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/?stripe_session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/?stripe_cancelled=1"

    metadata = {
        "user_id": user["user_id"],
        "email": user.get("email", ""),
        "product": "waterdrop-survivor-unlock",
    }
    req = CheckoutSessionRequest(
        amount=GAME_PRICE_USD,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(req)

    # Create pending transaction record (MANDATORY per playbook)
    now = datetime.now(timezone.utc)
    await db.payment_transactions.insert_one({
        "transaction_id": f"tx_{uuid.uuid4().hex[:16]}",
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "email": user.get("email"),
        "amount": GAME_PRICE_USD,
        "currency": "usd",
        "payment_status": "initiated",
        "status": "pending",
        "metadata": metadata,
        "created_at": now.isoformat(),
    })

    return {"url": session.url, "session_id": session.session_id}


@app.get("/api/payment/status/{session_id}")
async def payment_status(
    session_id: str,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(session_token=session_token, authorization=authorization)

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    status_resp = await stripe_checkout.get_checkout_status(session_id)

    # Update transaction record (idempotently)
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    already_processed = bool(tx and tx.get("status") == "complete")

    new_status = "complete" if status_resp.payment_status == "paid" else (
        "expired" if status_resp.status == "expired" else "pending"
    )
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": status_resp.payment_status,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # Grant entitlement ONCE on first successful poll
    if status_resp.payment_status == "paid" and not already_processed:
        meta_user_id = (status_resp.metadata or {}).get("user_id") if status_resp.metadata else None
        target_user_id = meta_user_id or (user and user.get("user_id")) or (tx and tx.get("user_id"))
        if target_user_id:
            await db.entitlements.update_one(
                {"user_id": target_user_id},
                {"$set": {
                    "user_id": target_user_id,
                    "paid": True,
                    "stripe_session_id": session_id,
                    "amount_usd": GAME_PRICE_USD,
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )

    return {
        "payment_status": status_resp.payment_status,
        "status": status_resp.status,
        "amount_total": status_resp.amount_total,
        "currency": status_resp.currency,
    }


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Webhook handler — defensive, even though we also use polling."""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        evt = await stripe_checkout.handle_webhook(body, signature)
    except Exception as exc:
        # Don't crash on webhook errors
        return {"ok": False, "error": str(exc)}

    if evt.payment_status == "paid":
        meta = evt.metadata or {}
        user_id = meta.get("user_id")
        if user_id:
            await db.entitlements.update_one(
                {"user_id": user_id},
                {"$set": {
                    "user_id": user_id,
                    "paid": True,
                    "stripe_session_id": evt.session_id,
                    "amount_usd": GAME_PRICE_USD,
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
        await db.payment_transactions.update_one(
            {"session_id": evt.session_id},
            {"$set": {"payment_status": "paid", "status": "complete"}},
        )
    return {"ok": True}


# ============================================================
#                       LEADERBOARD
# ============================================================

@app.post("/api/leaderboard/submit")
async def leaderboard_submit(
    payload: ScoreSubmit,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    user = await get_current_user(session_token=session_token, authorization=authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Login required to submit score")
    now = datetime.now(timezone.utc)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "name": user.get("name") or user.get("email", "Anonymous").split("@")[0],
        "picture": user.get("picture"),
        "time": payload.time,
        "level": payload.level,
        "kills": payload.kills,
        "victory": payload.victory,
        "no_hit": payload.no_hit,
        "created_at": now.isoformat(),
    }
    await db.leaderboard.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@app.get("/api/leaderboard")
async def leaderboard(limit: int = 50, sort_by: str = "time"):
    """Sorted leaderboard. sort_by ∈ {'time','kills','level'} (desc)."""
    sort_field = sort_by if sort_by in ("time", "kills", "level") else "time"
    cursor = db.leaderboard.find({}, {"_id": 0}).sort(sort_field, -1).limit(limit)
    rows = [doc async for doc in cursor]
    # Fallback: include legacy runs collection if leaderboard is empty
    if not rows:
        legacy_cursor = db.runs.find({}, {"_id": 0}).sort("duration", -1).limit(limit)
        async for doc in legacy_cursor:
            rows.append({
                "name": "Legacy Run",
                "time": doc.get("duration", 0),
                "level": doc.get("level", 1),
                "kills": doc.get("kills", 0),
                "victory": False,
                "no_hit": False,
                "created_at": doc.get("created_at"),
            })
    return rows
