from __future__ import annotations

import json
from typing import Any

from django.db import connection

from .action_common import (
    ActionError,
    audit,
    bool_value,
    int_value,
    json_value,
    optional_text,
    required_text,
)


CMS_STATUSES = {"draft", "published", "archived"}
CMS_PERIODS = {"once", "month", "year"}
CMS_BILLING = {"none", "month", "year"}
FULFILLMENT = {
    "digital_address", "physical_installation", "professional_quote",
    "institutional_quote", "business_subscription", "api", "legacy",
}
JSON_KEYS = {
    "title", "excerpt", "body", "seo_title", "seo_description",
    "question", "answer", "name", "description", "features", "capabilities",
}


def cms_payload(resource: str, data: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    if resource == "cms_pages":
        status = required_text(data, "status", "Le statut")
        if status not in CMS_STATUSES:
            raise ActionError("Statut CMS invalide.")
        payload = {
            "slug": required_text(data, "slug", "Le slug"),
            "status": status,
            "title": json_value(data.get("title"), default={}, required=True),
            "excerpt": json_value(data.get("excerpt"), default={}),
            "body": json_value(data.get("body"), default={}),
            "seo_title": json_value(data.get("seo_title"), default={}),
            "seo_description": json_value(data.get("seo_description"), default={}),
            "cover_url": optional_text(data, "cover_url"),
            "position": int_value(data.get("position"), 0),
        }
        if not payload["title"].get("fr"):
            raise ActionError("Le titre français est obligatoire.")
        return "cms_pages", payload

    if resource == "cms_posts":
        status = required_text(data, "status", "Le statut")
        if status not in CMS_STATUSES:
            raise ActionError("Statut CMS invalide.")
        payload = {
            "slug": required_text(data, "slug", "Le slug"),
            "status": status,
            "category": optional_text(data, "category"),
            "title": json_value(data.get("title"), default={}, required=True),
            "excerpt": json_value(data.get("excerpt"), default={}),
            "body": json_value(data.get("body"), default={}),
            "seo_title": json_value(data.get("seo_title"), default={}),
            "seo_description": json_value(data.get("seo_description"), default={}),
            "cover_url": optional_text(data, "cover_url"),
        }
        if not payload["title"].get("fr"):
            raise ActionError("Le titre français est obligatoire.")
        return "cms_posts", payload

    if resource == "cms_faq":
        payload = {
            "category": optional_text(data, "category"),
            "question": json_value(data.get("question"), default={}, required=True),
            "answer": json_value(data.get("answer"), default={}, required=True),
            "position": int_value(data.get("position"), 0),
            "published": bool_value(data.get("published"), True),
        }
        if not payload["question"].get("fr"):
            raise ActionError("La question française est obligatoire.")
        return "cms_faq", payload

    if resource == "cms_translations":
        return "cms_translations", {
            "namespace": required_text(data, "namespace", "Le namespace"),
            "key": required_text(data, "key", "La clé"),
            "fr": optional_text(data, "fr"),
            "en": optional_text(data, "en"),
            "ar": optional_text(data, "ar"),
        }

    if resource == "cms_plans":
        period = required_text(data, "period", "La période")
        billing = optional_text(data, "billing_period") or "none"
        fulfillment = required_text(data, "fulfillment_kind", "Le mode de livraison")
        if period not in CMS_PERIODS or billing not in CMS_BILLING or fulfillment not in FULFILLMENT:
            raise ActionError("Paramètres d’offre invalides.")
        capabilities = json_value(data.get("capabilities"), default=[])
        if not isinstance(capabilities, list):
            raise ActionError("capabilities doit être un tableau JSON.")
        payload = {
            "code": required_text(data, "code", "Le code"),
            "name": json_value(data.get("name"), default={}, required=True),
            "description": json_value(data.get("description"), default={}),
            "features": json_value(data.get("features"), default={}),
            "price_gnf": max(0, int_value(data.get("price_gnf"), 0)),
            "period": period,
            "popular": bool_value(data.get("popular"), False),
            "active": bool_value(data.get("active"), True),
            "position": int_value(data.get("position"), 0),
            "audience": optional_text(data, "audience"),
            "price_from_gnf": int_value(data.get("price_from_gnf")) if data.get("price_from_gnf") not in {None, ""} else None,
            "price_to_gnf": int_value(data.get("price_to_gnf")) if data.get("price_to_gnf") not in {None, ""} else None,
            "recurring_price_gnf": max(0, int_value(data.get("recurring_price_gnf"), 0)),
            "billing_period": billing,
            "requires_quote": bool_value(data.get("requires_quote"), False),
            "plate_available": bool_value(data.get("plate_available"), False),
            "plate_included": bool_value(data.get("plate_included"), False),
            "installation_required": bool_value(data.get("installation_required"), False),
            "max_addresses": int_value(data.get("max_addresses")) if data.get("max_addresses") not in {None, ""} else None,
            "fulfillment_kind": fulfillment,
            "capabilities": capabilities,
        }
        if not payload["name"].get("fr"):
            raise ActionError("Le nom français de l’offre est obligatoire.")
        return "cms_plans", payload

    raise ActionError("Ressource CMS invalide.")


def cms_save(
    actor: dict[str, Any],
    resource: str,
    row_id: str | None,
    data: dict[str, Any],
) -> dict[str, Any]:
    table, payload = cms_payload(resource, data)
    keys = list(payload)

    with connection.cursor() as cursor:
        if resource == "cms_translations":
            cursor.execute(
                """
                INSERT INTO public.cms_translations (namespace, key, fr, en, ar)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (namespace, key)
                DO UPDATE SET
                    fr = EXCLUDED.fr,
                    en = EXCLUDED.en,
                    ar = EXCLUDED.ar,
                    updated_at = NOW()
                RETURNING id
                """,
                [payload["namespace"], payload["key"], payload["fr"], payload["en"], payload["ar"]],
            )
            saved_id = cursor.fetchone()[0]
        elif row_id:
            cursor.execute(f'SELECT id FROM public."{table}" WHERE id = %s FOR UPDATE', [row_id])
            if cursor.fetchone() is None:
                raise ActionError("Contenu CMS introuvable.", status="not_found", http_status=404)
            assignments = []
            values = []
            for key in keys:
                assignments.append(f'"{key}" = %s::jsonb' if key in JSON_KEYS else f'"{key}" = %s')
                value = payload[key]
                values.append(json.dumps(value) if key in JSON_KEYS else value)
            cursor.execute(
                f'UPDATE public."{table}" SET {", ".join(assignments)}, updated_at = NOW() WHERE id = %s',
                [*values, row_id],
            )
            saved_id = row_id
        else:
            columns = ", ".join(f'"{key}"' for key in keys)
            placeholders = []
            values = []
            for key in keys:
                placeholders.append("%s::jsonb" if key in JSON_KEYS else "%s")
                values.append(json.dumps(payload[key]) if key in JSON_KEYS else payload[key])
            if table in {"cms_pages", "cms_posts"}:
                columns += ", created_by"
                placeholders.append("%s")
                values.append(actor["user_id"])
            cursor.execute(
                f'INSERT INTO public."{table}" ({columns}) VALUES ({", ".join(placeholders)}) RETURNING id',
                values,
            )
            saved_id = cursor.fetchone()[0]

        audit(
            cursor,
            actor_id=actor["user_id"],
            action=f"{resource}.save",
            entity=table,
            entity_id=str(saved_id),
            after={"resource": resource, "saved": True},
        )
    return {"ok": True, "status": "saved", "id": str(saved_id)}


def cms_delete(actor: dict[str, Any], resource: str, row_id: str) -> dict[str, Any]:
    table = {
        "cms_pages": "cms_pages",
        "cms_posts": "cms_posts",
        "cms_faq": "cms_faq",
        "cms_translations": "cms_translations",
        "cms_plans": "cms_plans",
    }.get(resource)
    if not table:
        raise ActionError("Ressource CMS invalide.")

    with connection.cursor() as cursor:
        cursor.execute(f'SELECT id FROM public."{table}" WHERE id = %s FOR UPDATE', [row_id])
        if cursor.fetchone() is None:
            raise ActionError("Contenu CMS introuvable.", status="not_found", http_status=404)
        if resource == "cms_plans":
            cursor.execute("SELECT COUNT(*) FROM public.orders WHERE plan_id = %s", [row_id])
            references = int(cursor.fetchone()[0])
            if references > 0:
                cursor.execute("UPDATE public.cms_plans SET active = FALSE, updated_at = NOW() WHERE id = %s", [row_id])
                audit(
                    cursor,
                    actor_id=actor["user_id"],
                    action="cms_plans.deactivate_referenced",
                    entity=table,
                    entity_id=row_id,
                    after={"active": False, "order_references": references},
                )
                return {"ok": True, "status": "deactivated", "id": row_id, "references": references}

        audit(
            cursor,
            actor_id=actor["user_id"],
            action=f"{resource}.delete",
            entity=table,
            entity_id=row_id,
            before={"id": row_id},
        )
        cursor.execute(f'DELETE FROM public."{table}" WHERE id = %s', [row_id])
    return {"ok": True, "status": "deleted", "id": row_id}
