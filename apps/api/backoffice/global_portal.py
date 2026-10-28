from __future__ import annotations

from datetime import timedelta

from django.db import connection
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied


SPACE_ROLES = {
    "supervisor": {
        "supervisor",
        "admin",
        "super_admin",
    },
    "ops": {
        "ops",
        "admin",
        "super_admin",
    },
    "sales": {
        "sales",
        "admin",
        "super_admin",
    },
    "support": {
        "support",
        "admin",
        "super_admin",
    },
}


SPACE_NAVIGATION = {
    "supervisor": [
        {
            "href": "/supervisor",
            "label": "Tableau de bord",
        },
        {
            "href": "/supervisor/balises-disponibles",
            "label": "Balises disponibles",
        },
        {
            "href": "/supervisor/affectations",
            "label": "Affectations",
        },
        {
            "href": "/supervisor/planning",
            "label": "Planification",
        },
        {
            "href": "/supervisor/installations",
            "label": "Installations / QC",
        },
        {
            "href": "/supervisor/report-installations",
            "label": "Rapport installations",
        },
        {
            "href": "/supervisor/consultations",
            "label": "Consultations",
        },
        {
            "href": "/supervisor/signalements",
            "label": "Signalements",
        },
        {
            "href": "/supervisor/reclamations",
            "label": "Réclamations",
        },
    ],
    "ops": [
        {
            "href": "/ops",
            "label": "Tableau de bord",
        },
        {
            "href": "/ops/balises",
            "label": "Balises",
        },
        {
            "href": "/ops/stock",
            "label": "Stock",
        },
        {
            "href": "/ops/commandes-fournisseurs",
            "label": "Commandes fournisseurs",
        },
        {
            "href": "/ops/exports",
            "label": "Exports",
        },
    ],
    "sales": [
        {
            "href": "/sales",
            "label": "Tableau de bord",
        },
        {
            "href": "/sales/paiements",
            "label": "Paiements",
        },
        {
            "href": "/sales/commandes",
            "label": "Commandes",
        },
        {
            "href": "/sales/abonnements",
            "label": "Abonnements",
        },
        {
            "href": "/sales/offres",
            "label": "Offres",
        },
        {
            "href": "/sales/clients",
            "label": "Clients",
        },
        {
            "href": "/sales/installations",
            "label": "Installations à planifier",
        },
    ],
    "support": [
        {
            "href": "/support",
            "label": "Tableau de bord",
        },
        {
            "href": "/support/signalements",
            "label": "Signalements",
        },
        {
            "href": "/support/reclamations",
            "label": "Réclamations",
        },
        {
            "href": "/support/comptes",
            "label": "Comptes",
        },
        {
            "href": "/support/terrain-gps",
            "label": "Terrain GPS",
        },
    ],
}


def _identity(request) -> dict:
    identity = getattr(
        request,
        "backoffice_identity",
        None,
    )

    if not identity:
        raise PermissionDenied(
            "Identité back-office introuvable."
        )

    return identity


def resolve_space(
    request,
    *,
    requested_space: str | None = None,
) -> tuple[str, dict]:
    identity = _identity(request)

    space = str(
        requested_space
        or request.query_params.get("space")
        or identity.get("role")
        or ""
    ).strip()

    if space not in SPACE_ROLES:
        raise PermissionDenied(
            "Espace back-office invalide."
        )

    role = identity.get("role")

    if role not in SPACE_ROLES[space]:
        raise PermissionDenied(
            "Accès refusé à cet espace."
        )

    return space, identity


def load_navigation(
    request,
) -> dict:
    space, identity = resolve_space(request)

    return {
        "space": space,
        "home": f"/{space}",
        "user": identity,
        "items": SPACE_NAVIGATION[space],
    }


def _scalar(
    cursor,
    sql: str,
    params=None,
):
    cursor.execute(
        sql,
        params or [],
    )

    row = cursor.fetchone()

    return row[0] if row else None


def _metric(
    key: str,
    label: str,
    value,
    *,
    format_kind: str = "number",
) -> dict:
    return {
        "key": key,
        "label": label,
        "value": (
            0
            if value is None
            else value
        ),
        "format": format_kind,
    }


def _supervisor_dashboard() -> dict:
    since_7d = (
        timezone.now()
        - timedelta(days=7)
    )

    with connection.cursor() as cursor:
        active_beacons = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.beacons
            WHERE status = 'active'
            """,
        )

        available_physical_beacons = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.beacons b
            WHERE
                b.numbering_version = 'v1'
                AND b.status = 'available'
                AND b.assigned_agent_id IS NULL
                AND b.lot_id IS NOT NULL
                AND b.category <> 'digital_only'
            """,
        )

        pending_installations = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.installations
            WHERE
                validated_at IS NULL
                AND uninstalled_at IS NULL
            """,
        )

        installations_7d = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.installations
            WHERE installed_at >= %s
            """,
            [since_7d],
        )

        active_addresses = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.addresses
            WHERE status = 'active'
            """,
        )

        active_agents = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.agents
            WHERE active IS TRUE
            """,
        )

        open_reports = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.reports
            WHERE status IN ('new', 'in_review')
            """,
        )

        cursor.execute(
            """
            SELECT
                i.id,
                b.public_number,
                i.installed_at,
                i.validated_at,
                ag.badge_number
            FROM public.installations i
            LEFT JOIN public.beacons b
                ON b.id = i.beacon_id
            LEFT JOIN public.agents ag
                ON ag.id = i.agent_id
            ORDER BY
                i.installed_at DESC NULLS LAST,
                i.id
            LIMIT 8
            """
        )

        recent = [
            {
                "id": str(row[0]),
                "primary": (
                    row[1]
                    or "Installation"
                ),
                "secondary": (
                    row[4]
                    or "Agent non renseigné"
                ),
                "status": (
                    "validated"
                    if row[3]
                    else "pending"
                ),
                "date": (
                    row[2].isoformat()
                    if row[2]
                    else None
                ),
            }
            for row in cursor.fetchall()
        ]

    return {
        "space": "supervisor",
        "title": "Pilotage terrain",
        "subtitle": (
            "Vue consolidée des installations, "
            "adresses et contrôles terrain."
        ),
        "metrics": [
            _metric(
                "active_beacons",
                "Balises actives",
                active_beacons,
            ),
            _metric(
                "available_physical_beacons",
                "Balises disponibles",
                available_physical_beacons,
            ),
            _metric(
                "pending_installations",
                "Installations à valider",
                pending_installations,
            ),
            _metric(
                "installations_7d",
                "Installations sur 7 jours",
                installations_7d,
            ),
            _metric(
                "active_addresses",
                "Adresses actives",
                active_addresses,
            ),
            _metric(
                "active_agents",
                "Agents actifs",
                active_agents,
            ),
            _metric(
                "open_reports",
                "Signalements ouverts",
                open_reports,
            ),
        ],
        "activity": recent,
    }


def _ops_dashboard() -> dict:
    month_start = (
        timezone.now()
        .replace(
            day=1,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (
                    WHERE status = 'generated'
                ) AS generated,
                COUNT(*) FILTER (
                    WHERE status = 'assigned'
                ) AS assigned,
                COUNT(*) FILTER (
                    WHERE status = 'active'
                ) AS active,
                COUNT(*) FILTER (
                    WHERE status = 'suspended'
                ) AS suspended
            FROM public.beacons
            """
        )

        (
            beacons_total,
            generated,
            assigned,
            active,
            suspended,
        ) = cursor.fetchone()

        lots_total = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.lots
            """,
        )

        lots_received = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.lots
            WHERE status = 'received'
            """,
        )

        installations_month = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.installations
            WHERE installed_at >= %s
            """,
            [month_start],
        )

        cursor.execute(
            """
            SELECT
                id,
                code,
                quantity,
                status,
                category,
                received_at
            FROM public.lots
            ORDER BY
                received_at DESC NULLS LAST,
                code
            LIMIT 8
            """
        )

        recent = [
            {
                "id": str(row[0]),
                "primary": row[1],
                "secondary": (
                    f"{row[2]} balise(s)"
                ),
                "status": row[3],
                "date": (
                    row[5].isoformat()
                    if row[5]
                    else None
                ),
            }
            for row in cursor.fetchall()
        ]

    return {
        "space": "ops",
        "title": "Opérations & logistique",
        "subtitle": (
            "Stocks, lots, balises et activité "
            "d'installation."
        ),
        "metrics": [
            _metric(
                "beacons_total",
                "Balises totales",
                beacons_total,
            ),
            _metric(
                "generated",
                "Balises générées",
                generated,
            ),
            _metric(
                "assigned",
                "Balises assignées",
                assigned,
            ),
            _metric(
                "active",
                "Balises actives",
                active,
            ),
            _metric(
                "suspended",
                "Balises suspendues",
                suspended,
            ),
            _metric(
                "lots_total",
                "Lots",
                lots_total,
            ),
            _metric(
                "lots_received",
                "Lots reçus",
                lots_received,
            ),
            _metric(
                "installations_month",
                "Installations du mois",
                installations_month,
            ),
        ],
        "activity": recent,
    }


def _sales_dashboard() -> dict:
    since_7d = (
        timezone.now()
        - timedelta(days=7)
    )

    with connection.cursor() as cursor:
        orders_total = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.orders
            """,
        )

        pending_orders = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.orders
            WHERE status = 'pending'
            """,
        )

        paid_orders = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.orders
            WHERE status = 'paid'
            """,
        )

        revenue = _scalar(
            cursor,
            """
            SELECT COALESCE(
                SUM(amount_gnf),
                0
            )
            FROM public.payments
            WHERE status = 'success'
            """,
        )

        pending_payments = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.payments
            WHERE status = 'pending'
            """,
        )

        active_subscriptions = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.subscriptions
            WHERE status = 'active'
            """,
        )

        active_plans = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.cms_plans
            WHERE active IS TRUE
            """,
        )

        recent_clients = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.profiles
            WHERE
                role = 'user'
                AND created_at >= %s
            """,
            [since_7d],
        )

        cursor.execute(
            """
            SELECT
                id,
                order_ref,
                COALESCE(
                    full_name,
                    email,
                    phone,
                    'Client'
                ) AS client,
                amount_gnf,
                status,
                created_at
            FROM public.orders
            ORDER BY
                created_at DESC NULLS LAST,
                id
            LIMIT 8
            """
        )

        recent = [
            {
                "id": str(row[0]),
                "primary": row[1],
                "secondary": row[2],
                "status": row[4],
                "date": (
                    row[5].isoformat()
                    if row[5]
                    else None
                ),
                "amount_gnf": int(
                    row[3] or 0
                ),
            }
            for row in cursor.fetchall()
        ]

    return {
        "space": "sales",
        "title": "Pilotage commercial",
        "subtitle": (
            "Commandes, paiements, offres "
            "et activité clients."
        ),
        "metrics": [
            _metric(
                "orders_total",
                "Commandes",
                orders_total,
            ),
            _metric(
                "pending_orders",
                "Commandes en attente",
                pending_orders,
            ),
            _metric(
                "paid_orders",
                "Commandes payées",
                paid_orders,
            ),
            _metric(
                "revenue",
                "Encaissements",
                int(revenue or 0),
                format_kind="gnf",
            ),
            _metric(
                "pending_payments",
                "Paiements en attente",
                pending_payments,
            ),
            _metric(
                "active_subscriptions",
                "Abonnements actifs",
                active_subscriptions,
            ),
            _metric(
                "active_plans",
                "Offres actives",
                active_plans,
            ),
            _metric(
                "recent_clients",
                "Nouveaux clients 7j",
                recent_clients,
            ),
        ],
        "activity": recent,
    }


def _support_dashboard() -> dict:
    since_7d = (
        timezone.now()
        - timedelta(days=7)
    )

    with connection.cursor() as cursor:
        open_reports = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.reports
            WHERE status IN ('new', 'in_review')
            """,
        )

        new_reports = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.reports
            WHERE status = 'new'
            """,
        )

        in_review = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.reports
            WHERE status = 'in_review'
            """,
        )

        resolved_7d = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.reports
            WHERE
                status = 'resolved'
                AND created_at >= %s
            """,
            [since_7d],
        )

        pending_claims = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.claim_requests
            WHERE status = 'pending'
            """,
        )

        approved_claims_7d = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.claim_requests
            WHERE
                status = 'approved'
                AND decided_at >= %s
            """,
            [since_7d],
        )

        rejected_claims_7d = _scalar(
            cursor,
            """
            SELECT COUNT(*)
            FROM public.claim_requests
            WHERE
                status = 'rejected'
                AND decided_at >= %s
            """,
            [since_7d],
        )

        cursor.execute(
            """
            SELECT
                r.id,
                r.reason,
                r.status,
                r.created_at,
                b.public_number
            FROM public.reports r
            LEFT JOIN public.beacons b
                ON b.id = r.beacon_id
            ORDER BY
                r.created_at DESC NULLS LAST,
                r.id
            LIMIT 8
            """
        )

        recent = [
            {
                "id": str(row[0]),
                "primary": row[1],
                "secondary": (
                    row[4]
                    or "Sans balise"
                ),
                "status": row[2],
                "date": (
                    row[3].isoformat()
                    if row[3]
                    else None
                ),
            }
            for row in cursor.fetchall()
        ]

    return {
        "space": "support",
        "title": "Centre support",
        "subtitle": (
            "Signalements citoyens, "
            "réclamations et comptes."
        ),
        "metrics": [
            _metric(
                "open_reports",
                "Signalements ouverts",
                open_reports,
            ),
            _metric(
                "new_reports",
                "Nouveaux signalements",
                new_reports,
            ),
            _metric(
                "in_review",
                "En cours",
                in_review,
            ),
            _metric(
                "resolved_7d",
                "Résolus sur 7 jours",
                resolved_7d,
            ),
            _metric(
                "pending_claims",
                "Réclamations en attente",
                pending_claims,
            ),
            _metric(
                "approved_claims_7d",
                "Réclamations approuvées 7j",
                approved_claims_7d,
            ),
            _metric(
                "rejected_claims_7d",
                "Réclamations rejetées 7j",
                rejected_claims_7d,
            ),
        ],
        "activity": recent,
    }


ROLE_DASHBOARD_LOADERS = {
    "supervisor": _supervisor_dashboard,
    "ops": _ops_dashboard,
    "sales": _sales_dashboard,
    "support": _support_dashboard,
}


def load_role_dashboard(
    request,
) -> dict:
    space, _identity_value = resolve_space(request)

    loader = ROLE_DASHBOARD_LOADERS.get(
        space
    )

    if loader is None:
        raise PermissionDenied(
            "Dashboard indisponible."
        )

    return loader()