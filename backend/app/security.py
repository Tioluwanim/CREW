import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1, dklen=32)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def create_token(user_id: str, version: int = 0) -> str:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=s.jwt_ttl_minutes)
    # HS256 requires a sufficiently long secret; production configuration
    # rejects weak values, while this development default avoids noisy warnings.
    return jwt.encode({"sub": user_id, "tv": version, "exp": exp}, s.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> tuple[str, int] | None:
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        return claims["sub"], int(claims.get("tv", 0))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def verify_signature(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")
