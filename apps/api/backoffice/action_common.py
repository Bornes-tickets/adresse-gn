from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from django.db import connection


class ActionError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        status: str = "invalid",
        http_status: int = 400,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.http_status = http_status


def clean_text(value: Any, *, max_length: int | None = None) -> str:
    text = str(value or "").strip()
    return text[:max_length] if max_length is not None else text


def required_text(data: dict[str, Any], key: str, label: str) -> str:
    value = clean_text(data.get(key))
    if not value:
        raise ActionError(f"{label} est obligatoire.")
    return value


def optional_text(
    data: dict[str, Any],
    key: str,
    *,
    max_length: int | None = None,
) -> str | None:
    value = clean_text(data.get(key), max_length=max_length)
    return value or None


def bool_value(value: Any, default: bool = False) -> bool:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "oui", "on"}


def int_value(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(Decimal(str(value)))
    except Exception as exc:
        raise ActionError("Valeur numérique invalide.") from exc


def decimal_value(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except Exception as exc:
        raise ActionError("Valeur numérique invalide.") from exc


def json_value(
    value: Any,
    *,
    default: Any,
    required: bool = False,
) -> Any:
    if value is None or value == "":
        if required:
            raise ActionError("Valeur JSON obligatoire.")
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(str(value))
    except json.JSONDecodeError as exc:
        raise ActionError("JSON invalide.") from exc


def audit(
    cursor,
    *,
    actor_id: str,
    action: str,
    entity: str,
    entity_id: str | None,
    before: Any = None,
    after: Any = None,
) -> None:
    cursor.execute(
        """
        INSERT INTO public.audit_logs
            (actor_id, action, entity, entity_id, before, after)
        VALUES
            (%s, %s, %s, %s, %s::jsonb, %s::jsonb)
        """,
        [
            actor_id,
            action,
            entity,
            entity_id,
            json.dumps(before) if before is not None else None,
            json.dumps(after) if after is not None else None,
        ],
    )


def active_agent_options() -> list[dict[str, str]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT ag.id::text, ag.badge_number, p.full_name
            FROM public.agents ag
            LEFT JOIN public.profiles p ON p.id = ag.id
            WHERE ag.active IS TRUE
            ORDER BY ag.badge_number
            """
        )
        return [
            {
                "value": row[0],
                "label": f"{row[1]} — {row[2] or 'Agent'}",
            }
            for row in cursor.fetchall()
        ]


def commune_options() -> list[dict[str, str]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id::text, COALESCE(code, ''), name
            FROM public.communes
            WHERE is_active IS TRUE
            ORDER BY name, code
            """
        )
        return [
            {
                "value": row[0],
                "label": f"{row[1]} — {row[2]}" if row[1] else row[2],
            }
            for row in cursor.fetchall()
        ]


def next_db_number(cursor, function_name: str) -> str:
    cursor.execute(
        "SELECT to_regprocedure(%s)",
        [f"public.{function_name}()"],
    )
    if cursor.fetchone()[0] is None:
        raise ActionError(
            f"La fonction PostgreSQL public.{function_name}() est absente. "
            "Aucune numérotation ne sera improvisée.",
            status="missing_number_authority",
        )
    cursor.execute(f"SELECT public.{function_name}()")
    value = cursor.fetchone()[0]
    if not value:
        raise ActionError(f"{function_name}() a retourné une valeur vide.")
    return str(value)

def pending_installation_options() -> list[dict[str, str]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                pi.id::text,
                pi.status,
                COALESCE(o.order_ref, ''),
                COALESCE(b.public_number, ''),
                COALESCE(p.full_name, '')
            FROM public.pending_installations pi
            LEFT JOIN public.orders o
              ON o.id = pi.order_id
            LEFT JOIN public.beacons b
              ON b.id = pi.beacon_id
            LEFT JOIN public.profiles p
              ON p.id = pi.customer_id
            ORDER BY pi.created_at DESC
            LIMIT 200
            """
        )
        options = []
        for row in cursor.fetchall():
            details = [
                value
                for value in (row[2], row[3], row[4])
                if value
            ]
            suffix = " — ".join(details)
            label = f"{row[1]} — {suffix}" if suffix else row[1]
            options.append({"value": row[0], "label": label})
        return options
