"""Subscription routes — POST /api/v1/subscribe, DELETE /api/v1/unsubscribe"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from floodsense_lk.services.subscriber_service import (
    create_subscriber,
    deactivate_subscriber,
    verify_subscriber,
)

router = APIRouter(prefix="/api/v1", tags=["subscribe"])

_VALID_SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
_VALID_CHANNELS = {"WHATSAPP", "SMS", "EMAIL"}
_VALID_LANGUAGES = {"en", "si"}


class SubscribeRequest(BaseModel):
    phone: str | None = None
    email: str | None = None
    basins: list[str] = []
    stations: list[str] = []
    min_severity: str = "HIGH"
    channels: list[str] = ["WHATSAPP", "SMS"]
    language: str = "en"

    @field_validator("min_severity")
    @classmethod
    def valid_severity(cls, v: str) -> str:
        if v.upper() not in _VALID_SEVERITIES:
            raise ValueError(f"min_severity must be one of {_VALID_SEVERITIES}")
        return v.upper()

    @field_validator("channels")
    @classmethod
    def valid_channels(cls, v: list[str]) -> list[str]:
        invalid = set(v) - _VALID_CHANNELS
        if invalid:
            raise ValueError(f"Invalid channels: {invalid}")
        return [c.upper() for c in v]

    @field_validator("language")
    @classmethod
    def valid_language(cls, v: str) -> str:
        if v not in _VALID_LANGUAGES:
            raise ValueError(f"language must be one of {_VALID_LANGUAGES}")
        return v


class UnsubscribeRequest(BaseModel):
    phone: str


class VerifyRequest(BaseModel):
    phone: str
    # OTP verification is stubbed — full OTP flow is out of scope for Phase 4
    otp: str


@router.post("/subscribe", status_code=201)
async def subscribe(req: SubscribeRequest) -> dict:
    if not req.phone and not req.email:
        raise HTTPException(status_code=422, detail="phone or email required")

    sub_id = await create_subscriber(
        phone=req.phone,
        email=req.email,
        basins=req.basins,
        stations=req.stations,
        min_severity=req.min_severity,
        channels=req.channels,
        language=req.language,
    )
    return {
        "status": "subscribed",
        "id": sub_id,
        "note": "Verify your number to activate alerts.",
    }


@router.post("/verify")
async def verify(req: VerifyRequest) -> dict:
    """Mark subscriber as verified. OTP check is stubbed for Phase 4."""
    # TODO Phase 5: verify OTP via Twilio Verify before calling verify_subscriber
    await verify_subscriber(req.phone)
    return {"status": "verified"}


@router.delete("/unsubscribe")
async def unsubscribe(req: UnsubscribeRequest) -> dict:
    removed = await deactivate_subscriber(req.phone)
    if not removed:
        raise HTTPException(status_code=404, detail="subscriber_not_found")
    return {"status": "unsubscribed"}
