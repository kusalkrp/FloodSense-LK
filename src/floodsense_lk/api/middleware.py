"""Rate limiting middleware — 30 req/min per IP using slowapi."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])
