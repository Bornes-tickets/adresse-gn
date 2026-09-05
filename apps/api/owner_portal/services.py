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