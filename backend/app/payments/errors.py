"""Every adapter failure is one of these, so callers never catch a provider-specific exception."""


class ProviderError(Exception):
    """Base for everything an adapter may raise."""
    retryable = False


class ProviderNotConfigured(ProviderError):
    """Missing credentials / base URL / not implemented yet. Surfaces as HTTP 502 to callers."""


class NotSupported(ProviderError):
    """The provider does not offer this capability (see `Capabilities`). Surfaces as HTTP 501."""


class ProviderUnavailable(ProviderError):
    """Timeout, connection failure, or a 5xx. Safe to retry (idempotent calls only)."""
    retryable = True


class ProviderAuthError(ProviderError):
    """Credentials rejected. Retrying will not help; someone must fix the keys."""


class ProviderRejected(ProviderError):
    """The provider understood and refused (validation, insufficient funds, duplicate). `code` is theirs, for logs."""

    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.code = code


class SignatureInvalid(ProviderError):
    """Webhook authenticity check failed. Never process the payload."""


class MalformedPayload(ProviderError):
    """Webhook/response body was authentic (or unsigned by design) but not parseable into canonical types."""
