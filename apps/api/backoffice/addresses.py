from datetime import datetime, time
from uuid import UUID

from django.db import connection
from django.utils import timezone
from django.utils.dateparse import (
    parse_date,
    parse_datetime,
)


PAGE_MAX = 100

ADDRESS_CATEGORIES = {
    "habitation",
    "restaurant",
    "hotel",
    "bar",
    "commerce",
    "entreprise",
    "administration",
    "ecole",
    "sante",
    "pharmacie",
    "banque",
    "tourisme",
    "other",
}

ADDRESS_VISIBILITIES = {
    "private",
    "public",
}

ADDRESS_VERIFICATION_LEVELS = {
    "unverified",
    "pending",
    "verified",
}

ADDRESS_STATUSES = {
    "active",
    "suspended",
    "deleted",
}


class AddressBackofficeError(RuntimeError):
    pass


class AddressBackofficeNotFound(AddressBackofficeError):
    pass


class AddressBackofficeValidationError(AddressBackofficeError):
    pass


def _iso(value):
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


def _row_dict(cursor, row):
    if row is None:
        return None

    columns = [
        description[0]
        for description in cursor.description
    ]

    return dict(zip(columns, row))


def _parse_uuid(
    value,
    *,
    field_name,
):
    if value in (None, ""):
        return None

    try:
        return UUID(str(value))

    except (
        TypeError,
        ValueError,
        AttributeError,
    ) as exc:
        raise AddressBackofficeValidationError(
            f"{field_name} invalide."
        ) from exc


def _parse_choice(
    value,
    *,
    field_name,
    allowed,
):
    if value in (None, ""):
        return None

    parsed = str(value).strip()

    if parsed not in allowed:
        raise AddressBackofficeValidationError(
            f"{field_name} invalide."
        )

    return parsed


def _parse_filter_datetime(
    value,
    *,
    field_name,
    end_of_day=False,
):
    if value in (None, ""):
        return None

    raw = str(value).strip()

    parsed = parse_datetime(raw)

    if parsed is None:
        parsed_date = parse_date(raw)

        if parsed_date is None:
            raise AddressBackofficeValidationError(
                f"{field_name} invalide."
            )

        parsed = datetime.combine(
            parsed_date,
            time.max if end_of_day else time.min,
        )

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(
            parsed,
            timezone.get_current_timezone(),
        )

    return parsed


def list_addresses(
    *,
    page=1,
    page_size=20,
    visibility=None,
    category=None,
    verification=None,
    commune_id=None,
    district_id=None,
    sector_id=None,
    status=None,
    date_from=None,
    date_to=None,
    query=None,
):
    try:
        page = int(page)
        page_size = int(page_size)

    except (
        TypeError,
        ValueError,
    ) as exc:
        raise AddressBackofficeValidationError(
            "Pagination invalide."
        ) from exc

    page = max(page, 1)

    page_size = min(
        max(page_size, 1),
        PAGE_MAX,
    )

    visibility = _parse_choice(
        visibility,
        field_name="visibility",
        allowed=ADDRESS_VISIBILITIES,
    )

    category = _parse_choice(
        category,
        field_name="category",
        allowed=ADDRESS_CATEGORIES,
    )

    verification = _parse_choice(
        verification,
        field_name="verification",
        allowed=ADDRESS_VERIFICATION_LEVELS,
    )

    status = _parse_choice(
        status,
        field_name="status",
        allowed=ADDRESS_STATUSES,
    )

    commune_id = _parse_uuid(
        commune_id,
        field_name="commune_id",
    )

    district_id = _parse_uuid(
        district_id,
        field_name="district_id",
    )

    sector_id = _parse_uuid(
        sector_id,
        field_name="sector_id",
    )

    date_from = _parse_filter_datetime(
        date_from,
        field_name="from",
    )

    date_to = _parse_filter_datetime(
        date_to,
        field_name="to",
        end_of_day=True,
    )

    if (
        date_from is not None
        and date_to is not None
        and date_from > date_to
    ):
        raise AddressBackofficeValidationError(
            "La date de début doit précéder la date de fin."
        )

    search = (
        str(query).strip()
        if query is not None
        else ""
    )

    if len(search) > 160:
        raise AddressBackofficeValidationError(
            "Recherche trop longue."
        )

    where = []
    params = []

    if visibility:
        where.append(
            "a.visibility = %s"
        )
        params.append(visibility)

    if category:
        where.append(
            "a.category = %s"
        )
        params.append(category)

    if verification:
        where.append(
            "a.verification_level = %s"
        )
        params.append(verification)

    if commune_id:
        where.append(
            "a.commune_id = %s"
        )
        params.append(commune_id)

    if district_id:
        where.append(
            "a.district_id = %s"
        )
        params.append(district_id)

    if sector_id:
        where.append(
            "a.sector_id = %s"
        )
        params.append(sector_id)

    if status:
        where.append(
            "a.status = %s"
        )
        params.append(status)

    if date_from:
        where.append(
            "a.created_at >= %s"
        )
        params.append(date_from)

    if date_to:
        where.append(
            "a.created_at <= %s"
        )
        params.append(date_to)

    if search:
        where.append(
            """
            STRPOS(
                LOWER(
                    COALESCE(
                        a.name,
                        ''
                    )
                ),
                LOWER(%s)
            ) > 0
            """
        )
        params.append(search)

    where_sql = (
        "WHERE "
        + " AND ".join(where)
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
            FROM public.addresses a
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
                a.id,
                a.name,
                a.category,
                a.visibility,
                a.verification_level,
                a.status,
                a.created_at,
                a.updated_at,
                a.owner_id,

                a.beacon_id,
                b.public_number,
                b.status,
                b.numbering_version,

                a.commune_id,
                c.name,

                a.district_id,
                d.name,

                a.sector_id,
                s.name

            FROM public.addresses a

            LEFT JOIN public.beacons b
                ON b.id = a.beacon_id

            LEFT JOIN public.communes c
                ON c.id = a.commune_id

            LEFT JOIN public.districts d
                ON d.id = a.district_id

            LEFT JOIN public.sectors s
                ON s.id = a.sector_id

            {where_sql}

            ORDER BY
                a.created_at DESC NULLS LAST,
                a.id

            LIMIT %s
            OFFSET %s
            """,
            [
                *params,
                page_size,
                offset,
            ],
        )

        rows = cursor.fetchall()

    items = []

    for row in rows:
        (
            address_id,
            name,
            item_category,
            item_visibility,
            verification_level,
            item_status,
            created_at,
            updated_at,
            owner_id,
            beacon_id,
            beacon_number,
            beacon_status,
            beacon_numbering_version,
            item_commune_id,
            commune_name,
            item_district_id,
            district_name,
            item_sector_id,
            sector_name,
        ) = row

        items.append(
            {
                "id": str(address_id),
                "name": name,
                "category": item_category,
                "visibility": item_visibility,
                "verification_level": verification_level,
                "status": item_status,
                "created_at": _iso(created_at),
                "updated_at": _iso(updated_at),

                "owner_id": (
                    str(owner_id)
                    if owner_id
                    else None
                ),

                "beacon_id": (
                    str(beacon_id)
                    if beacon_id
                    else None
                ),

                "beacon_number":
                    beacon_number,

                "beacon_status":
                    beacon_status,

                "beacon_numbering_version":
                    beacon_numbering_version,

                "commune_id": (
                    str(item_commune_id)
                    if item_commune_id
                    else None
                ),

                "commune_name":
                    commune_name,

                "district_id": (
                    str(item_district_id)
                    if item_district_id
                    else None
                ),

                "district_name":
                    district_name,

                "sector_id": (
                    str(item_sector_id)
                    if item_sector_id
                    else None
                ),

                "sector_name":
                    sector_name,
            }
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_address_detail(address_id):
    parsed_id = _parse_uuid(
        address_id,
        field_name="address_id",
    )

    if parsed_id is None:
        raise AddressBackofficeValidationError(
            "address_id obligatoire."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                a.id AS address_id,
                a.beacon_id,
                a.owner_id,
                a.category,
                a.name,
                a.accuracy_m,
                a.visibility,
                a.verification_level,
                a.access_point_note,
                a.status,
                a.commune_id,
                a.district_id,
                a.sector_id,
                a.created_at,
                a.updated_at,

                CASE
                    WHEN a.location IS NOT NULL
                    THEN ST_Y(
                        a.location::geometry
                    )
                    ELSE NULL
                END AS latitude,

                CASE
                    WHEN a.location IS NOT NULL
                    THEN ST_X(
                        a.location::geometry
                    )
                    ELSE NULL
                END AS longitude,

                b.public_number
                    AS beacon_number,

                b.status
                    AS beacon_status,

                b.category
                    AS beacon_category,

                b.numbering_version
                    AS beacon_numbering_version,

                b.national_id
                    AS beacon_national_id,

                b.check_digit
                    AS beacon_check_digit,

                b.commune_code_at_issue
                    AS beacon_commune_code_at_issue,

                c.name
                    AS commune_name,

                c.code
                    AS commune_code,

                c.stat_code
                    AS commune_stat_code,

                c.administrative_type
                    AS commune_administrative_type,

                d.name
                    AS district_name,

                d.kind
                    AS district_kind,

                d.code
                    AS district_code,

                s.name
                    AS sector_name,

                s.code
                    AS sector_code,

                p.full_name
                    AS owner_full_name,

                p.phone
                    AS owner_phone,

                p.role
                    AS owner_role,

                p.account_status
                    AS owner_account_status,

                u.email
                    AS owner_email

            FROM public.addresses a

            LEFT JOIN public.beacons b
                ON b.id = a.beacon_id

            LEFT JOIN public.communes c
                ON c.id = a.commune_id

            LEFT JOIN public.districts d
                ON d.id = a.district_id

            LEFT JOIN public.sectors s
                ON s.id = a.sector_id

            LEFT JOIN public.profiles p
                ON p.id = a.owner_id

            LEFT JOIN auth.users u
                ON u.id = a.owner_id

            WHERE a.id = %s
            LIMIT 1
            """,
            [
                parsed_id,
            ],
        )

        row = cursor.fetchone()

        if row is None:
            raise AddressBackofficeNotFound(
                "Adresse introuvable."
            )

        data = _row_dict(
            cursor,
            row,
        )

        cursor.execute(
            """
            SELECT
                id,
                action,
                actor_id,
                created_at,
                before,
                after

            FROM public.audit_logs

            WHERE
                entity = 'addresses'
                AND entity_id = %s

            ORDER BY
                created_at DESC NULLS LAST,
                id

            LIMIT 30
            """,
            [
                parsed_id,
            ],
        )

        journal_rows = (
            cursor.fetchall()
        )

        journal = [
            {
                "id": str(item[0]),
                "action": item[1],
                "actor_id": (
                    str(item[2])
                    if item[2]
                    else None
                ),
                "created_at":
                    _iso(item[3]),
                "before": item[4],
                "after": item[5],
            }
            for item in journal_rows
        ]

        cursor.execute(
            """
            SELECT
                id,
                business_name,
                phone,
                opening_hours,
                description,
                cover_url

            FROM public.establishments

            WHERE address_id = %s

            ORDER BY id
            LIMIT 1
            """,
            [
                parsed_id,
            ],
        )

        establishment_row = (
            cursor.fetchone()
        )

    point = None

    if (
        data["latitude"] is not None
        and data["longitude"] is not None
    ):
        point = {
            "lat": float(
                data["latitude"]
            ),
            "lng": float(
                data["longitude"]
            ),
        }

    address = {
        "id": str(
            data["address_id"]
        ),
        "name": data["name"],
        "category": data["category"],
        "visibility":
            data["visibility"],
        "verification_level":
            data["verification_level"],
        "status": data["status"],

        "accuracy_m": (
            float(data["accuracy_m"])
            if data["accuracy_m"]
            is not None
            else None
        ),

        "access_point_note":
            data["access_point_note"],

        "created_at":
            _iso(data["created_at"]),

        "updated_at":
            _iso(data["updated_at"]),

        "point": point,
    }

    beacon = (
        {
            "id": str(
                data["beacon_id"]
            ),

            "public_number":
                data["beacon_number"],

            "status":
                data["beacon_status"],

            "category":
                data["beacon_category"],

            "numbering_version":
                data[
                    "beacon_numbering_version"
                ],

            "national_id":
                data[
                    "beacon_national_id"
                ],

            "check_digit":
                data[
                    "beacon_check_digit"
                ],

            "commune_code_at_issue":
                data[
                    "beacon_commune_code_at_issue"
                ],
        }
        if data["beacon_id"]
        else None
    )

    owner = (
        {
            "id": str(
                data["owner_id"]
            ),

            "full_name":
                data[
                    "owner_full_name"
                ],

            "email":
                data[
                    "owner_email"
                ],

            "phone":
                data[
                    "owner_phone"
                ],

            "role":
                data[
                    "owner_role"
                ],

            "account_status":
                data[
                    "owner_account_status"
                ],
        }
        if data["owner_id"]
        else None
    )

    territory = {
        "commune": (
            {
                "id": str(
                    data["commune_id"]
                ),

                "name":
                    data["commune_name"],

                "code":
                    data["commune_code"],

                "stat_code":
                    data[
                        "commune_stat_code"
                    ],

                "administrative_type":
                    data[
                        "commune_administrative_type"
                    ],
            }
            if data["commune_id"]
            else None
        ),

        "district": (
            {
                "id": str(
                    data["district_id"]
                ),

                "name":
                    data["district_name"],

                "kind":
                    data["district_kind"],

                "code":
                    data["district_code"],
            }
            if data["district_id"]
            else None
        ),

        "sector": (
            {
                "id": str(
                    data["sector_id"]
                ),

                "name":
                    data["sector_name"],

                "code":
                    data["sector_code"],
            }
            if data["sector_id"]
            else None
        ),
    }

    establishment = (
        {
            "id": str(
                establishment_row[0]
            ),

            "business_name":
                establishment_row[1],

            "phone":
                establishment_row[2],

            "opening_hours":
                establishment_row[3],

            "description":
                establishment_row[4],

            "cover_url":
                establishment_row[5],
        }
        if establishment_row
        else None
    )

    return {
        "address": address,
        "beacon": beacon,
        "owner": owner,
        "territory": territory,
        "journal": journal,
        "establishment":
            establishment,
    }