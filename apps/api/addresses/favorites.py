from typing import Any

from django.db import connection, transaction

from .services import get_address_detail


def _resolve_public_beacon(
    raw_number: str,
) -> dict[str, Any]:
    """
    Résout une Adresse GN publique vers son beacon_id.

    Le frontend ne transmet jamais beacon_id.
    """

    detail = get_address_detail(
        raw_number=raw_number,
    )

    if detail["status"] == "invalid":
        return {
            "ok": False,
            "status": "invalid",
            "beacon_id": None,
            "message": (
                "Numéro Adresse GN invalide."
            ),
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
            "beacon_id": None,
            "message": (
                "Adresse introuvable."
            ),
        }

    return {
        "ok": True,
        "status": "found",
        "beacon_id": beacon_id,
        "message": None,
    }


def get_favorite_state(
    raw_number: str,
    user_id: str,
) -> dict[str, Any]:
    """
    Retourne l'état Favori de l'adresse
    pour l'utilisateur Supabase authentifié.
    """

    resolved = _resolve_public_beacon(
        raw_number=raw_number,
    )

    if not resolved["ok"]:
        return resolved

    beacon_id = resolved[
        "beacon_id"
    ]

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                alias,
                created_at
            FROM public.favorites
            WHERE
                user_id = %s
                AND beacon_id = %s
            LIMIT 1
            """,
            [
                user_id,
                beacon_id,
            ],
        )

        row = cursor.fetchone()

    if row is None:
        return {
            "ok": True,
            "status": "found",
            "favorited": False,
            "favorite_id": None,
            "alias": None,
            "created_at": None,
        }

    return {
        "ok": True,
        "status": "found",
        "favorited": True,
        "favorite_id": str(row[0]),
        "alias": row[1],
        "created_at": (
            row[2].isoformat()
            if row[2]
            else None
        ),
    }


def toggle_favorite(
    raw_number: str,
    user_id: str,
) -> dict[str, Any]:
    """
    Ajoute ou retire une Adresse GN des favoris.

    user_id provient exclusivement du JWT Supabase
    validé par Django.

    beacon_id est résolu exclusivement côté serveur.
    """

    resolved = _resolve_public_beacon(
        raw_number=raw_number,
    )

    if not resolved["ok"]:
        return resolved

    beacon_id = resolved[
        "beacon_id"
    ]

    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                FROM public.profiles
                WHERE id = %s
                LIMIT 1
                """,
                [
                    user_id,
                ],
            )

            if cursor.fetchone() is None:
                return {
                    "ok": False,
                    "status": (
                        "profile_missing"
                    ),
                    "favorited": False,
                    "favorite_id": None,
                    "message": (
                        "Le profil utilisateur "
                        "Adresse GN est introuvable."
                    ),
                }

            cursor.execute(
                """
                SELECT id
                FROM public.favorites
                WHERE
                    user_id = %s
                    AND beacon_id = %s
                LIMIT 1
                """,
                [
                    user_id,
                    beacon_id,
                ],
            )

            existing = cursor.fetchone()

            if existing is not None:
                favorite_id = (
                    existing[0]
                )

                cursor.execute(
                    """
                    DELETE FROM public.favorites
                    WHERE
                        id = %s
                        AND user_id = %s
                    """,
                    [
                        favorite_id,
                        user_id,
                    ],
                )

                return {
                    "ok": True,
                    "status": "updated",
                    "favorited": False,
                    "favorite_id": None,
                    "message": (
                        "Retiré des favoris."
                    ),
                }

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
                        NULL
                    )
                RETURNING
                    id,
                    created_at
                """,
                [
                    user_id,
                    beacon_id,
                ],
            )

            created = cursor.fetchone()

    return {
        "ok": True,
        "status": "updated",
        "favorited": True,
        "favorite_id": str(
            created[0]
        ),
        "created_at": (
            created[1].isoformat()
            if created[1]
            else None
        ),
        "message": (
            "Ajouté à vos favoris."
        ),
    }