from __future__ import annotations

import json
from typing import Any


ADDRESS_NUMBER = "address_number"
QR_CODE = "qr_code"
GPS_LOCATION = "gps_location"
EXTERNAL_NAVIGATION = "external_navigation"
ADDRESS_SHARING = "address_sharing"
PHYSICAL_PLATE = "physical_plate"
INSTALLATION_TRACKING = "installation_tracking"
ENHANCED_PLATE = "enhanced_plate"
PRIORITY_INSTALLATION_72H = "priority_installation_72h"
DETAILED_ACCESS_NOTE = "detailed_access_note"
REPLACEMENT_ASSISTANCE_12M = "replacement_assistance_12m"

BUSINESS_PROFILE = "business_profile"
BUSINESS_MEDIA_HOURS = "business_media_hours"
ADVANCED_STATISTICS = "advanced_statistics"
MULTI_SITE_MANAGEMENT = "multi_site_management"
API_ACCESS = "api_access"


ALL_CAPABILITIES = frozenset(
    {
        ADDRESS_NUMBER,
        QR_CODE,
        GPS_LOCATION,
        EXTERNAL_NAVIGATION,
        ADDRESS_SHARING,
        PHYSICAL_PLATE,
        INSTALLATION_TRACKING,
        ENHANCED_PLATE,
        PRIORITY_INSTALLATION_72H,
        DETAILED_ACCESS_NOTE,
        REPLACEMENT_ASSISTANCE_12M,
        BUSINESS_PROFILE,
        BUSINESS_MEDIA_HOURS,
        ADVANCED_STATISTICS,
        MULTI_SITE_MANAGEMENT,
        API_ACCESS,
    }
)


_DIGITAL_BASELINE = (
    ADDRESS_NUMBER,
    QR_CODE,
    GPS_LOCATION,
    EXTERNAL_NAVIGATION,
    ADDRESS_SHARING,
)


PLAN_DEFAULT_CAPABILITIES = {
    "numerique": _DIGITAL_BASELINE,
    "residentiel_standard": (
        *_DIGITAL_BASELINE,
        PHYSICAL_PLATE,
        INSTALLATION_TRACKING,
    ),
    "residentiel_premium": (
        *_DIGITAL_BASELINE,
        PHYSICAL_PLATE,
        INSTALLATION_TRACKING,
        ENHANCED_PLATE,
        PRIORITY_INSTALLATION_72H,
        DETAILED_ACCESS_NOTE,
        REPLACEMENT_ASSISTANCE_12M,
    ),
    # Professional rights are contractual and must never be
    # auto-granted from the commercial plan code alone.
    "pro": (),
}


LEGACY_ADDRESS_CAPABILITIES = _DIGITAL_BASELINE

INSTALLATION_REQUIREMENTS_VERSION = 1
INSTALLATION_GPS_MEASURE_COUNT = 3
INSTALLATION_GPS_MAX_ACCURACY_M = 3.0


def _json_value(value: Any) -> Any:
    if not isinstance(value, str):
        return value

    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def normalize_capabilities(
    value: Any,
) -> list[str]:
    candidate = _json_value(value)

    if candidate is None:
        return []

    if not isinstance(
        candidate,
        (list, tuple, set),
    ):
        raise ValueError(
            "CAPABILITIES_MUST_BE_ARRAY"
        )

    normalized: list[str] = []
    seen: set[str] = set()

    for raw in candidate:
        code = str(
            raw or ""
        ).strip()

        if not code:
            continue

        if code not in ALL_CAPABILITIES:
            raise ValueError(
                "UNKNOWN_CAPABILITY:"
                + code
            )

        if code in seen:
            continue

        seen.add(code)
        normalized.append(code)

    return normalized


def resolve_plan_capabilities(
    *,
    plan_code: str,
    configured: Any,
    requires_quote: bool,
) -> list[str]:
    code = str(
        plan_code or ""
    ).strip()

    # Quote-based professional/institutional contracts never
    # auto-grant capabilities at checkout.
    if requires_quote or code == "pro":
        return []

    configured_values = normalize_capabilities(
        configured
    )

    if configured_values:
        return configured_values

    return list(
        PLAN_DEFAULT_CAPABILITIES.get(
            code,
            (),
        )
    )


def capabilities_from_order_items(
    items: Any,
) -> list[str]:
    candidate = _json_value(items)

    if not isinstance(candidate, list):
        return []

    result: list[str] = []
    seen: set[str] = set()

    for item in candidate:
        if not isinstance(item, dict):
            continue

        values = normalize_capabilities(
            item.get("capabilities")
        )

        for code in values:
            if code in seen:
                continue

            seen.add(code)
            result.append(code)

    return result


def _single_order_item(
    items: Any,
) -> dict[str, Any] | None:
    candidate = _json_value(
        items
    )

    if (
        not isinstance(candidate, list)
        or len(candidate) != 1
        or not isinstance(candidate[0], dict)
    ):
        return None

    return candidate[0]


def fulfillment_kind_from_order_items(
    items: Any,
) -> str:
    item = _single_order_item(
        items
    )

    if item is None:
        return ""

    return str(
        item.get(
            "fulfillment_kind"
        )
        or ""
    ).strip().lower()


def installation_requirements_from_order_items(
    items: Any,
) -> dict[str, Any] | None:
    """
    Resolve the immutable Agent installation contract
    from the purchased order snapshot.

    No cms_plans value is consulted here.
    Unknown/missing versions fail closed.
    """
    item = _single_order_item(
        items
    )

    if item is None:
        return None

    fulfillment_kind = str(
        item.get(
            "fulfillment_kind"
        )
        or ""
    ).strip().lower()

    if (
        fulfillment_kind
        != "physical_installation"
    ):
        return None

    raw_version = item.get(
        "installation_requirements_version"
    )

    try:
        version = int(
            raw_version
        )
    except (
        TypeError,
        ValueError,
    ):
        return None

    if (
        version
        != INSTALLATION_REQUIREMENTS_VERSION
    ):
        return None

    capabilities = normalize_capabilities(
        item.get(
            "capabilities"
        )
    )

    capability_set = set(
        capabilities
    )

    # V1 physical orders must explicitly snapshot
    # the common physical entitlements.
    if not {
        PHYSICAL_PLATE,
        INSTALLATION_TRACKING,
    }.issubset(
        capability_set
    ):
        return None

    return {
        "version": (
            INSTALLATION_REQUIREMENTS_VERSION
        ),
        "fulfillment_kind": (
            "physical_installation"
        ),
        "capabilities": capabilities,

        # Contract only. GPS acquisition remains
        # unimplemented in the new Agent workflow.
        "gps_measure_count": (
            INSTALLATION_GPS_MEASURE_COUNT
        ),
        "gps_max_accuracy_m": (
            INSTALLATION_GPS_MAX_ACCURACY_M
        ),

        "photo_required": True,
        "consent_required": True,
        "category_required": True,
        "visibility_required": True,

        "commercial_place_name_required": True,

        "owner_name_required": False,
        "owner_phone_required": False,

        "access_point_note_required": (
            DETAILED_ACCESS_NOTE
            in capability_set
        ),
    }


def legacy_address_capabilities() -> list[str]:
    return list(
        LEGACY_ADDRESS_CAPABILITIES
    )


def effective_address_capabilities(
    *,
    address_status: str,
    has_paid_order: bool,
    order_items: Any,
) -> list[str]:
    if str(
        address_status or ""
    ).strip().lower() != "active":
        return []

    if has_paid_order:
        snapshot = capabilities_from_order_items(
            order_items
        )

        if snapshot:
            return snapshot

    # Existing addresses without a capability snapshot retain
    # only the conservative digital baseline. This includes
    # pre-R18 paid orders created before capability snapshots.
    return legacy_address_capabilities()


def has_capability(
    capabilities: Any,
    capability: str,
) -> bool:
    requested = str(
        capability or ""
    ).strip()

    if requested not in ALL_CAPABILITIES:
        raise ValueError(
            "UNKNOWN_CAPABILITY:"
            + requested
        )

    return requested in normalize_capabilities(
        capabilities
    )
