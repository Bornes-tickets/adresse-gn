from datetime import (
    datetime,
    time,
)
from uuid import UUID

from django.db import connection
from django.utils import timezone
from django.utils.dateparse import (
    parse_date,
    parse_datetime,
)


PAGE_MAX = 100

KNOWN_BEACON_STATUSES = {
    "generated",
    "assigned",
    "active",
    "suspended",
    "cancelled",
    "replaced",
}


class BeaconBackofficeError(
    RuntimeError
):
    pass


class BeaconBackofficeNotFound(
    BeaconBackofficeError
):
    pass


class BeaconBackofficeValidationError(
    BeaconBackofficeError
):
    pass


def _iso(
    value,
):
    if value is None:
        return None

    if hasattr(
        value,
        "isoformat",
    ):
        return value.isoformat()

    return str(value)


def _parse_uuid(
    value,
    *,
    field_name,
):
    if value in (
        None,
        "",
    ):
        return None

    try:
        return UUID(
            str(value)
        )
    except (
        TypeError,
        ValueError,
        AttributeError,
    ) as exc:
        raise BeaconBackofficeValidationError(
            f"{field_name} invalide."
        ) from exc


def _parse_filter_datetime(
    value,
    *,
    field_name,
    end_of_day=False,
):
    if value in (
        None,
        "",
    ):
        return None

    raw = str(value).strip()

    parsed = parse_datetime(
        raw
    )

    if parsed is None:
        parsed_date = parse_date(
            raw
        )

        if parsed_date is None:
            raise (
                BeaconBackofficeValidationError(
                    f"{field_name} invalide."
                )
            )

        parsed = datetime.combine(
            parsed_date,
            (
                time.max
                if end_of_day
                else time.min
            ),
        )

    if timezone.is_naive(
        parsed
    ):
        parsed = timezone.make_aware(
            parsed,
            timezone.get_current_timezone(),
        )

    return parsed


def _parse_statuses(
    statuses,
):
    if statuses is None:
        return []

    if isinstance(
        statuses,
        str,
    ):
        values = [
            item.strip()
            for item
            in statuses.split(",")
            if item.strip()
        ]
    else:
        values = [
            str(item).strip()
            for item
            in statuses
            if str(item).strip()
        ]

    invalid = sorted(
        set(values)
        - KNOWN_BEACON_STATUSES
    )

    if invalid:
        raise (
            BeaconBackofficeValidationError(
                "Statut(s) de balise invalide(s) : "
                + ", ".join(
                    invalid
                )
            )
        )

    return sorted(
        set(values)
    )


def list_beacons(
    *,
    page=1,
    page_size=20,
    statuses=None,
    lot_id=None,
    date_from=None,
    date_to=None,
    query=None,
):
    try:
        page = int(
            page
        )
        page_size = int(
            page_size
        )
    except (
        TypeError,
        ValueError,
    ) as exc:
        raise (
            BeaconBackofficeValidationError(
                "Pagination invalide."
            )
        ) from exc

    page = max(
        page,
        1,
    )

    page_size = min(
        max(
            page_size,
            1,
        ),
        PAGE_MAX,
    )

    parsed_statuses = (
        _parse_statuses(
            statuses
        )
    )

    parsed_lot_id = (
        _parse_uuid(
            lot_id,
            field_name="lot_id",
        )
    )

    parsed_from = (
        _parse_filter_datetime(
            date_from,
            field_name="from",
        )
    )

    parsed_to = (
        _parse_filter_datetime(
            date_to,
            field_name="to",
            end_of_day=True,
        )
    )

    if (
        parsed_from is not None
        and parsed_to is not None
        and parsed_from > parsed_to
    ):
        raise (
            BeaconBackofficeValidationError(
                "La date de début doit "
                "précéder la date de fin."
            )
        )

    search = (
        str(query).strip()
        if query is not None
        else ""
    )

    if len(search) > 120:
        raise (
            BeaconBackofficeValidationError(
                "Recherche trop longue."
            )
        )

    where = []
    params = []

    if parsed_statuses:
        where.append(
            "b.status = ANY(%s)"
        )
        params.append(
            parsed_statuses
        )

    if parsed_lot_id is not None:
        where.append(
            "b.lot_id = %s"
        )
        params.append(
            parsed_lot_id
        )

    if parsed_from is not None:
        where.append(
            "b.created_at >= %s"
        )
        params.append(
            parsed_from
        )

    if parsed_to is not None:
        where.append(
            "b.created_at <= %s"
        )
        params.append(
            parsed_to
        )

    if search:
        where.append(
            """
            STRPOS(
                LOWER(b.public_number),
                LOWER(%s)
            ) > 0
            """
        )
        params.append(
            search
        )

    where_sql = (
        "WHERE "
        + " AND ".join(
            where
        )
        if where
        else ""
    )

    offset = (
        page - 1
    ) * page_size

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*)
            FROM public.beacons b
            {where_sql}
            """,
            params,
        )

        total = int(
            cursor.fetchone()[0]
        )

        cursor.execute(
            f"""
            SELECT
                b.id,
                b.public_number,
                b.status,
                b.created_at,
                b.activated_at,
                b.lot_id,
                l.code,
                b.category,
                b.assigned_agent_id,
                b.national_id,
                b.check_digit,
                b.commune_code_at_issue,
                b.numbering_version
            FROM public.beacons b
            LEFT JOIN public.lots l
                ON l.id = b.lot_id
            {where_sql}
            ORDER BY
                b.created_at DESC NULLS LAST,
                b.id
            LIMIT %s
            OFFSET %s
            """,
            [
                *params,
                page_size,
                offset,
            ],
        )

        rows = (
            cursor.fetchall()
        )

    return {
        "items": [
            {
                "id": str(
                    row[0]
                ),
                "public_number":
                    row[1],
                "status":
                    row[2],
                "created_at":
                    _iso(
                        row[3]
                    ),
                "activated_at":
                    _iso(
                        row[4]
                    ),
                "lot_id": (
                    str(row[5])
                    if row[5]
                    else None
                ),
                "lot_code":
                    row[6],
                "category":
                    row[7],
                "assigned_agent_id": (
                    str(row[8])
                    if row[8]
                    else None
                ),
                "national_id":
                    row[9],
                "check_digit":
                    row[10],
                "commune_code_at_issue":
                    row[11],
                "numbering_version":
                    row[12],
            }
            for row in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_beacon_detail(
    beacon_id,
):
    parsed_id = _parse_uuid(
        beacon_id,
        field_name="beacon_id",
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                b.id,
                b.public_number,
                b.qr_token,
                b.status,
                b.lot_id,
                b.created_at,
                b.activated_at,
                b.assigned_agent_id,
                b.category,
                b.national_id,
                b.check_digit,
                b.commune_code_at_issue,
                b.numbering_version,

                l.code,
                l.supplier,
                l.status,
                l.category

            FROM public.beacons b

            LEFT JOIN public.lots l
                ON l.id = b.lot_id

            WHERE b.id = %s
            LIMIT 1
            """,
            [
                parsed_id,
            ],
        )

        beacon_row = (
            cursor.fetchone()
        )

        if beacon_row is None:
            raise (
                BeaconBackofficeNotFound(
                    "Balise introuvable."
                )
            )

        cursor.execute(
            """
            SELECT
                a.id,
                a.name,
                a.category,
                a.visibility,
                a.verification_level,
                a.status,

                CASE
                    WHEN a.location
                        IS NOT NULL
                    THEN ST_Y(
                        a.location::geometry
                    )
                    ELSE NULL
                END,

                CASE
                    WHEN a.location
                        IS NOT NULL
                    THEN ST_X(
                        a.location::geometry
                    )
                    ELSE NULL
                END

            FROM public.addresses a
            WHERE a.beacon_id = %s

            ORDER BY
                a.created_at
                    DESC NULLS LAST,
                a.id

            LIMIT 1
            """,
            [
                parsed_id,
            ],
        )

        address_row = (
            cursor.fetchone()
        )

        cursor.execute(
            """
            SELECT
                i.id,
                i.gps_lat,
                i.gps_lng,
                i.accuracy_m,
                i.installed_at,
                i.validated_at,
                i.agent_id,
                i.uninstalled_at

            FROM public.installations i

            WHERE i.beacon_id = %s

            ORDER BY
                i.installed_at
                    DESC NULLS LAST,
                i.id DESC

            LIMIT 1
            """,
            [
                parsed_id,
            ],
        )

        installation_row = (
            cursor.fetchone()
        )

    beacon = {
        "id": str(
            beacon_row[0]
        ),
        "public_number":
            beacon_row[1],
        "qr_token": str(
            beacon_row[2]
        ),
        "status":
            beacon_row[3],
        "lot_id": (
            str(beacon_row[4])
            if beacon_row[4]
            else None
        ),
        "created_at":
            _iso(
                beacon_row[5]
            ),
        "activated_at":
            _iso(
                beacon_row[6]
            ),
        "assigned_agent_id": (
            str(beacon_row[7])
            if beacon_row[7]
            else None
        ),
        "category":
            beacon_row[8],
        "national_id":
            beacon_row[9],
        "check_digit":
            beacon_row[10],
        "commune_code_at_issue":
            beacon_row[11],
        "numbering_version":
            beacon_row[12],

        "lot": (
            {
                "id": str(
                    beacon_row[4]
                ),
                "code":
                    beacon_row[13],
                "supplier":
                    beacon_row[14],
                "status":
                    beacon_row[15],
                "category":
                    beacon_row[16],
            }
            if beacon_row[4]
            else None
        ),
    }

    address = (
        {
            "id": str(
                address_row[0]
            ),
            "name":
                address_row[1],
            "category":
                address_row[2],
            "visibility":
                address_row[3],
            "verification_level":
                address_row[4],
            "status":
                address_row[5],
            "point": (
                {
                    "lat": float(
                        address_row[6]
                    ),
                    "lng": float(
                        address_row[7]
                    ),
                }
                if (
                    address_row[6]
                    is not None
                    and address_row[7]
                    is not None
                )
                else None
            ),
        }
        if address_row
        else None
    )

    installation = (
        {
            "id": str(
                installation_row[0]
            ),
            "gps_lat": float(
                installation_row[1]
            ),
            "gps_lng": float(
                installation_row[2]
            ),
            "accuracy_m": (
                float(
                    installation_row[3]
                )
                if installation_row[3]
                is not None
                else None
            ),
            "installed_at":
                _iso(
                    installation_row[4]
                ),
            "validated_at":
                _iso(
                    installation_row[5]
                ),
            "agent_id": (
                str(
                    installation_row[6]
                )
                if installation_row[6]
                else None
            ),
            "uninstalled_at":
                _iso(
                    installation_row[7]
                ),
        }
        if installation_row
        else None
    )

    return {
        "beacon": beacon,
        "address": address,
        "installation":
            installation,
    }