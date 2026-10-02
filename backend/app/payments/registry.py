"""Provider registry: how the rest of the app finds an adapter. Switching fintech = register one factory + change env.

  PAYMENT_PROVIDER=ecobank        # new collections / virtual accounts
  PAYOUT_PROVIDER=paystack        # optional: pay creators through a different rail (defaults to PAYMENT_PROVIDER)

Rows already in the database remember the provider that handled them (`provider` column), and are always verified,
reconciled and webhook-routed through THAT adapter - so changing the env var never orphans in-flight payments."""
from __future__ import annotations

from typing import Callable

from app.config import get_settings
from app.payments.errors import ProviderNotConfigured
from app.payments.ports import PaymentProvider

_factories: dict[str, Callable[[], PaymentProvider]] = {}


def register(name: str, factory: Callable[[], PaymentProvider]) -> None:
    _factories[name] = factory


def known() -> list[str]:
    return sorted(_factories)


def get(name: str | None = None) -> PaymentProvider:
    name = name or get_settings().payment_provider
    if name not in _factories:
        raise ProviderNotConfigured(f"Unknown payment provider '{name}'. Registered: {', '.join(known()) or 'none'}")
    return _factories[name]()


def for_collections() -> PaymentProvider:
    return get(get_settings().payment_provider)


def for_payouts() -> PaymentProvider:
    return get(get_settings().payout_provider or get_settings().payment_provider)


def _bootstrap() -> None:
    from app.payments.adapters.ecobank import EcobankProvider
    from app.payments.adapters.sandbox import SandboxProvider
    from app.payments.adapters.verve import VerveProvider
    register("sandbox", SandboxProvider)
    register("ecobank", EcobankProvider)
    register("verve", VerveProvider)


_bootstrap()
