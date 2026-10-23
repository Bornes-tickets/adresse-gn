from __future__ import annotations

from typing import Any

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.db import connection

from entitlements import (
    installation_requirements_from_order_items,
)


class AgentLoginError(RuntimeError):
    code = "AGENT_LOGIN_ERROR"


class AgentInvalidCredentialsError(
    AgentLoginError
):
    code = "AGENT_INVALID_CREDENTIALS"


class AgentAuthServiceError(
    AgentLoginError
):
    code = "AGENT_AUTH_SERVICE_ERROR"


def authenticate_agent_badge(
    *,
    badge_number: str,
    password: str,
) -> dict[str, Any]:
    """
    Authentifie un agent par badge + mot de passe.

    L'adresse e-mail technique de Supabase ne quitte jamais
    le backend. Seuls les jetons de session Supabase sont
    retourn?s au client.

    Aucune ?criture m?tier n'est ex?cut?e ici.
    """

    clean_badge = str(
        badge_number or ""
    ).strip()

    clean_password = str(
        password or ""
    )

    if (
        not clean_badge
        or not clean_password
        or len(clean_badge) > 64
        or len(clean_password) > 1024
    ):
        raise AgentInvalidCredentialsError(
            "Identifiants invalides."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                a.id,
                p.role,
                a.active,
                au.email
            FROM public.agents a
            JOIN public.profiles p
              ON p.id = a.id
            JOIN auth.users au
              ON au.id = a.id
            WHERE
                UPPER(BTRIM(a.badge_number))
                =
                UPPER(BTRIM(%s))
            LIMIT 2
            """,
            [
                clean_badge,
            ],
        )

        rows = cursor.fetchall()

    if len(rows) != 1:
        raise AgentInvalidCredentialsError(
            "Identifiants invalides."
        )

    (
        _agent_id,
        role,
        active,
        email,
    ) = rows[0]

    clean_email = str(
        email or ""
    ).strip()

    if (
        str(role) != "agent"
        or active is not True
        or not clean_email
    ):
        raise AgentInvalidCredentialsError(
            "Identifiants invalides."
        )

    endpoint = (
        settings.SUPABASE_URL.rstrip("/")
        + "/auth/v1/token?grant_type=password"
    )

    body = json.dumps(
        {
            "email": clean_email,
            "password": clean_password,
        }
    ).encode("utf-8")

    request = Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "apikey": (
                settings
                .SUPABASE_PUBLISHABLE_KEY
            ),
            "Content-Type": (
                "application/json"
            ),
            "Accept": (
                "application/json"
            ),
        },
    )

    try:
        with urlopen(
            request,
            timeout=15,
        ) as response:
            payload = json.loads(
                response.read().decode(
                    "utf-8"
                )
            )

    except HTTPError as exc:
        if exc.code in {
            400,
            401,
            403,
        }:
            raise (
                AgentInvalidCredentialsError(
                    "Identifiants invalides."
                )
            ) from None

        raise AgentAuthServiceError(
            "Service d'authentification indisponible."
        ) from None

    except (
        URLError,
        TimeoutError,
        json.JSONDecodeError,
    ):
        raise AgentAuthServiceError(
            "Service d'authentification indisponible."
        ) from None

    access_token = str(
        payload.get(
            "access_token"
        ) or ""
    ).strip()

    refresh_token = str(
        payload.get(
            "refresh_token"
        ) or ""
    ).strip()

    if (
        not access_token
        or not refresh_token
    ):
        raise AgentAuthServiceError(
            "Session Supabase invalide."
        )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": payload.get(
            "expires_in"
        ),
        "token_type": str(
            payload.get(
                "token_type"
            ) or "bearer"
        ),
    }


def _iso(value) -> str | None:
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


def _uuid(value) -> str | None:
    if value is None:
        return None

    return str(value)


def _single_order_item_snapshot(
    value: Any,
) -> dict[str, Any] | None:
    candidate = value

    # psycopg may expose JSONB either as an already-decoded
    # Python value or as JSON text depending on context.
    for _ in range(2):
        if not isinstance(
            candidate,
            str,
        ):
            break

        try:
            candidate = json.loads(
                candidate
            )
        except (
            TypeError,
            ValueError,
        ):
            return None

    if isinstance(
        candidate,
        tuple,
    ):
        candidate = list(
            candidate
        )

    if (
        not isinstance(
            candidate,
            list,
        )
        or len(candidate) != 1
        or not isinstance(
            candidate[0],
            dict,
        )
    ):
        return None

    return candidate[0]


def _task_from_row(
    row,
) -> dict[str, Any] | None:
    (
        pending_installation_id,
        workflow_status,
        scheduled_at,
        created_at,

        order_id,
        order_ref,
        client_type,
        customer_name,
        customer_phone,
        order_items,

        beacon_id,
        public_number,

        order_site_id,
        order_site_beacon_id,
        place_type,
        place_name,
        commune_id,
        district_id,
        sector_id,
        address_line,
        access_point_note,

        site_count,
    ) = row

    order_item = (
        _single_order_item_snapshot(
            order_items
        )
    )

    if order_item is None:
        return None

    try:
        requirements = (
            installation_requirements_from_order_items(
                order_items
            )
        )
    except (
        TypeError,
        ValueError,
        RuntimeError,
    ):
        # Malformed/unknown historical snapshots fail closed.
        return None

    if requirements is None:
        return None

    plan_code = str(
        order_item.get(
            "code"
        )
        or order_item.get(
            "ref"
        )
        or ""
    ).strip()

    if not plan_code:
        return None

    plan_name = str(
        order_item.get(
            "label"
        )
        or plan_code
    )

    plan_features = (
        order_item.get(
            "features"
        )
    )

    if not isinstance(
        plan_features,
        (
            dict,
            list,
        ),
    ):
        plan_features = {}

    try:
        normalized_site_count = int(
            site_count or 0
        )
    except (
        TypeError,
        ValueError,
    ):
        normalized_site_count = 0

    site_matches_beacon = (
        order_site_id is not None
        and order_site_beacon_id is not None
        and str(
            order_site_beacon_id
        ) == str(
            beacon_id
        )
    )

    site_contract_valid = (
        normalized_site_count == 1
        and site_matches_beacon
    )

    can_start = (
        str(
            workflow_status
        ) == "planned"
        and scheduled_at is not None
        and site_contract_valid
    )

    return {
        "pending_installation_id": str(
            pending_installation_id
        ),

        "status": str(
            workflow_status
        ),

        "scheduled_at": _iso(
            scheduled_at
        ),

        "created_at": _iso(
            created_at
        ),

        "can_start_installation": (
            can_start
        ),

        "order": {
            "id": str(
                order_id
            ),
            "reference": str(
                order_ref
            ),
            "client_type": (
                client_type
            ),
            "customer_name": (
                customer_name
            ),
            "customer_phone": (
                customer_phone
            ),
        },

        "plan": {
            # Purchase snapshot, never live cms_plans.
            "code": plan_code,
            "name": plan_name,
            "features": (
                plan_features
            ),
            "fulfillment_kind": (
                requirements[
                    "fulfillment_kind"
                ]
            ),
            "installation_required": (
                True
            ),
            "capabilities": list(
                requirements[
                    "capabilities"
                ]
            ),
            "installation_requirements_version": (
                requirements[
                    "version"
                ]
            ),
        },

        "installation_requirements": (
            requirements
        ),

        "beacon": {
            "id": str(
                beacon_id
            ),
            "public_number": str(
                public_number
            ),
        },

        "site_contract": {
            "site_count": (
                normalized_site_count
            ),
            "matches_beacon": (
                site_matches_beacon
            ),
            "valid": (
                site_contract_valid
            ),
        },

        "site": {
            "id": _uuid(
                order_site_id
            ),
            "beacon_id": _uuid(
                order_site_beacon_id
            ),
            "place_type": (
                place_type
            ),
            "place_name": (
                place_name
            ),
            "commune_id": _uuid(
                commune_id
            ),
            "district_id": _uuid(
                district_id
            ),
            "sector_id": _uuid(
                sector_id
            ),
            "address_line": (
                address_line
            ),
            "access_point_note": (
                access_point_note
            ),
        },
    }


def list_agent_tasks(
    *,
    agent_id: str,
) -> list[dict[str, Any]]:
    """
    Return paid physical-installation tasks assigned to
    the authenticated Agent.

    Eligibility comes from the immutable orders.items
    purchase snapshot. The current cms_plans row is not
    consulted and cannot revoke a historical paid order.

    This function remains strictly read-only.
    """

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                pi.id,
                pi.status,
                pi.scheduled_at,
                pi.created_at,

                o.id,
                o.order_ref,
                o.client_type,
                o.full_name,
                o.phone,
                o.items,

                b.id,
                b.public_number,

                os.id,
                os.beacon_id,
                os.place_type,
                os.place_name,
                os.commune_id,
                os.district_id,
                os.sector_id,
                os.address_line,
                os.access_point_note,

                COALESCE(
                    osc.site_count,
                    0
                ) AS site_count

            FROM public.pending_installations pi

            JOIN public.orders o
              ON o.id = pi.order_id

            JOIN public.beacons b
              ON b.id = pi.beacon_id

            LEFT JOIN LATERAL (
                SELECT
                    os1.id,
                    os1.beacon_id,
                    os1.place_type,
                    os1.place_name,
                    os1.commune_id,
                    os1.district_id,
                    os1.sector_id,
                    os1.address_line,
                    os1.access_point_note
                FROM public.order_sites os1
                WHERE
                    os1.order_id = o.id
                ORDER BY
                    os1.sequence_no ASC,
                    os1.id ASC
                LIMIT 1
            ) os
              ON TRUE

            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*)::integer
                        AS site_count
                FROM public.order_sites os_count
                WHERE
                    os_count.order_id = o.id
            ) osc
              ON TRUE

            WHERE
                pi.assigned_agent_id = %s

                AND pi.status IN (
                    'assigned',
                    'planned'
                )

                AND o.status = 'paid'

            ORDER BY
                pi.scheduled_at ASC NULLS LAST,
                pi.created_at ASC,
                pi.id ASC
            """,
            [
                agent_id,
            ],
        )

        rows = cursor.fetchall()

    tasks: list[
        dict[str, Any]
    ] = []

    for row in rows:
        task = _task_from_row(
            row
        )

        # Invalid/missing/non-physical snapshots are not
        # Agent-installation tasks. Fail closed.
        if task is None:
            continue

        tasks.append(
            task
        )

    return tasks

def list_agent_history(
    *,
    agent_id: str,
) -> list[dict[str, Any]]:
    """
    Return completed physical installations for the
    authenticated Agent. Strictly read-only.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                i.id,
                i.installed_at,
                i.validated_at,
                i.gps_lat,
                i.gps_lng,
                i.accuracy_m,
                i.photo_url,

                b.id,
                b.public_number,

                a.id,
                a.name,
                a.category,
                a.visibility,
                a.verification_level,
                a.access_point_note,

                os.id,
                os.place_name,
                os.address_line,

                o.id,
                o.order_ref

            FROM public.installations i

            JOIN public.beacons b
              ON b.id = i.beacon_id

            LEFT JOIN public.addresses a
              ON a.beacon_id = b.id

            LEFT JOIN public.order_sites os
              ON os.id = i.order_site_id

            LEFT JOIN public.orders o
              ON o.id = os.order_id

            WHERE i.agent_id = %s
              AND i.uninstalled_at IS NULL

            ORDER BY
                i.installed_at DESC,
                i.id DESC
            """,
            [
                agent_id,
            ],
        )
        rows = cursor.fetchall()

    items: list[dict[str, Any]] = []

    for row in rows:
        (
            installation_id,
            installed_at,
            validated_at,
            gps_lat,
            gps_lng,
            accuracy_m,
            photo_url,
            beacon_id,
            public_number,
            address_id,
            address_name,
            category,
            visibility,
            verification_level,
            access_point_note,
            order_site_id,
            place_name,
            address_line,
            order_id,
            order_ref,
        ) = row

        items.append(
            {
                "installation_id": str(installation_id),
                "installed_at": (
                    installed_at.isoformat()
                    if installed_at
                    else None
                ),
                "validated_at": (
                    validated_at.isoformat()
                    if validated_at
                    else None
                ),
                "gps": {
                    "lat": (
                        float(gps_lat)
                        if gps_lat is not None
                        else None
                    ),
                    "lng": (
                        float(gps_lng)
                        if gps_lng is not None
                        else None
                    ),
                    "accuracy_m": (
                        float(accuracy_m)
                        if accuracy_m is not None
                        else None
                    ),
                },
                "photo_url": photo_url,
                "beacon": {
                    "id": str(beacon_id),
                    "public_number": public_number,
                },
                "address": {
                    "id": (
                        str(address_id)
                        if address_id
                        else None
                    ),
                    "name": address_name,
                    "category": category,
                    "visibility": visibility,
                    "verification_level": verification_level,
                    "access_point_note": access_point_note,
                },
                "site": {
                    "id": (
                        str(order_site_id)
                        if order_site_id
                        else None
                    ),
                    "place_name": place_name,
                    "address_line": address_line,
                },
                "order": {
                    "id": (
                        str(order_id)
                        if order_id
                        else None
                    ),
                    "reference": order_ref,
                },
            }
        )

    return items
