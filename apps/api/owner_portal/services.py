import json
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



def _decode_order_json(
    value: Any,
) -> Any:
    """
    Tolère les anciennes valeurs jsonb qui peuvent elles-mêmes
    contenir une chaîne JSON sérialisée.
    """
    decoded = value

    for _ in range(3):
        if not isinstance(
            decoded,
            str,
        ):
            break

        stripped = decoded.strip()

        if not stripped:
            break

        try:
            decoded = json.loads(
                stripped
            )
        except (
            json.JSONDecodeError,
            TypeError,
        ):
            break

    return decoded


def _localized_order_text(
    value: Any,
) -> str | None:
    decoded = _decode_order_json(
        value
    )

    if isinstance(
        decoded,
        dict,
    ):
        for key in (
            "fr",
            "en",
            "ar",
        ):
            candidate = decoded.get(
                key
            )

            if (
                isinstance(
                    candidate,
                    str,
                )
                and candidate.strip()
            ):
                return (
                    candidate.strip()
                )

        return None

    if isinstance(
        decoded,
        str,
    ):
        cleaned = decoded.strip()

        return (
            cleaned
            or None
        )

    return None


def _normalize_order_items(
    value: Any,
) -> list[dict[str, Any]]:
    decoded = _decode_order_json(
        value
    )

    if not isinstance(
        decoded,
        list,
    ):
        return []

    items: list[
        dict[str, Any]
    ] = []

    for item in decoded:
        if not isinstance(
            item,
            dict,
        ):
            continue

        try:
            qty = int(
                item.get(
                    "qty",
                    0,
                )
                or 0
            )

            unit_price = int(
                item.get(
                    "unit_price_gnf",
                    0,
                )
                or 0
            )

        except (
            TypeError,
            ValueError,
        ):
            continue

        items.append(
            {
                "kind": (
                    item.get(
                        "kind"
                    )
                ),
                "ref": (
                    item.get(
                        "ref"
                    )
                ),
                "qty": qty,
                "unit_price_gnf": (
                    unit_price
                ),
                "label": (
                    str(
                        item.get(
                            "label"
                        )
                        or ""
                    ).strip()
                ),
            }
        )

    return items


def list_owner_orders(
    user_id: str,
) -> list[dict[str, Any]]:
    """
    Portail propriétaire — commandes.

    Source d'autorité :
        orders.customer_id = user_id

    Les lignes items legacy ne sont jamais reconstruites.
    """

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                o.id,
                o.order_ref,
                o.offer_code,
                o.amount_gnf,
                o.status,
                o.created_at,
                o.items,
                o.beacon_id,
                o.business_id,
                o.plan_id,
                o.formule_code,
                o.formule_label,
                p.code,
                p.name,
                p.active
            FROM public.orders o
            LEFT JOIN public.cms_plans p
                ON p.id = o.plan_id
            WHERE o.customer_id = %s
            ORDER BY o.created_at DESC
            LIMIT 100
            """,
            [
                user_id,
            ],
        )

        order_rows = (
            cursor.fetchall()
        )

    if not order_rows:
        return []

    order_ids = [
        str(row[0])
        for row in order_rows
    ]

    placeholders = ",".join(
        ["%s"] * len(order_ids)
    )


    # --------------------------------------------------------
    # Sites
    # --------------------------------------------------------

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
                id,
                order_id,
                sequence_no,
                place_type,
                place_name,
                address_line,
                access_point_note,
                beacon_id,
                status
            FROM public.order_sites
            WHERE order_id IN (
                {placeholders}
            )
            ORDER BY
                order_id,
                sequence_no
            """,
            order_ids,
        )

        site_rows = (
            cursor.fetchall()
        )


    sites_by_order: dict[
        str,
        list[dict[str, Any]],
    ] = {}

    for row in site_rows:
        order_id = str(
            row[1]
        )

        sites_by_order.setdefault(
            order_id,
            [],
        ).append(
            {
                "id": str(
                    row[0]
                ),
                "sequence_no": int(
                    row[2]
                ),
                "place_type": row[3],
                "place_name": row[4],
                "address_line": row[5],
                "access_point_note": (
                    row[6]
                ),
                "beacon_id": (
                    str(row[7])
                    if row[7]
                    else None
                ),
                "status": row[8],
            }
        )


    # --------------------------------------------------------
    # Factures
    #
    # invoices.order_id n'est pas UNIQUE :
    # on retient la plus récente par issued_at.
    # --------------------------------------------------------

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
                id,
                order_id,
                number,
                pdf_url,
                amount_gnf,
                status,
                issued_at,
                paid_at
            FROM public.invoices
            WHERE order_id IN (
                {placeholders}
            )
            ORDER BY
                order_id,
                issued_at DESC NULLS LAST
            """,
            order_ids,
        )

        invoice_rows = (
            cursor.fetchall()
        )


    invoice_by_order: dict[
        str,
        dict[str, Any],
    ] = {}

    for row in invoice_rows:
        order_id = str(
            row[1]
        )

        if order_id in invoice_by_order:
            continue

        invoice_by_order[
            order_id
        ] = {
            "id": str(
                row[0]
            ),
            "number": row[2],
            "pdf_url": row[3],
            "amount_gnf": int(
                row[4]
            ),
            "status": row[5],
            "issued_at": (
                row[6].isoformat()
                if row[6]
                else None
            ),
            "paid_at": (
                row[7].isoformat()
                if row[7]
                else None
            ),
        }


    # --------------------------------------------------------
    # Paiements
    #
    # La table actuelle ne possède pas created_at.
    # On ne prétend donc pas reconstruire une chronologie.
    # Les paiements confirmés/datés sont prioritaires.
    # --------------------------------------------------------

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
                id,
                order_id,
                provider,
                external_ref,
                amount_gnf,
                status,
                paid_at,
                confirmed_at
            FROM public.payments
            WHERE order_id IN (
                {placeholders}
            )
            ORDER BY
                order_id,
                COALESCE(
                    confirmed_at,
                    paid_at
                ) DESC NULLS LAST
            """,
            order_ids,
        )

        payment_rows = (
            cursor.fetchall()
        )


    payment_by_order: dict[
        str,
        dict[str, Any],
    ] = {}

    for row in payment_rows:
        order_id = str(
            row[1]
        )

        if order_id in payment_by_order:
            continue

        payment_by_order[
            order_id
        ] = {
            "id": str(
                row[0]
            ),
            "provider": row[2],
            "external_ref": row[3],
            "amount_gnf": int(
                row[4]
            ),
            "status": row[5],
            "paid_at": (
                row[6].isoformat()
                if row[6]
                else None
            ),
            "confirmed_at": (
                row[7].isoformat()
                if row[7]
                else None
            ),
        }


    # --------------------------------------------------------
    # Payload client
    # --------------------------------------------------------

    result: list[
        dict[str, Any]
    ] = []

    for row in order_rows:
        (
            order_id_raw,
            order_ref,
            offer_code,
            amount_gnf,
            order_status,
            created_at,
            raw_items,
            beacon_id,
            business_id,
            plan_id,
            formule_code,
            formule_label,
            plan_code,
            plan_name,
            plan_active,
        ) = row

        order_id = str(
            order_id_raw
        )

        plan_label = (
            (
                formule_label.strip()
            )
            if (
                isinstance(
                    formule_label,
                    str,
                )
                and formule_label.strip()
            )
            else (
                _localized_order_text(
                    plan_name
                )
                or offer_code
            )
        )

        result.append(
            {
                "id": order_id,
                "order_ref": (
                    order_ref
                ),
                "offer_code": (
                    offer_code
                ),
                "amount_gnf": int(
                    amount_gnf
                ),
                "status": (
                    order_status
                ),
                "created_at": (
                    created_at.isoformat()
                    if created_at
                    else None
                ),
                "items": (
                    _normalize_order_items(
                        raw_items
                    )
                ),
                "beacon_id": (
                    str(beacon_id)
                    if beacon_id
                    else None
                ),
                "business_id": (
                    str(business_id)
                    if business_id
                    else None
                ),
                "plan": (
                    {
                        "id": (
                            str(plan_id)
                            if plan_id
                            else None
                        ),
                        "code": (
                            plan_code
                            or formule_code
                            or offer_code
                        ),
                        "label": (
                            plan_label
                        ),
                        "active": (
                            bool(
                                plan_active
                            )
                            if plan_active
                            is not None
                            else None
                        ),
                    }
                    if (
                        plan_id
                        or plan_code
                        or formule_code
                        or plan_label
                    )
                    else None
                ),
                "sites": (
                    sites_by_order.get(
                        order_id,
                        [],
                    )
                ),
                "payment": (
                    payment_by_order.get(
                        order_id
                    )
                ),
                "invoice": (
                    invoice_by_order.get(
                        order_id
                    )
                ),
            }
        )

    return result



def _split_owner_report_description(
    value: str | None,
) -> tuple[
    str | None,
    str | None,
]:
    """
    Compatibilité historique :

    [Admin] dans description séparait
    le texte client de la réponse équipe.
    """

    if value is None:
        return (
            None,
            None,
        )

    text = str(
        value
    ).strip()

    if not text:
        return (
            None,
            None,
        )

    marker = "[Admin]"

    index = text.find(
        marker
    )

    if index < 0:
        return (
            text,
            None,
        )

    description = (
        text[:index]
        .strip()
        or None
    )

    admin_response = (
        text[
            index
            + len(marker):
        ]
        .strip()
        or None
    )

    return (
        description,
        admin_response,
    )


def list_owner_reports(
    user_id: str,
) -> list[dict[str, Any]]:
    """
    Signalements appartenant exclusivement
    au compte authentifié.

    Les déménagements restent des reports
    avec reason='moving'.
    """

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                r.id,
                r.reason,
                r.description,
                r.status,
                r.created_at,
                b.public_number
            FROM public.reports r
            LEFT JOIN public.beacons b
                ON b.id = r.beacon_id
            WHERE r.reporter_id = %s
            ORDER BY r.created_at DESC
            LIMIT 100
            """,
            [
                user_id,
            ],
        )

        rows = cursor.fetchall()

    result: list[
        dict[str, Any]
    ] = []

    for row in rows:

        (
            description,
            admin_response,
        ) = (
            _split_owner_report_description(
                row[2]
            )
        )

        reason = row[1]

        result.append(
            {
                "id": str(
                    row[0]
                ),
                "type": (
                    "moving"
                    if reason == "moving"
                    else "report"
                ),
                "reason": reason,
                "description": (
                    description
                ),
                "status": row[3],
                "created_at": (
                    row[4].isoformat()
                    if row[4]
                    else None
                ),
                "public_number": (
                    row[5]
                    or None
                ),
                "admin_response": (
                    admin_response
                ),
            }
        )

    return result


def list_owner_claims(
    user_id: str,
) -> list[dict[str, Any]]:
    """
    Réclamations de propriété du compte.

    Important :
    evidence n'est volontairement jamais
    exposé dans ce payload de consultation.
    """

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                c.id,
                c.status,
                c.decision_note,
                c.created_at,
                c.decided_at,
                b.public_number
            FROM public.claim_requests c
            LEFT JOIN public.beacons b
                ON b.id = c.beacon_id
            WHERE c.requester_id = %s
            ORDER BY c.created_at DESC
            LIMIT 100
            """,
            [
                user_id,
            ],
        )

        rows = cursor.fetchall()

    return [
        {
            "id": str(
                row[0]
            ),
            "status": row[1],
            "decision_note": (
                row[2]
            ),
            "created_at": (
                row[3].isoformat()
                if row[3]
                else None
            ),
            "decided_at": (
                row[4].isoformat()
                if row[4]
                else None
            ),
            "public_number": (
                row[5]
                or None
            ),
        }
        for row in rows
    ]
