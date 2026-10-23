from __future__ import annotations

import json
from typing import Any

from django.db import connection

from .accounts import reactivate_account
from .action_common import (
    ActionError,
    audit,
    bool_value,
    json_value,
    optional_text,
    required_text,
)


VALID_ROLES = {
    "user", "agent", "support", "sales", "ops",
    "supervisor", "admin", "super_admin",
}
ADDRESS_CATEGORIES = {
    "habitation", "restaurant", "hotel", "bar", "commerce",
    "entreprise", "administration", "ecole", "sante", "pharmacie",
    "banque", "tourisme", "other",
}
ADDRESS_VISIBILITIES = {"private", "public"}
ADDRESS_VERIFICATIONS = {"unverified", "pending", "verified"}
ADDRESS_STATUSES = {"active", "suspended", "deleted"}
ZONE_TABLES = {
    "region": "regions",
    "prefecture": "prefectures",
    "commune": "communes",
    "district": "districts",
    "sector": "sectors",
}


def account_set_role(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    new_role = required_text(data, "role", "Le rôle")
    if new_role not in VALID_ROLES:
        raise ActionError("Rôle métier invalide.")
    if str(actor["user_id"]) == str(row_id):
        raise ActionError("Vous ne pouvez pas modifier votre propre rôle.", status="self_target")

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT role, account_status FROM public.profiles WHERE id = %s FOR UPDATE",
            [row_id],
        )
        row = cursor.fetchone()
        if not row:
            raise ActionError("Compte introuvable.", status="not_found", http_status=404)
        current_role, account_status = row
        if current_role == "super_admin" and actor["role"] != "super_admin":
            raise ActionError("Seul un Super Admin peut modifier un Super Admin.", http_status=403)
        if new_role == "super_admin" and actor["role"] != "super_admin":
            raise ActionError("Seul un Super Admin peut attribuer ce rôle.", http_status=403)
        if new_role == "agent":
            cursor.execute("SELECT 1 FROM public.agents WHERE id = %s", [row_id])
            if cursor.fetchone() is None:
                raise ActionError(
                    "Ce profil n’a pas de fiche agent. La création d’agent Auth est gérée en G3-P2."
                )

        cursor.execute(
            "UPDATE public.profiles SET role = %s, session_valid_after = NOW() WHERE id = %s",
            [new_role, row_id],
        )
        if current_role == "agent" and new_role != "agent":
            cursor.execute("UPDATE public.agents SET active = FALSE WHERE id = %s", [row_id])
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="account.role.update",
            entity="profiles",
            entity_id=row_id,
            before={"role": current_role, "account_status": account_status},
            after={"role": new_role, "session_invalidated": True},
        )
    return {"ok": True, "status": "updated", "user_id": row_id, "role": new_role}


def account_deactivate(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    note = required_text(data, "note", "Le motif")
    if str(actor["user_id"]) == str(row_id):
        raise ActionError("Vous ne pouvez pas désactiver votre propre compte.", status="self_target")

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT role, account_status, deactivated_at FROM public.profiles WHERE id = %s FOR UPDATE",
            [row_id],
        )
        row = cursor.fetchone()
        if not row:
            raise ActionError("Compte introuvable.", status="not_found", http_status=404)
        role, account_status, deactivated_at = row
        if role == "super_admin" and actor["role"] != "super_admin":
            raise ActionError("Seul un Super Admin peut désactiver un Super Admin.", http_status=403)
        if account_status == "deactivated":
            return {"ok": True, "status": "already_deactivated", "user_id": row_id}

        cursor.execute(
            """
            UPDATE public.profiles
            SET account_status = 'deactivated', deactivated_at = NOW(), session_valid_after = NOW()
            WHERE id = %s AND account_status = 'active'
            """,
            [row_id],
        )
        cursor.execute("SELECT to_regclass('public.push_subscriptions')")
        if cursor.fetchone()[0] is not None:
            cursor.execute("DELETE FROM public.push_subscriptions WHERE user_id = %s", [row_id])
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="account.deactivated.backoffice",
            entity="profiles",
            entity_id=row_id,
            before={
                "role": role,
                "account_status": account_status,
                "deactivated_at": deactivated_at.isoformat() if deactivated_at else None,
            },
            after={"account_status": "deactivated", "note": note, "session_invalidated": True},
        )
    return {"ok": True, "status": "deactivated", "user_id": row_id}


def account_reactivate(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    method = required_text(data, "verification_method", "La méthode de vérification")
    note = required_text(data, "verification_note", "La note de vérification")
    with connection.cursor() as cursor:
        cursor.execute("SELECT role, account_status FROM public.profiles WHERE id = %s", [row_id])
        row = cursor.fetchone()
    if not row:
        raise ActionError("Compte introuvable.", status="not_found", http_status=404)
    role, status = row
    if role == "user":
        result = reactivate_account(
            user_id=row_id,
            actor_id=actor["user_id"],
            verification_method=method,
            verification_note=note,
        )
        if not result.get("ok"):
            raise ActionError(result.get("message", "Réactivation impossible."), status=result.get("status", "invalid"))
        return result
    if role == "super_admin" and actor["role"] != "super_admin":
        raise ActionError("Seul un Super Admin peut réactiver un Super Admin.", http_status=403)
    if status != "deactivated":
        raise ActionError("Ce compte n’est pas désactivé.")

    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE public.profiles
            SET account_status = 'active', deactivated_at = NULL, session_valid_after = NOW()
            WHERE id = %s AND account_status = 'deactivated'
            """,
            [row_id],
        )
        if cursor.rowcount != 1:
            raise ActionError("L’état du compte a changé.", status="conflict", http_status=409)
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="account.reactivated.backoffice",
            entity="profiles",
            entity_id=row_id,
            before={"account_status": "deactivated"},
            after={
                "account_status": "active",
                "verification_method": method,
                "verification_note": note,
                "session_invalidated": True,
            },
        )
    return {"ok": True, "status": "reactivated", "user_id": row_id}


def agent_update(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    badge = required_text(data, "badge_number", "Le badge")
    full_name = required_text(data, "full_name", "Le nom")
    phone = optional_text(data, "phone")
    zone_id = optional_text(data, "zone_id")
    active = bool_value(data.get("active"), True)

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT ag.badge_number, ag.zone_id, ag.active, p.full_name, p.phone
            FROM public.agents ag
            JOIN public.profiles p ON p.id = ag.id
            WHERE ag.id = %s
            FOR UPDATE OF ag, p
            """,
            [row_id],
        )
        before = cursor.fetchone()
        if not before:
            raise ActionError("Agent introuvable.", status="not_found", http_status=404)
        if zone_id:
            cursor.execute("SELECT 1 FROM public.communes WHERE id = %s AND is_active IS TRUE", [zone_id])
            if cursor.fetchone() is None:
                raise ActionError("Commune/zone invalide.")
        cursor.execute(
            "UPDATE public.agents SET badge_number = %s, zone_id = %s, active = %s WHERE id = %s",
            [badge, zone_id, active, row_id],
        )
        cursor.execute(
            "UPDATE public.profiles SET full_name = %s, phone = %s WHERE id = %s",
            [full_name, phone, row_id],
        )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="agent.update",
            entity="agents",
            entity_id=row_id,
            before={
                "badge_number": before[0],
                "zone_id": str(before[1]) if before[1] else None,
                "active": before[2],
                "full_name": before[3],
                "phone": before[4],
            },
            after={
                "badge_number": badge,
                "zone_id": zone_id,
                "active": active,
                "full_name": full_name,
                "phone": phone,
            },
        )
    return {"ok": True, "status": "updated", "agent_id": row_id}


def address_update(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    category = required_text(data, "category", "La catégorie")
    visibility = required_text(data, "visibility", "La visibilité")
    verification = required_text(data, "verification_level", "La vérification")
    status = required_text(data, "status", "Le statut")
    if category not in ADDRESS_CATEGORIES:
        raise ActionError("Catégorie invalide.")
    if visibility not in ADDRESS_VISIBILITIES:
        raise ActionError("Visibilité invalide.")
    if verification not in ADDRESS_VERIFICATIONS:
        raise ActionError("Niveau de vérification invalide.")
    if status not in ADDRESS_STATUSES:
        raise ActionError("Statut invalide.")

    patch = {
        "name": optional_text(data, "name"),
        "category": category,
        "visibility": visibility,
        "verification_level": verification,
        "status": status,
        "access_point_note": optional_text(data, "access_point_note"),
    }
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT name, category, visibility, verification_level, status, access_point_note
            FROM public.addresses WHERE id = %s FOR UPDATE
            """,
            [row_id],
        )
        before = cursor.fetchone()
        if not before:
            raise ActionError("Adresse introuvable.", status="not_found", http_status=404)
        cursor.execute(
            """
            UPDATE public.addresses
            SET name = %s, category = %s, visibility = %s,
                verification_level = %s, status = %s, access_point_note = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            [patch["name"], category, visibility, verification, status, patch["access_point_note"], row_id],
        )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="address.update.backoffice",
            entity="addresses",
            entity_id=row_id,
            before={
                "name": before[0], "category": before[1], "visibility": before[2],
                "verification_level": before[3], "status": before[4], "access_point_note": before[5],
            },
            after=patch,
        )
    return {"ok": True, "status": "updated", "address_id": row_id}


def address_reassign_owner(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    email = required_text(data, "email", "L’email").lower()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT p.id, p.role, p.account_status
            FROM auth.users au
            JOIN public.profiles p ON p.id = au.id
            WHERE lower(au.email) = %s
            LIMIT 1
            """,
            [email],
        )
        owner = cursor.fetchone()
        if not owner:
            raise ActionError("Aucun compte correspondant à cet email.")
        owner_id, role, account_status = owner
        if role != "user" or account_status != "active":
            raise ActionError("Le nouveau propriétaire doit être un compte user actif.")
        cursor.execute("SELECT owner_id FROM public.addresses WHERE id = %s FOR UPDATE", [row_id])
        row = cursor.fetchone()
        if not row:
            raise ActionError("Adresse introuvable.", status="not_found", http_status=404)
        previous = row[0]
        cursor.execute("UPDATE public.addresses SET owner_id = %s, updated_at = NOW() WHERE id = %s", [owner_id, row_id])
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="address.owner.reassign",
            entity="addresses",
            entity_id=row_id,
            before={"owner_id": str(previous) if previous else None},
            after={"owner_id": str(owner_id), "owner_email": email},
        )
    return {"ok": True, "status": "reassigned", "address_id": row_id, "owner_id": str(owner_id)}


def zone_save(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    level = required_text(data, "_level", "Le niveau")
    table = ZONE_TABLES.get(level)
    if not table:
        raise ActionError("Niveau territorial invalide.")
    name = required_text(data, "name", "Le nom")
    code = optional_text(data, "code")
    stat_code = optional_text(data, "stat_code")
    admin_type = optional_text(data, "administrative_type")
    is_active = bool_value(data.get("is_active"), True)
    geojson = json_value(data.get("geojson"), default=None)

    with connection.cursor() as cursor:
        cursor.execute(f'SELECT name, code, is_active FROM public."{table}" WHERE id = %s FOR UPDATE', [row_id])
        before = cursor.fetchone()
        if not before:
            raise ActionError("Zone introuvable.", status="not_found", http_status=404)
        sets = ["name = %s", "code = %s", "is_active = %s"]
        params: list[Any] = [name, code, is_active]
        if level in {"region", "prefecture", "commune"}:
            sets.append("stat_code = %s")
            params.append(stat_code)
        if level == "commune":
            sets.append("administrative_type = %s")
            params.append(admin_type)
        if level == "district" and admin_type:
            if admin_type not in {"quartier", "district"}:
                raise ActionError("Type quartier/district invalide.")
            sets.append("kind = %s")
            params.append(admin_type)
        if geojson is not None:
            sets.append("geojson = %s::jsonb")
            params.append(json.dumps(geojson))
            if level in {"commune", "district"}:
                geometry = geojson.get("geometry") if isinstance(geojson, dict) and geojson.get("type") == "Feature" else geojson
                sets.append("boundary = ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)::geography")
                params.append(json.dumps(geometry))
        params.append(row_id)
        cursor.execute(f'UPDATE public."{table}" SET {", ".join(sets)} WHERE id = %s', params)
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="territory.update",
            entity=table,
            entity_id=row_id,
            before={"name": before[0], "code": before[1], "is_active": before[2]},
            after={"name": name, "code": code, "is_active": is_active, "level": level},
        )
    return {"ok": True, "status": "updated", "level": level, "id": row_id}


def zone_deactivate(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    level = required_text(data, "_level", "Le niveau")
    table = ZONE_TABLES.get(level)
    if not table:
        raise ActionError("Niveau territorial invalide.")
    with connection.cursor() as cursor:
        cursor.execute(f'SELECT is_active, name FROM public."{table}" WHERE id = %s FOR UPDATE', [row_id])
        row = cursor.fetchone()
        if not row:
            raise ActionError("Zone introuvable.", status="not_found", http_status=404)
        cursor.execute(f'UPDATE public."{table}" SET is_active = FALSE WHERE id = %s', [row_id])
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="territory.deactivate",
            entity=table,
            entity_id=row_id,
            before={"is_active": row[0], "name": row[1]},
            after={"is_active": False, "level": level},
        )
    return {"ok": True, "status": "deactivated", "level": level, "id": row_id}


def doc_review(actor: dict[str, Any], row_id: str, data: dict[str, Any]) -> dict[str, Any]:
    status = required_text(data, "status", "La décision")
    note = optional_text(data, "note", max_length=1000)
    if status not in {"pending", "approved", "rejected"}:
        raise ActionError("Statut de pièce invalide.")
    if status == "rejected" and not note:
        raise ActionError("Un motif est obligatoire pour rejeter une pièce.")
    with connection.cursor() as cursor:
        cursor.execute("SELECT status, review_note FROM public.pending_installation_docs WHERE id = %s FOR UPDATE", [row_id])
        before = cursor.fetchone()
        if not before:
            raise ActionError("Pièce introuvable.", status="not_found", http_status=404)
        cursor.execute(
            """
            UPDATE public.pending_installation_docs
            SET status = %s, review_note = %s,
                reviewed_by = CASE WHEN %s = 'pending' THEN NULL ELSE %s END,
                reviewed_at = CASE WHEN %s = 'pending' THEN NULL ELSE NOW() END,
                updated_at = NOW()
            WHERE id = %s
            """,
            [status, note, status, actor["user_id"], status, row_id],
        )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="pending_installation_doc.review",
            entity="pending_installation_docs",
            entity_id=row_id,
            before={"status": before[0], "review_note": before[1]},
            after={"status": status, "review_note": note},
        )
    return {"ok": True, "status": status, "doc_id": row_id}
