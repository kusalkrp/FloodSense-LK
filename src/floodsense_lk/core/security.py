"""Security helpers: PII hashing, admin key verification."""

import hashlib
import hmac

from floodsense_lk.core.exceptions import AdminAuthError


def hash_pii(value: str, salt: str) -> str:
    """SHA256-HMAC hash of a PII value (phone/email) with the app salt.

    Returns a hex digest safe to store in the database.
    Never store or log the raw value.
    """
    if not salt:
        raise ValueError("ALERT_SALT must be set before hashing PII")
    return hmac.new(salt.encode(), value.encode(), hashlib.sha256).hexdigest()


def verify_admin_key(provided: str, expected: str) -> None:
    """Raise AdminAuthError if the provided key does not match.

    Uses constant-time comparison to prevent timing attacks.
    """
    if not expected:
        raise AdminAuthError("ADMIN_API_KEY is not configured")
    if not hmac.compare_digest(provided.encode(), expected.encode()):
        raise AdminAuthError("Invalid admin API key")
