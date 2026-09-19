from __future__ import annotations

CLIENT_TYPES = {
    "particulier",
    "professionnel",
    "institutionnel",
}

PAYMENT_ALIASES = {
    "orange_money": "orange",
    "mtn_money": "mtn",
    "carte_bancaire": "card",
    "virement": "transfer",
}

SUBMISSION_CHANNELS = {
    "web",
    "android",
    "ios",
    "agent",
    "admin",
    "api",
}


def normalize_client_type(value: str) -> str:
    normalized = str(value or "").strip().lower()

    if normalized == "institution":
        normalized = "institutionnel"

    if normalized not in CLIENT_TYPES:
        raise ValueError("INVALID_CLIENT_TYPE")

    return normalized


def normalize_payment_method(
    value: str | None,
) -> str | None:
    normalized = str(value or "").strip().lower()

    if not normalized:
        return None

    return PAYMENT_ALIASES.get(
        normalized,
        normalized,
    )


def normalize_submission_channel(
    value: str | None,
) -> str:
    normalized = str(value or "").strip().lower()

    if normalized in SUBMISSION_CHANNELS:
        return normalized

    return "web"
