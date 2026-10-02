"""THE contract a fintech adapter implements. Paystack, OPay, Moniepoint, Ecobank, Verve ... all reduce to this.

Required (abstract): identity + capabilities, collection creation/verification, webhook authentication + parsing.
Optional (declared in `capabilities`): virtual accounts, payouts, statement listing, account-name lookup.
An adapter that claims a capability MUST implement it; one that doesn't inherits methods raising `NotSupported`.
`app/payments/contract.py` is the test-kit that enforces this - run it against every new adapter."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Iterator, Mapping

from app.payments.domain import (
    Capabilities, CollectionRequest, CollectionSession, PayoutDestination, PayoutRequest, PayoutResult,
    ProviderTransaction, VerificationResult, VirtualAccount, VirtualAccountRequest, WebhookEvent,
)
from app.payments.errors import NotSupported


class PaymentProvider(ABC):
    #: stable machine name stored on every Payment/Payout/VirtualAccount row ("sandbox", "ecobank", "paystack", ...).
    #: Old rows keep resolving to their original provider after you switch, so NEVER rename it once live.
    name: str
    #: prefix of the references WE generate for this provider. Some rails restrict length/charset - adapters may override.
    reference_prefix: str = "CREW-"

    @property
    @abstractmethod
    def capabilities(self) -> Capabilities: ...

    # ------------------------------------------------------------------ collections (required)
    @abstractmethod
    def create_collection(self, req: CollectionRequest) -> CollectionSession:
        """Start a payment. Must be idempotent on `req.reference`: repeating the call returns the same session, never a second charge."""

    @abstractmethod
    def verify_collection(self, reference: str, expected_kobo: int | None = None) -> VerificationResult:
        """Ask the provider for the truth about `reference`. Read-only, safe to call repeatedly.
        Return PENDING (not an error) while the payer hasn't paid. ALWAYS report the amount the PROVIDER received:
        `expected_kobo` is only a hint (for a provider whose verify call wants it, or a sandbox with no real rail) and
        must never be echoed back by a real adapter."""

    # ------------------------------------------------------------------ webhooks (required when capabilities.webhooks)
    @abstractmethod
    def verify_webhook(self, headers: Mapping[str, str], body: bytes) -> None:
        """Authenticate the raw request (HMAC / shared secret / IP allow-list ...). Raise `SignatureInvalid` on failure.
        `headers` keys are lower-cased. Must use constant-time comparison. Never log the secret or the signature."""

    @abstractmethod
    def parse_webhook(self, body: bytes) -> list[WebhookEvent]:
        """Translate the provider payload into canonical events (one payload may hold several). Raise `MalformedPayload`
        if unparseable. Unknown-but-valid event types map to `WebhookEventType.IGNORED`, they don't raise."""

    # ------------------------------------------------------------------ virtual accounts (optional)
    def open_virtual_account(self, req: VirtualAccountRequest) -> VirtualAccount:
        """Idempotent on `req.reference`: same reference -> same account."""
        raise NotSupported(f"{self.name}: virtual accounts")

    def get_virtual_account(self, reference: str) -> VirtualAccount:
        raise NotSupported(f"{self.name}: virtual accounts")

    def close_virtual_account(self, reference: str) -> VirtualAccount:
        raise NotSupported(f"{self.name}: virtual accounts")

    # ------------------------------------------------------------------ payouts (optional)
    def initiate_payout(self, req: PayoutRequest) -> PayoutResult:
        """Idempotent on `req.reference`: a retry after a timeout must return the original payout, never pay twice.
        Most rails answer PENDING first; the final state arrives by webhook or `get_payout`."""
        raise NotSupported(f"{self.name}: payouts")

    def get_payout(self, reference: str) -> PayoutResult:
        raise NotSupported(f"{self.name}: payouts")

    def resolve_account(self, bank_code: str, account_number: str) -> PayoutDestination:
        """Look up the registered name for a bank account, so we never pay an account the creator mistyped."""
        raise NotSupported(f"{self.name}: account name lookup")

    # ------------------------------------------------------------------ statement (optional, powers reconciliation)
    def list_transactions(self, since: datetime, until: datetime) -> Iterator[ProviderTransaction]:
        """Yield every money movement in [since, until) from the provider's OWN records, oldest first.
        Handle pagination inside; the caller just iterates. Amounts gross, fees separate."""
        raise NotSupported(f"{self.name}: statement")
