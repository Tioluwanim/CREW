"""Shared HTTP plumbing for adapters: one place for timeouts, retries and error mapping.

Adapters depend on the small `HttpClient` port, not on httpx, so tests inject `FakeHttp` and replay recorded provider
responses without network access. Retry policy is deliberately conservative:
  * GET/HEAD are retried on timeouts and 5xx;
  * POST/PUT/DELETE are retried ONLY when the caller passes an idempotency key the provider honours
    (otherwise a retried payout could pay twice)."""
from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable

from app.payments.errors import ProviderAuthError, ProviderRejected, ProviderUnavailable

log = logging.getLogger("crew.payments.http")
SENSITIVE = {"authorization", "x-api-key", "apikey", "secret", "client_secret", "password", "token", "access_token", "pin", "cvv"}


@dataclass
class HttpResponse:
    status: int
    body: Any = None            # parsed JSON when the response is JSON, else text
    headers: dict[str, str] = field(default_factory=dict)


class HttpTransportError(Exception):
    """Connection failure / timeout raised by a transport (mapped to ProviderUnavailable)."""


class HttpClient(ABC):
    @abstractmethod
    def request(self, method: str, url: str, *, headers: dict[str, str] | None = None, json: Any = None,
                params: dict[str, Any] | None = None, timeout: float = 15.0) -> HttpResponse: ...


class HttpxClient(HttpClient):
    def request(self, method, url, *, headers=None, json=None, params=None, timeout=15.0) -> HttpResponse:
        import httpx
        try:
            r = httpx.request(method, url, headers=headers, json=json, params=params, timeout=timeout)
        except (httpx.TimeoutException, httpx.TransportError) as e:
            raise HttpTransportError(type(e).__name__) from e
        try:
            body: Any = r.json()
        except ValueError:
            body = r.text
        return HttpResponse(r.status_code, body, {k.lower(): v for k, v in r.headers.items()})


def redact(data: Any) -> Any:
    """Strip secrets from anything that might be logged or stored as `raw`."""
    if isinstance(data, dict):
        return {k: "***" if str(k).lower() in SENSITIVE else redact(v) for k, v in data.items()}
    if isinstance(data, list):
        return [redact(x) for x in data]
    return data


class ProviderHttp:
    """What adapters call. Maps every failure to the `ProviderError` family."""

    def __init__(self, base_url: str, client: HttpClient | None = None, *, default_headers: dict[str, str] | None = None,
                 max_attempts: int = 3, backoff_s: float = 0.4, timeout: float = 15.0, sleep: Callable[[float], None] = time.sleep):
        self.base_url, self.client = base_url.rstrip("/"), client or HttpxClient()
        self.default_headers, self.max_attempts, self.backoff, self.timeout, self.sleep = default_headers or {}, max_attempts, backoff_s, timeout, sleep

    def call(self, method: str, path: str, *, json: Any = None, params: dict[str, Any] | None = None,
             headers: dict[str, str] | None = None, idempotent: bool | None = None) -> Any:
        """`idempotent=True` declares the call safe to repeat (GETs by default; POSTs only with a provider-honoured key)."""
        method = method.upper()
        safe = (method in ("GET", "HEAD")) if idempotent is None else idempotent
        attempts = self.max_attempts if safe else 1
        url = f"{self.base_url}/{path.lstrip('/')}"
        last: Exception | None = None
        for i in range(attempts):
            try:
                resp = self.client.request(method, url, headers={**self.default_headers, **(headers or {})}, json=json, params=params, timeout=self.timeout)
            except HttpTransportError as e:
                last = ProviderUnavailable(f"{method} {path}: {e}")
            else:
                if resp.status < 300:
                    return resp.body
                if resp.status in (401, 403):
                    raise ProviderAuthError(f"{method} {path}: credentials rejected ({resp.status})")
                if resp.status == 429 or resp.status >= 500:
                    last = ProviderUnavailable(f"{method} {path}: HTTP {resp.status}")
                else:
                    msg = resp.body.get("message") if isinstance(resp.body, dict) else None
                    raise ProviderRejected(msg or f"{method} {path}: HTTP {resp.status}", code=str(resp.status))
            if i < attempts - 1:
                self.sleep(self.backoff * (2 ** i))
        log.warning("provider call failed after %d attempt(s): %s", attempts, last)
        raise last  # type: ignore[misc]
