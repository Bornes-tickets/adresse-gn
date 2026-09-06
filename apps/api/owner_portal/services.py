import re
from datetime import timedelta
from typing import Any

from django.db import (
    connection,
    transaction,
)
from django.utils import timezone


class OwnerAddressAccessError(Exception):
    pass


def _clean_optional(
    value: str | None,
) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()

    return cleaned or None


def _series_30_days(
    rows: list[tuple],
) -> dict[str, list[dict[str, Any]]]:
    today = timezone.localdate()

    start_day = (
        today
        - timedelta(days=29)
    )

    buckets: dict[
        str,
        dict[str, int]
    ] = {}

    for beacon_id, day, count in rows:
        key = str(beacon_id)

        if key not in buckets:
            buckets[key] = {}

        buckets[key][
            day.isoformat()
        ] = int(count)

    result: dict[
        str,
        list[dict[str, Any]]
    ] = {}

    for beacon_id, values in buckets.items():
        result[beacon_id] = [
            {
                "day": (
                    start_day
                    + timedelta(days=index)
                ).isoformat(),
                "count": values.get(
                    (
                        start_day
                        + timedelta(days=index)
                    ).isoformat(),
                    0,
                ),
            }
            for index in range(30)
        ]

    return result


def _empty_series() -> list[dict[str, Any]]:
    today = timezone.localdate()

    start_day = (
        today
        - timedelta(days=29)
    )

    return [
        {
            "day": (
                start_day
                + timedelta(days=index)
            ).isoformat(),
            "count": 0,
        }
        for index in range(30)
    ]


def list_owner_beacons(
    user_id: str,
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                a.id,
                a.beacon_id,
                b.public_number,
                a.name,
                a.category,
                a.visibility,
                a.verification_level,
                a.status,
                a.access_point_note,
                e.id
            FROM public.addresses a
            LEFT JOIN public.beacons b
                ON b.id = a.beacon_id
            LEFT JOIN public.establishments e
                ON e.address_id = a.id
            WHERE a.owner_id = %s
            ORDER BY a.created_at DESC
            """,
            [
                user_id,
            ],
        )

        addresses = cursor.fetchall()

    beacon_ids = [
        str(row[1])
        for row in addresses
        if row[1] is not None
    ]

    daily_rows: list[tuple] = []

    if beacon_ids:
        placeholders = ",".join(
            ["%s"] * len(beacon_ids)
        )

        since = (
            timezone.now()
            - timedelta(days=30)
        )

        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    beacon_id_found,
                    created_at::date,
                    COUNT(*)
                FROM public.search_logs
                WHERE
                    beacon_id_found IN (
                        {placeholders}
                    )
                    AND created_at >= %s
                GROUP BY
                    beacon_id_found,
                    created_at::date
                ORDER BY
                    beacon_id_found,
                    created_at::date
                """,
                [
                    *beacon_ids,
                    since,
                ],
            )

            daily_rows = (
                cursor.fetchall()
            )

    series_by_beacon = (
        _series_30_days(
            daily_rows
        )
    )

    result = []

    for row in addresses:
        (
            address_id,
            beacon_id,
            public_number,
            name,
            category,
            visibility,
            verification_level,
            status,
            access_point_note,
            establishment_id,
        ) = row

        beacon_key = (
            str(beacon_id)
            if beacon_id
            else ""
        )

        searches = (
            series_by_beacon.get(
                beacon_key,
                _empty_series(),
            )
        )

        result.append(
            {
                "address_id": str(
                    address_id
                ),
                "beacon_id": (
                    str(beacon_id)
                    if beacon_id
                    else None
                ),
                "public_number": (
                    public_number
                    or "—"
                ),
                "name": name,
                "category": category,
                "visibility": visibility,
                "verification_level": (
                    verification_level
                ),
                "status": status,
                "access_point_note": (
                    access_point_note
                ),
                "establishment_id": (
                    str(establishment_id)
                    if establishment_id
                    else None
                ),
                "searches_30d": searches,
            }
        )

    return result


def _lock_owned_address(
    *,
    user_id: str,
    address_id: str,
) -> tuple:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                beacon_id,
                owner_id,
                name,
                category,
                visibility,
                status
            FROM public.addresses
            WHERE
                id = %s
                AND owner_id = %s
            FOR UPDATE
            """,
            [
                address_id,
                user_id,
            ],
        )

        row = cursor.fetchone()

    if row is None:
        raise OwnerAddressAccessError(
            "Cette adresse ne vous appartient pas."
        )

    return row


@transaction.atomic
def update_owner_beacon(
    *,
    user_id: str,
    address_id: str,
    name: str | None,
    category: str,
    visibility: str,
    access_point_note: str | None,
) -> dict[str, Any]:
    _lock_owned_address(
        user_id=user_id,
        address_id=address_id,
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.addresses
            SET
                name = %s,
                category = %s,
                visibility = %s,
                access_point_note = %s
            WHERE
                id = %s
                AND owner_id = %s
            """,
            [
                _clean_optional(name),
                category,
                visibility,
                _clean_optional(
                    access_point_note
                ),
                address_id,
                user_id,
            ],
        )

    return {
        "ok": True,
        "status": "updated",
        "message": (
            "Balise mise à jour."
        ),
    }


@transaction.atomic
def suspend_owner_beacon(
    *,
    user_id: str,
    address_id: str,
) -> dict[str, Any]:
    _lock_owned_address(
        user_id=user_id,
        address_id=address_id,
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.addresses
            SET status = 'suspended'
            WHERE
                id = %s
                AND owner_id = %s
            """,
            [
                address_id,
                user_id,
            ],
        )

    return {
        "ok": True,
        "status": "suspended",
        "message": (
            "Balise suspendue."
        ),
    }


@transaction.atomic
def create_owner_moving_report(
    *,
    user_id: str,
    address_id: str,
    description: str | None,
) -> dict[str, Any]:
    address = _lock_owned_address(
        user_id=user_id,
        address_id=address_id,
    )

    beacon_id = address[1]

    if beacon_id is None:
        raise OwnerAddressAccessError(
            "Cette adresse n'est rattachée à aucune balise."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.reports
                (
                    beacon_id,
                    reporter_id,
                    reason,
                    description
                )
            VALUES
                (
                    %s,
                    %s,
                    'moving',
                    %s
                )
            RETURNING
                id,
                status,
                created_at
            """,
            [
                beacon_id,
                user_id,
                _clean_optional(
                    description
                ),
            ],
        )

        created = cursor.fetchone()

    return {
        "ok": True,
        "status": "created",
        "report_id": str(
            created[0]
        ),
        "report_status": (
            created[1]
        ),
        "created_at": (
            created[2].isoformat()
            if created[2]
            else None
        ),
        "message": (
            "Déménagement signalé : "
            "notre équipe vous contactera."
        ),
    }

def get_owner_dashboard(
    user_id: str,
) -> dict[str, Any]:
    """
    Reconstruit exactement le tableau de bord historique
    du portail propriétaire.

    Sécurité :
    - l'identifiant utilisateur provient exclusivement du JWT ;
    - seules les adresses dont owner_id = user_id sont prises en compte ;
    - search_logs et route_logs sont limités aux balises possédées.
    """

    # --------------------------------------------------------
    # Balises possédées
    # --------------------------------------------------------

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                a.beacon_id,
                COALESCE(
                    b.public_number,
                    '—'
                )
            FROM public.addresses a
            LEFT JOIN public.beacons b
                ON b.id = a.beacon_id
            WHERE a.owner_id = %s
            ORDER BY a.created_at DESC
            """,
            [
                user_id,
            ],
        )

        owned_rows = (
            cursor.fetchall()
        )

    beacon_count = len(
        owned_rows
    )

    beacon_ids = [
        str(row[0])
        for row in owned_rows
        if row[0] is not None
    ]

    number_by_beacon = {
        str(row[0]): row[1]
        for row in owned_rows
        if row[0] is not None
    }

    if not beacon_ids:
        return {
            "beaconCount": 0,
            "searches30d": 0,
            "routes30d": 0,
            "activities": [],
        }

    placeholders = ",".join(
        ["%s"] * len(beacon_ids)
    )

    since = (
        timezone.now()
        - timedelta(days=30)
    )

    # --------------------------------------------------------
    # Recherches des 30 derniers jours
    # --------------------------------------------------------

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*)
            FROM public.search_logs
            WHERE
                beacon_id_found IN (
                    {placeholders}
                )
                AND created_at >= %s
            """,
            [
                *beacon_ids,
                since,
            ],
        )

        searches_30d = int(
            cursor.fetchone()[0]
        )

        cursor.execute(
            f"""
            SELECT
                beacon_id_found,
                created_at
            FROM public.search_logs
            WHERE
                beacon_id_found IN (
                    {placeholders}
                )
                AND created_at >= %s
            ORDER BY created_at DESC
            LIMIT 3
            """,
            [
                *beacon_ids,
                since,
            ],
        )

        recent_searches = (
            cursor.fetchall()
        )

    # --------------------------------------------------------
    # Itinéraires des 30 derniers jours
    # --------------------------------------------------------

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*)
            FROM public.route_logs
            WHERE
                beacon_id IN (
                    {placeholders}
                )
                AND launched_at >= %s
            """,
            [
                *beacon_ids,
                since,
            ],
        )

        routes_30d = int(
            cursor.fetchone()[0]
        )

        cursor.execute(
            f"""
            SELECT
                beacon_id,
                provider,
                launched_at
            FROM public.route_logs
            WHERE
                beacon_id IN (
                    {placeholders}
                )
                AND launched_at >= %s
            ORDER BY launched_at DESC
            LIMIT 3
            """,
            [
                *beacon_ids,
                since,
            ],
        )

        recent_routes = (
            cursor.fetchall()
        )

    # --------------------------------------------------------
    # Dernières activités
    #
    # Comportement historique :
    # 1. prendre max 3 recherches ;
    # 2. prendre max 3 itinéraires ;
    # 3. fusionner ;
    # 4. trier par date décroissante ;
    # 5. conserver seulement les 3 plus récentes.
    # --------------------------------------------------------

    activities: list[
        dict[str, Any]
    ] = []

    for (
        beacon_id,
        created_at,
    ) in recent_searches:
        activities.append(
            {
                "label": "Recherche",
                "detail": (
                    number_by_beacon.get(
                        str(beacon_id),
                        "—",
                    )
                ),
                "at": created_at,
            }
        )

    for (
        beacon_id,
        provider,
        launched_at,
    ) in recent_routes:
        activities.append(
            {
                "label": (
                    "Itinéraire "
                    f"({provider or '—'})"
                ),
                "detail": (
                    number_by_beacon.get(
                        str(beacon_id),
                        "—",
                    )
                ),
                "at": launched_at,
            }
        )

    activities.sort(
        key=lambda item: item["at"],
        reverse=True,
    )

    activities = (
        activities[:3]
    )

    return {
        "beaconCount": beacon_count,
        "searches30d": searches_30d,
        "routes30d": routes_30d,
        "activities": [
            {
                "label": item["label"],
                "detail": item["detail"],
                "at": (
                    item["at"]
                    .isoformat()
                ),
            }
            for item in activities
        ],
    }



class OwnerFavoriteInputError(Exception):
    pass


class OwnerFavoriteConflictError(Exception):
    pass


class OwnerFavoriteNotFoundError(Exception):
    pass


def _normalize_favorite_number(
    raw_number: str,
) -> str:
    raw = re.sub(
        r"\s+",
        "",
        raw_number.strip().upper(),
    )

    if re.fullmatch(
        r"\d{6}",
        raw,
    ):
        return (
            f"GN-CKY-{raw}"
        )

    compact = re.sub(
        r"[^A-Z0-9]",
        "",
        raw,
    )

    match = re.fullmatch(
        r"GN([A-Z]{3})(\d{6})",
        compact,
    )

    if match:
        return (
            f"GN-{match.group(1)}-"
            f"{match.group(2)}"
        )

    return raw


def list_owner_favorites(
    user_id: str,
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                f.id,
                f.alias,
                f.created_at,
                b.public_number,
                CASE
                    WHEN a.visibility = 'public'
                    THEN a.name
                    ELSE NULL
                END,
                a.category
            FROM public.favorites f
            LEFT JOIN public.beacons b
                ON b.id = f.beacon_id
            LEFT JOIN public.addresses a
                ON a.beacon_id = f.beacon_id
            WHERE f.user_id = %s
            ORDER BY f.created_at DESC
            """,
            [
                user_id,
            ],
        )

        rows = cursor.fetchall()

    return [
        {
            "id": str(row[0]),
            "alias": row[1],
            "created_at": (
                row[2].isoformat()
                if row[2]
                else None
            ),
            "public_number": (
                row[3]
                or "—"
            ),
            "name": row[4],
            "category": row[5],
        }
        for row in rows
    ]


@transaction.atomic
def create_owner_favorite(
    *,
    user_id: str,
    raw_number: str,
    alias: str | None,
) -> dict[str, Any]:
    number = (
        _normalize_favorite_number(
            raw_number
        )
    )

    if not re.fullmatch(
        r"GN-[A-Z]{3}-\d{6}",
        number,
    ):
        raise OwnerFavoriteInputError(
            "Numéro Adresse GN invalide."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id
            FROM public.beacons
            WHERE public_number = %s
            LIMIT 1
            """,
            [
                number,
            ],
        )

        beacon = cursor.fetchone()

        if beacon is None:
            raise OwnerFavoriteNotFoundError(
                "Balise introuvable."
            )

        cursor.execute(
            """
            INSERT INTO public.favorites
                (
                    user_id,
                    beacon_id,
                    alias
                )
            VALUES
                (
                    %s,
                    %s,
                    %s
                )
            ON CONFLICT
                (user_id, beacon_id)
            DO NOTHING
            RETURNING
                id,
                created_at
            """,
            [
                user_id,
                beacon[0],
                _clean_optional(
                    alias
                ),
            ],
        )

        created = cursor.fetchone()

    if created is None:
        raise OwnerFavoriteConflictError(
            "Cette adresse est déjà dans vos favoris."
        )

    return {
        "ok": True,
        "status": "created",
        "favorite_id": str(
            created[0]
        ),
        "created_at": (
            created[1].isoformat()
            if created[1]
            else None
        ),
        "message": (
            "Favori enregistré."
        ),
    }


@transaction.atomic
def update_owner_favorite(
    *,
    user_id: str,
    favorite_id: str,
    alias: str | None,
) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.favorites
            SET alias = %s
            WHERE
                id = %s
                AND user_id = %s
            RETURNING id
            """,
            [
                _clean_optional(
                    alias
                ),
                favorite_id,
                user_id,
            ],
        )

        updated = cursor.fetchone()

    if updated is None:
        raise OwnerFavoriteNotFoundError(
            "Favori introuvable."
        )

    return {
        "ok": True,
        "status": "updated",
        "message": (
            "Alias mis à jour."
        ),
    }


@transaction.atomic
def delete_owner_favorite(
    *,
    user_id: str,
    favorite_id: str,
) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            DELETE FROM public.favorites
            WHERE
                id = %s
                AND user_id = %s
            RETURNING id
            """,
            [
                favorite_id,
                user_id,
            ],
        )

        deleted = cursor.fetchone()

    if deleted is None:
        raise OwnerFavoriteNotFoundError(
            "Favori introuvable."
        )

    return {
        "ok": True,
        "status": "deleted",
        "message": (
            "Favori retiré."
        ),
    }
