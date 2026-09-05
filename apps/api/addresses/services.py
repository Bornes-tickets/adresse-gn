import json
import re
from datetime import timedelta
from typing import Any

from django.db import connection, transaction
from django.utils import timezone


# ============================================================
# CONSTANTES METIER ADRESSE GN
# ============================================================

BEACON_REGEX = re.compile(r"^GN-[A-Z]{3}-\d{6}$")

DEFAULT_ZONE = "CKY"

MAX_PER_MINUTE = 60

MAX_CONSECUTIVE_MISSES = 5

MISS_BLOCK_MINUTES = 5


# ============================================================
# NORMALISATION
# ============================================================

def normalize_address_number(
    value: str,
    zone: str = DEFAULT_ZONE,
) -> str:
    raw = value.strip().upper()

    compact = re.sub(r"\s+", "", raw)

    # Exemple :
    # 582741 -> GN-CKY-582741
    if re.fullmatch(r"\d{6}", compact):
        return f"GN-{zone}-{compact}"

    # Accepte également différentes saisies compactes :
    # GNCKY582741
    # GN-CKY-582741
    # GN CKY 582741
    compact = re.sub(r"[^A-Z0-9]", "", compact)

    match = re.fullmatch(
        r"GN([A-Z]{3})(\d{6})",
        compact,
    )

    if match:
        return f"GN-{match.group(1)}-{match.group(2)}"

    return raw


# ============================================================
# CLIENT IP
# ============================================================

def client_ip(request) -> str:
    forwarded = request.META.get(
        "HTTP_X_FORWARDED_FOR"
    )

    if forwarded:
        return forwarded.split(",")[0].strip()

    return (
        request.META.get(
            "HTTP_CF_CONNECTING_IP"
        )
        or request.META.get(
            "HTTP_X_REAL_IP"
        )
        or request.META.get(
            "REMOTE_ADDR"
        )
        or "unknown"
    )


# ============================================================
# OUTILS SQL
# ============================================================

def _dict_fetchone(
    cursor,
) -> dict[str, Any] | None:
    row = cursor.fetchone()

    if row is None:
        return None

    columns = [
        column.name
        for column in cursor.description
    ]

    return dict(
        zip(columns, row)
    )


# ============================================================
# PROTECTION CONTRE LES RECHERCHES ABUSIVES
# ============================================================

def _check_miss_block(
    ip: str,
) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT blocked_until
            FROM public.search_misses
            WHERE ip = %s
            """,
            [ip],
        )

        row = cursor.fetchone()

    if not row or not row[0]:
        return 0

    remaining = (
        row[0]
        - timezone.now()
    )

    if remaining.total_seconds() <= 0:
        return 0

    return (
        int(
            remaining.total_seconds()
        )
        + 1
    )


def _increment_rate_limit(
    ip: str,
) -> bool:
    now = timezone.now()

    bucket = now.replace(
        second=0,
        microsecond=0,
    )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.rate_limits
                (
                    ip,
                    minute_bucket,
                    count
                )
            VALUES
                (
                    %s,
                    %s,
                    1
                )

            ON CONFLICT
                (
                    ip,
                    minute_bucket
                )

            DO UPDATE SET
                count =
                    public.rate_limits.count + 1

            RETURNING count
            """,
            [
                ip,
                bucket,
            ],
        )

        count = cursor.fetchone()[0]

    return count <= MAX_PER_MINUTE


def _register_miss(
    ip: str,
) -> None:
    with transaction.atomic():

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT miss_count
                FROM public.search_misses
                WHERE ip = %s
                FOR UPDATE
                """,
                [ip],
            )

            row = cursor.fetchone()

            count = (
                row[0]
                if row
                else 0
            ) + 1

            blocked_until = None

            stored_count = count

            if (
                count
                >= MAX_CONSECUTIVE_MISSES
            ):
                blocked_until = (
                    timezone.now()
                    + timedelta(
                        minutes=(
                            MISS_BLOCK_MINUTES
                        )
                    )
                )

                stored_count = 0

            cursor.execute(
                """
                INSERT INTO public.search_misses
                    (
                        ip,
                        miss_count,
                        blocked_until,
                        updated_at
                    )

                VALUES
                    (
                        %s,
                        %s,
                        %s,
                        %s
                    )

                ON CONFLICT (ip)

                DO UPDATE SET
                    miss_count =
                        EXCLUDED.miss_count,

                    blocked_until =
                        EXCLUDED.blocked_until,

                    updated_at =
                        EXCLUDED.updated_at
                """,
                [
                    ip,
                    stored_count,
                    blocked_until,
                    timezone.now(),
                ],
            )


def _reset_misses(
    ip: str,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.search_misses
                (
                    ip,
                    miss_count,
                    blocked_until,
                    updated_at
                )

            VALUES
                (
                    %s,
                    0,
                    NULL,
                    %s
                )

            ON CONFLICT (ip)

            DO UPDATE SET
                miss_count = 0,
                blocked_until = NULL,
                updated_at =
                    EXCLUDED.updated_at
            """,
            [
                ip,
                timezone.now(),
            ],
        )


# ============================================================
# BEACONS
# ============================================================

def _beacon_id(
    public_number: str,
) -> str | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id
            FROM public.beacons
            WHERE public_number = %s
            LIMIT 1
            """,
            [public_number],
        )

        row = cursor.fetchone()

    if not row:
        return None

    return str(
        row[0]
    )


# ============================================================
# RECHERCHE METIER
# ============================================================

def _search_by_number(
    public_number: str,
) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT *
            FROM public.search_by_number(%s)
            """,
            [public_number],
        )

        result = _dict_fetchone(
            cursor
        )

    if not result:
        return None

    # --------------------------------------------------------
    # Latitude / Longitude
    # --------------------------------------------------------

    if (
        result.get("lat")
        is not None
    ):
        result["lat"] = float(
            result["lat"]
        )

    if (
        result.get("lng")
        is not None
    ):
        result["lng"] = float(
            result["lng"]
        )

    # --------------------------------------------------------
    # Horaires d'ouverture
    #
    # La fonction PostgreSQL peut actuellement renvoyer
    # opening_hours sous forme de texte JSON.
    #
    # L'API doit exposer un véritable objet JSON.
    # --------------------------------------------------------

    opening_hours = result.get(
        "opening_hours"
    )

    if isinstance(
        opening_hours,
        str,
    ):
        try:
            result["opening_hours"] = (
                json.loads(
                    opening_hours
                )
            )

        except (
            json.JSONDecodeError,
            TypeError,
        ):
            result[
                "opening_hours"
            ] = None

    return result


# ============================================================
# JOURNALISATION
# ============================================================

def _log_search(
    number: str,
    beacon_id: str | None,
    ip: str,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.search_logs
                (
                    query,
                    beacon_id_found,
                    user_id,
                    ip
                )

            VALUES
                (
                    %s,
                    %s,
                    NULL,
                    %s
                )
            """,
            [
                number,
                beacon_id,
                (
                    None
                    if ip == "unknown"
                    else ip
                ),
            ],
        )


# ============================================================
# SERVICE PUBLIC
# ============================================================

def search_address(
    raw_number: str,
    ip: str,
) -> dict[str, Any]:

    # --------------------------------------------------------
    # Normalisation
    # --------------------------------------------------------

    number = normalize_address_number(
        raw_number
    )

    # --------------------------------------------------------
    # Validation du format
    # --------------------------------------------------------

    if not BEACON_REGEX.fullmatch(
        number
    ):
        return {
            "status": "invalid",

            "beacon_id": None,

            "result": None,

            "message": (
                "Format de numéro invalide "
                "(attendu GN-XXX-999999)."
            ),
        }

    # --------------------------------------------------------
    # Blocage après trop de recherches infructueuses
    # --------------------------------------------------------

    blocked_seconds = (
        _check_miss_block(
            ip
        )
    )

    if blocked_seconds > 0:
        return {
            "status": "rate_limited",

            "beacon_id": None,

            "result": None,

            "retry_after_seconds":
                blocked_seconds,

            "message": (
                "Trop de recherches "
                "infructueuses. "
                "Réessayez dans quelques "
                "minutes."
            ),
        }

    # --------------------------------------------------------
    # Rate limiting général
    # --------------------------------------------------------

    if not _increment_rate_limit(
        ip
    ):
        return {
            "status": "rate_limited",

            "beacon_id": None,

            "result": None,

            "retry_after_seconds": 60,

            "message": (
                "Trop de recherches. "
                "Réessayez dans une minute."
            ),
        }

    # --------------------------------------------------------
    # Recherche PostgreSQL
    # --------------------------------------------------------

    result = _search_by_number(
        number
    )

    # --------------------------------------------------------
    # Adresse trouvée
    # --------------------------------------------------------

    if result:
        beacon_id = _beacon_id(
            result[
                "public_number"
            ]
        )

        _log_search(
            number,
            beacon_id,
            ip,
        )

        _reset_misses(
            ip
        )

        return {
            "status": "found",

            "beacon_id":
                beacon_id,

            "result":
                result,
        }

    # --------------------------------------------------------
    # Adresse introuvable
    # --------------------------------------------------------

    _log_search(
        number,
        None,
        ip,
    )

    _register_miss(
        ip
    )

    return {
        "status": "not_found",

        "beacon_id": None,

        "result": None,

        "message": (
            "Aucune adresse ne "
            "correspond à ce numéro."
        ),
    }
def get_address_detail(raw_number: str) -> dict:
    """
    Retourne une Adresse GN publique sans appliquer
    le rate limiting ni journaliser une nouvelle recherche.

    Utilisé notamment par la fiche publique :
    /a/GN-CKY-582741
    """

    number = normalize_address_number(raw_number)

    if not number or not BEACON_REGEX.fullmatch(number):
        return {
            "status": "invalid",
            "beacon_id": None,
            "result": None,
            "message": "Numéro Adresse GN invalide.",
        }

    result = _search_by_number(number)

    if result is None:
        return {
            "status": "not_found",
            "beacon_id": None,
            "result": None,
            "message": "Adresse introuvable.",
        }

    beacon_id = _beacon_id(number)

    return {
        "status": "found",
        "beacon_id": beacon_id,
        "result": result,
        "message": None,
    }
# ---------------------------------------------------------------------------
# Journalisation des lancements d'itinéraire
# ---------------------------------------------------------------------------

# Valeurs exposées par l'API / utilisées par le frontend.
ROUTE_PROVIDERS = {
    "google_maps",
    "waze",
}

# Valeurs réellement autorisées par la contrainte CHECK
# de public.route_logs.provider dans la base historique.
ROUTE_PROVIDER_DB_VALUES = {
    "google_maps": "google",
    "waze": "waze",
}


def log_route_launch(
    raw_number: str,
    provider: str,
    user_id: str | None = None,
) -> dict:
    """
    Journalise le lancement d'un itinéraire depuis une fiche Adresse GN.

    Cette opération ne doit jamais compter comme une nouvelle recherche.

    Le frontend conserve les identifiants :
    - google_maps
    - waze

    La table historique public.route_logs stocke :
    - google
    - waze
    - apple
    - other

    Si Django a validé un Bearer token Supabase, le véritable
    user_id est enregistré. Sinon le lancement reste anonyme.
    """

    normalized_provider = (
        str(provider or "")
        .strip()
        .lower()
    )

    if normalized_provider not in ROUTE_PROVIDERS:
        return {
            "ok": False,
            "status": "invalid",
            "message": "Fournisseur d'itinéraire invalide.",
        }

    detail = get_address_detail(
        raw_number=raw_number,
    )

    if detail["status"] == "invalid":
        return {
            "ok": False,
            "status": "invalid",
            "message": "Numéro Adresse GN invalide.",
        }

    beacon_id = detail.get(
        "beacon_id",
    )

    if (
        detail["status"] != "found"
        or not beacon_id
    ):
        return {
            "ok": False,
            "status": "not_found",
            "message": "Adresse introuvable.",
        }

    db_provider = ROUTE_PROVIDER_DB_VALUES[
        normalized_provider
    ]

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO public.route_logs
                (
                    beacon_id,
                    user_id,
                    provider,
                    launched_at
                )
            VALUES
                (
                    %s,
                    %s,
                    %s,
                    NOW()
                )
            """,
            [
                beacon_id,
                user_id,
                db_provider,
            ],
        )

    return {
        "ok": True,
        "status": "created",
        "provider": normalized_provider,
    }
