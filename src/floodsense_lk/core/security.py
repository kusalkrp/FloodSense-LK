"""Security helpers: PII hashing, AES-256-GCM encryption, admin key verification."""

import base64
import hashlib
import hmac
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from floodsense_lk.core.exceptions import AdminAuthError


def hash_pii(value: str, salt: str) -> str:
    """SHA256-HMAC hash of a PII value (phone/email) with the app salt.

    Returns a hex digest safe to store in the database.
    Never store or log the raw value.
    """
    if not salt:
        raise ValueError("ALERT_SALT must be set before hashing PII")
    return hmac.new(salt.encode(), value.encode(), hashlib.sha256).hexdigest()


def _derive_key(raw_key: str) -> bytes:
    """Derive a 32-byte AES key from the configured string via SHA-256."""
    return hashlib.sha256(raw_key.encode()).digest()


def encrypt_pii(value: str, encryption_key: str) -> str:
    """AES-256-GCM encrypt a PII string. Returns a base64-encoded token.

    Format: base64(nonce[12] + ciphertext + tag[16])
    A fresh 12-byte nonce is generated per call (safe to reuse key across calls).
    """
    key = _derive_key(encryption_key)
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(nonce, value.encode(), None)  # associated_data=None
    return base64.b64encode(nonce + ct).decode()


def decrypt_pii(token: str, encryption_key: str) -> str:
    """Decrypt a token produced by encrypt_pii. Raises ValueError on tampering."""
    key = _derive_key(encryption_key)
    raw = base64.b64decode(token.encode())
    nonce, ct = raw[:12], raw[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None).decode()


def verify_admin_key(provided: str, expected: str) -> None:
    """Raise AdminAuthError if the provided key does not match.

    Uses constant-time comparison to prevent timing attacks.
    """
    if not expected:
        raise AdminAuthError("ADMIN_API_KEY is not configured")
    if not hmac.compare_digest(provided.encode(), expected.encode()):
        raise AdminAuthError("Invalid admin API key")
