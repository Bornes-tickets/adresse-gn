from datetime import timedelta

from django.db import connection
from django.utils import timezone


CANONICAL_BEACON_STATUSES = (
    "generated",
    "assigned",
    "active",
    "suspended",
    "cancelled",
)

OPEN_REPORT_STATUSES = (
    "new",
    "in_review",
)


def _fetchone(sql, params=None):
    with connection.cursor() as cursor:
        cursor.execute(
            sql,
            params or [],
        )
        return cursor.fetchone()


def _fetchall(sql, params=None):
    with connection.cursor() as cursor:
        cursor.execute(
            sql,
            params or [],
        )
        return cursor.fetchall()


def load_dashboard():
    """
    Dashboard opérationnel partagé par les espaces
    Admin et Supervisor.

    Contrat repris du dashboard historique TanStack,
    mais toutes les données sont désormais lues côté
    Django directement dans PostgreSQL.
    """

    now = timezone.now()

    seven_days_ago = (
        now - timedelta(days=7)
    )

    fourteen_days_ago = (
        now - timedelta(days=14)
    )

    ninety_days_ago = (
        now - timedelta(days=89)
    )

    month_start = now.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    # ============================================================================================
    # KPIs principaux
    # ============================================================================================

    row = _fetchone(
        """
        SELECT
            (
                SELECT COUNT(*)
                FROM public.beacons
                WHERE status = 'active'
            ) AS active_beacons,

            (
                SELECT COUNT(*)
                FROM public.beacons
                WHERE status = 'generated'
            ) AS generated_beacons,

            (
                SELECT COUNT(*)
                FROM public.installations
                WHERE installed_at >= %s
            ) AS installations_7d,

            (
                SELECT COUNT(*)
                FROM public.addresses
                WHERE
                    status = 'active'
                    AND visibility = 'public'
            ) AS public_addresses,

            (
                SELECT COUNT(*)
                FROM public.addresses
                WHERE
                    status = 'active'
                    AND visibility = 'private'
            ) AS private_addresses,

            (
                SELECT COUNT(*)
                FROM public.reports
                WHERE status = ANY(%s)
            ) AS open_reports,

            (
                SELECT COUNT(*)
                FROM public.agents
                WHERE active IS TRUE
            ) AS active_agents
        """,
        [
            seven_days_ago,
            list(OPEN_REPORT_STATUSES),
        ],
    )

    (
        active_beacons,
        generated_beacons,
        installations_7d,
        public_addresses,
        private_addresses,
        open_reports,
        active_agents,
    ) = row

    # ============================================================================================
    # Installations par jour — 90 jours avec remplissage des jours à zéro
    # ============================================================================================

    installation_rows = _fetchall(
        """
        SELECT
            DATE(
                installed_at
                AT TIME ZONE 'UTC'
            ) AS day,
            COUNT(*) AS total
        FROM public.installations
        WHERE
            installed_at IS NOT NULL
            AND installed_at >= %s
        GROUP BY
            DATE(
                installed_at
                AT TIME ZONE 'UTC'
            )
        ORDER BY day
        """,
        [
            ninety_days_ago,
        ],
    )

    installations_by_day = {
        row[0].isoformat(): int(row[1])
        for row in installation_rows
    }

    installation_series = []

    for offset in range(89, -1, -1):
        day = (
            now - timedelta(days=offset)
        ).date().isoformat()

        installation_series.append(
            {
                "jour": day,
                "total": installations_by_day.get(
                    day,
                    0,
                ),
            }
        )

    # ============================================================================================
    # Répartition catégories
    # ============================================================================================

    category_rows = _fetchall(
        """
        SELECT
            COALESCE(
                category,
                'autre'
            ) AS category,
            COUNT(*) AS total
        FROM public.addresses
        WHERE status = 'active'
        GROUP BY category
        ORDER BY total DESC, category
        """
    )

    categories = [
        {
            "categorie": row[0],
            "total": int(row[1]),
        }
        for row in category_rows
    ]

    # ============================================================================================
    # Top zones
    # ============================================================================================

    zone_rows = _fetchall(
        """
        SELECT
            COALESCE(
                c.name,
                'Non affectée'
            ) AS zone_name,
            COUNT(*) AS total
        FROM public.addresses a
        LEFT JOIN public.communes c
            ON c.id = a.commune_id
        WHERE a.status = 'active'
        GROUP BY
            COALESCE(
                c.name,
                'Non affectée'
            )
        ORDER BY total DESC, zone_name
        LIMIT 5
        """
    )

    top_zones = [
        {
            "nom": row[0],
            "total": int(row[1]),
        }
        for row in zone_rows
    ]

    # ============================================================================================
    # Points cartographiques
    #
    # Limite historique conservée : 2000 points max dans le dashboard.
    # ============================================================================================

    point_rows = _fetchall(
        """
        SELECT
            ST_Y(
                a.location::geometry
            ) AS lat,

            ST_X(
                a.location::geometry
            ) AS lng,

            a.visibility,

            b.public_number

        FROM public.addresses a

        LEFT JOIN public.beacons b
            ON b.id = a.beacon_id

        WHERE
            a.status = 'active'
            AND a.location IS NOT NULL

        ORDER BY
            a.created_at DESC NULLS LAST,
            a.id

        LIMIT 2000
        """
    )

    points = [
        {
            "lat": float(row[0]),
            "lng": float(row[1]),
            "visibility": row[2] or "public",
            "number": row[3],
        }
        for row in point_rows
    ]

    # ============================================================================================
    # Statuts balises
    #
    # Les statuts historiques sont toujours retournés, même à zéro.
    # Les nouveaux statuts réellement présents (ex. replaced) sont ajoutés.
    # ============================================================================================

    beacon_status_rows = _fetchall(
        """
        SELECT
            status,
            COUNT(*)
        FROM public.beacons
        GROUP BY status
        ORDER BY status
        """
    )

    actual_beacon_statuses = {
        str(row[0]): int(row[1])
        for row in beacon_status_rows
    }

    status_order = list(
        CANONICAL_BEACON_STATUSES
    )

    for status_name in sorted(
        actual_beacon_statuses
    ):
        if status_name not in status_order:
            status_order.append(
                status_name
            )

    beacon_statuses = [
        {
            "statut": status_name,
            "total": actual_beacon_statuses.get(
                status_name,
                0,
            ),
        }
        for status_name in status_order
    ]

    # ============================================================================================
    # Tendances 7 jours / 7 jours précédents
    # ============================================================================================

    trend_row = _fetchone(
        """
        SELECT
            (
                SELECT COUNT(*)
                FROM public.installations
                WHERE installed_at >= %s
            ) AS installations_current,

            (
                SELECT COUNT(*)
                FROM public.installations
                WHERE
                    installed_at >= %s
                    AND installed_at < %s
            ) AS installations_previous,

            (
                SELECT COUNT(*)
                FROM public.addresses
                WHERE created_at >= %s
            ) AS addresses_current,

            (
                SELECT COUNT(*)
                FROM public.addresses
                WHERE
                    created_at >= %s
                    AND created_at < %s
            ) AS addresses_previous,

            (
                SELECT COUNT(*)
                FROM public.orders
                WHERE created_at >= %s
            ) AS orders_current,

            (
                SELECT COUNT(*)
                FROM public.orders
                WHERE
                    created_at >= %s
                    AND created_at < %s
            ) AS orders_previous
        """,
        [
            seven_days_ago,
            fourteen_days_ago,
            seven_days_ago,
            seven_days_ago,
            fourteen_days_ago,
            seven_days_ago,
            seven_days_ago,
            fourteen_days_ago,
            seven_days_ago,
        ],
    )

    (
        installations_current,
        installations_previous,
        addresses_current,
        addresses_previous,
        orders_current,
        orders_previous,
    ) = trend_row

    # ============================================================================================
    # Activité récente
    # ============================================================================================

    recent_installations_rows = (
        _fetchall(
            """
            SELECT
                i.id,
                b.public_number,
                i.installed_at
            FROM public.installations i
            LEFT JOIN public.beacons b
                ON b.id = i.beacon_id
            ORDER BY
                i.installed_at DESC NULLS LAST,
                i.id
            LIMIT 6
            """
        )
    )

    recent_orders_rows = _fetchall(
        """
        SELECT
            id,
            order_ref,
            amount_gnf,
            status,
            created_at
        FROM public.orders
        ORDER BY
            created_at DESC NULLS LAST,
            id
        LIMIT 6
        """
    )

    recent_reports_rows = _fetchall(
        """
        SELECT
            id,
            reason,
            status,
            created_at
        FROM public.reports
        ORDER BY
            created_at DESC NULLS LAST,
            id
        LIMIT 6
        """
    )

    recent_installations = [
        {
            "id": str(row[0]),
            "numero": row[1],
            "date": (
                row[2].isoformat()
                if row[2]
                else None
            ),
        }
        for row in recent_installations_rows
    ]

    recent_orders = [
        {
            "id": str(row[0]),
            "ref": row[1],
            "montant": int(
                row[2] or 0
            ),
            "statut": row[3],
            "date": (
                row[4].isoformat()
                if row[4]
                else None
            ),
        }
        for row in recent_orders_rows
    ]

    recent_reports = [
        {
            "id": str(row[0]),
            "raison": row[1],
            "statut": row[2],
            "date": (
                row[3].isoformat()
                if row[3]
                else None
            ),
        }
        for row in recent_reports_rows
    ]

    # ============================================================================================
    # Objectifs mensuels
    # ============================================================================================

    objective_row = _fetchone(
        """
        SELECT
            (
                SELECT COUNT(*)
                FROM public.installations
                WHERE installed_at >= %s
            ) AS installations_month,

            (
                SELECT COUNT(*)
                FROM public.addresses
                WHERE created_at >= %s
            ) AS addresses_month,

            (
                SELECT COALESCE(
                    SUM(amount_gnf),
                    0
                )
                FROM public.payments
                WHERE
                    status = 'success'
                    AND COALESCE(
                        paid_at,
                        confirmed_at,
                        created_at
                    ) >= %s
            ) AS revenue_month
        """,
        [
            month_start,
            month_start,
            month_start,
        ],
    )

    (
        installations_month,
        addresses_month,
        revenue_month,
    ) = objective_row

    # ============================================================================================
    # Contrat historique
    # ============================================================================================

    return {
        "balisesActives": int(
            active_beacons
        ),
        "balisesGenerees": int(
            generated_beacons
        ),
        "installations7j": int(
            installations_7d
        ),
        "adressesPubliques": int(
            public_addresses
        ),
        "adressesPrivees": int(
            private_addresses
        ),
        "signalementsOuverts": int(
            open_reports
        ),
        "agentsActifs": int(
            active_agents
        ),

        "installationsParJour":
            installation_series,

        "parCategorie":
            categories,

        "points":
            points,

        "tendances": {
            "installations": {
                "actuel": int(
                    installations_current
                ),
                "precedent": int(
                    installations_previous
                ),
            },
            "adresses": {
                "actuel": int(
                    addresses_current
                ),
                "precedent": int(
                    addresses_previous
                ),
            },
            "commandes": {
                "actuel": int(
                    orders_current
                ),
                "precedent": int(
                    orders_previous
                ),
            },
        },

        "statutsBalises":
            beacon_statuses,

        "topZones":
            top_zones,

        "activite": {
            "installations":
                recent_installations,
            "commandes":
                recent_orders,
            "signalements":
                recent_reports,
        },

        "objectifs": [
            {
                "cle": "installations",
                "valeur": int(
                    installations_month
                ),
                "cible": 500,
            },
            {
                "cle": "adresses",
                "valeur": int(
                    addresses_month
                ),
                "cible": 800,
            },
            {
                "cle": "revenus",
                "valeur": int(
                    revenue_month or 0
                ),
                "cible": 50_000_000,
            },
        ],
    }