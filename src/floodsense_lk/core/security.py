"""Security helpers: admin key verification."""

import hmac

from floodsense_lk.core.exceptions import AdminAuthError


def verify_admin_key(provided: str, expected: str) -> None:
    """Raise AdminAuthError if the provided key does not match.

    Uses constant-time comparison to prevent timing attacks.
    """
    if not expected:
        raise AdminAuthError("ADMIN_API_KEY is not configured")
    if not hmac.compare_digest(provided.encode(), expected.encode()):
        raise AdminAuthError("Invalid admin API key")
