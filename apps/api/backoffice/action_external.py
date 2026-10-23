from __future__ import annotations

import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from django.db import connection

from .action_admin import (
    account_deactivate,
    account_reactivate,
)
from .action_common import (
    ActionError,
    audit,
    optional_text,
    required_text,
)
from .external_supabase import (
    SupabaseExternalError,
    create_auth_user,
    delete_auth_user,
    delete_storage_object,
    public_site_url,
    send_password_recovery,
    signed_storage_url,
    update_auth_user,
    upload_storage_object,
)


VALID_NON_AGENT_ROLES = {
    "user",
    "support",
    "sales",
    "ops",
    "supervisor",
    "admin",
    "super_admin",
}
DOC_KINDS = {
    "photo",
    "recu",
    "attestation",
    "autre",
}
DOC_BUCKET = "installation-docs"
MAX_DOC_BYTES = 8 * 1024 * 1024
ALLOWED_DOC_MIME = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}


def _external_error(exc: Exception) -> ActionError:
    if isinstance(exc, SupabaseExternalError):
        return ActionError(
            str(exc),
            status="external_error",
            http_status=502,
        )
    if isinstance(exc, ActionError):
        return exc
    return ActionError(
        "L’opération externe n’a pas pu être exécutée.",
        status="external_error",
        http_status=502,
    )


def _auth_user_id(payload: dict[str, Any]) -> str:
    direct = str(payload.get("id") or "").strip()
    if direct:
        return direct

    user = payload.get("user")
    if isinstance(user, dict):
        nested = str(user.get("id") or "").strip()
        if nested:
            return nested

    raise ActionError(
        "Supabase Auth n’a pas retourné l’identifiant utilisateur.",
        status="external_error",
        http_status=502,
    )


def _validate_password(value: Any) -> str:
    password = str(value or "")
    if len(password) < 8:
        raise ActionError(
            "Le mot de passe temporaire doit contenir au moins 8 caractères."
        )
    return password


def _safe_filename(name: str) -> str:
    cleaned = re.sub(
        r"[^A-Za-z0-9._-]+",
        "-",
        Path(name or "document").name,
    ).strip(".-")
    return cleaned[:120] or "document"


def _upsert_profile(
    cursor,
    *,
    user_id: str,
    full_name: str,
    phone: str | None,
    role: str,
) -> None:
    # Auth user creation may already have created a profile through the
    # historical on_auth_user_created trigger. ON CONFLICT makes this safe.
    cursor.execute(
        """
        INSERT INTO public.profiles
            (
                id,
                full_name,
                phone,
                role,
                account_status,
                deactivated_at,
                preferences
            )
        VALUES
            (%s, %s, %s, %s, 'active', NULL, '{}'::jsonb)
        ON CONFLICT (id)
        DO UPDATE SET
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            role = EXCLUDED.role,
            account_status = 'active',
            deactivated_at = NULL
        """,
        [
            user_id,
            full_name,
            phone,
            role,
        ],
    )


def create_user(
    actor: dict[str, Any],
    data: dict[str, Any],
) -> dict[str, Any]:
    email = required_text(data, "email", "L’email").lower()
    full_name = required_text(data, "full_name", "Le nom complet")
    phone = optional_text(data, "phone")
    role = required_text(data, "role", "Le rôle")
    password = _validate_password(data.get("temporary_password"))

    if role not in VALID_NON_AGENT_ROLES:
        raise ActionError(
            "Rôle invalide. Utilisez « Créer un agent » pour le rôle agent."
        )

    if role == "super_admin" and actor["role"] != "super_admin":
        raise ActionError(
            "Seul un Super Admin peut créer un Super Admin.",
            http_status=403,
        )

    try:
        auth_payload = create_auth_user(
            email=email,
            password=password,
            full_name=full_name,
            phone=phone,
        )
    except Exception as exc:
        raise _external_error(exc) from exc

    user_id = _auth_user_id(auth_payload)

    try:
        with connection.cursor() as cursor:
            _upsert_profile(
                cursor,
                user_id=user_id,
                full_name=full_name,
                phone=phone,
                role=role,
            )
            audit(
                cursor,
                actor_id=actor["user_id"],
                action="account.create.auth",
                entity="profiles",
                entity_id=user_id,
                after={
                    "email": email,
                    "full_name": full_name,
                    "phone": phone,
                    "role": role,
                    "auth_created": True,
                },
            )
    except Exception:
        try:
            delete_auth_user(user_id)
        except Exception:
            pass
        raise

    return {
        "ok": True,
        "status": "created",
        "user_id": user_id,
        "email": email,
        "role": role,
    }


def create_agent(
    actor: dict[str, Any],
    data: dict[str, Any],
) -> dict[str, Any]:
    email = required_text(data, "email", "L’email").lower()
    full_name = required_text(data, "full_name", "Le nom complet")
    phone = optional_text(data, "phone")
    badge = required_text(data, "badge_number", "Le badge")
    zone_id = optional_text(data, "zone_id")
    password = _validate_password(data.get("temporary_password"))

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM public.agents WHERE badge_number = %s",
            [badge],
        )
        if cursor.fetchone() is not None:
            raise ActionError("Ce numéro de badge existe déjà.")

        if zone_id:
            cursor.execute(
                """
                SELECT 1
                FROM public.communes
                WHERE id = %s AND is_active IS TRUE
                """,
                [zone_id],
            )
            if cursor.fetchone() is None:
                raise ActionError("Commune / zone invalide.")

    try:
        auth_payload = create_auth_user(
            email=email,
            password=password,
            full_name=full_name,
            phone=phone,
        )
    except Exception as exc:
        raise _external_error(exc) from exc

    user_id = _auth_user_id(auth_payload)

    try:
        with connection.cursor() as cursor:
            _upsert_profile(
                cursor,
                user_id=user_id,
                full_name=full_name,
                phone=phone,
                role="agent",
            )
            cursor.execute(
                """
                INSERT INTO public.agents
                    (id, badge_number, zone_id, active, hired_at)
                VALUES
                    (%s, %s, %s, TRUE, CURRENT_DATE)
                """,
                [user_id, badge, zone_id],
            )
            audit(
                cursor,
                actor_id=actor["user_id"],
                action="agent.create.auth",
                entity="agents",
                entity_id=user_id,
                after={
                    "email": email,
                    "full_name": full_name,
                    "phone": phone,
                    "badge_number": badge,
                    "zone_id": zone_id,
                    "auth_created": True,
                },
            )
    except Exception:
        try:
            delete_auth_user(user_id)
        except Exception:
            pass
        raise

    return {
        "ok": True,
        "status": "created",
        "agent_id": user_id,
        "email": email,
        "badge_number": badge,
    }


def reset_password(
    actor: dict[str, Any],
    row_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                au.email,
                p.account_status
            FROM public.profiles p
            JOIN auth.users au
              ON au.id = p.id
            WHERE p.id = %s
            LIMIT 1
            """,
            [row_id],
        )
        row = cursor.fetchone()

    if not row:
        raise ActionError(
            "Compte introuvable.",
            status="not_found",
            http_status=404,
        )

    email, account_status = row
    if not email:
        raise ActionError("Ce compte n’a pas d’adresse email.")

    origin = optional_text(data, "_origin")
    redirect_to = public_site_url(origin) + "/reset-password"

    try:
        send_password_recovery(
            email=email,
            redirect_to=redirect_to,
        )
    except Exception as exc:
        raise _external_error(exc) from exc

    with connection.cursor() as cursor:
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="account.password_recovery.sent",
            entity="profiles",
            entity_id=row_id,
            after={
                "email": email,
                "account_status": account_status,
                "redirect_to": redirect_to,
            },
        )

    return {
        "ok": True,
        "status": "recovery_sent",
        "user_id": row_id,
        "email": email,
    }


def deactivate_account_synced(
    actor: dict[str, Any],
    row_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    # External first, then DB. If DB rejects, compensate by unbanning.
    try:
        update_auth_user(
            row_id,
            {"ban_duration": "876000h"},
        )
    except Exception as exc:
        raise _external_error(exc) from exc

    try:
        result = account_deactivate(actor, row_id, data)
    except Exception:
        try:
            update_auth_user(
                row_id,
                {"ban_duration": "none"},
            )
        except Exception:
            pass
        raise

    return {
        **result,
        "auth_synced": True,
    }


def reactivate_account_synced(
    actor: dict[str, Any],
    row_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT account_status FROM public.profiles WHERE id = %s",
            [row_id],
        )
        state = cursor.fetchone()

    if not state:
        raise ActionError(
            "Compte introuvable.",
            status="not_found",
            http_status=404,
        )

    if state[0] != "deactivated":
        raise ActionError("Ce compte n’est pas désactivé.")

    # External first, then DB. If DB rejects, restore the ban.
    try:
        update_auth_user(
            row_id,
            {"ban_duration": "none"},
        )
    except Exception as exc:
        raise _external_error(exc) from exc

    try:
        result = account_reactivate(actor, row_id, data)
    except Exception:
        try:
            update_auth_user(
                row_id,
                {"ban_duration": "876000h"},
            )
        except Exception:
            pass
        raise

    return {
        **result,
        "auth_synced": True,
    }


def upload_install_document(
    actor: dict[str, Any],
    data: dict[str, Any],
) -> dict[str, Any]:
    pending_id = required_text(
        data,
        "pending_installation_id",
        "L’installation en attente",
    )
    kind = required_text(data, "kind", "Le type")
    label = optional_text(data, "label")
    file_obj = data.get("file")

    if kind not in DOC_KINDS:
        raise ActionError("Type de justificatif invalide.")

    if file_obj is None or not hasattr(file_obj, "read"):
        raise ActionError("Le fichier est obligatoire.")

    size = int(getattr(file_obj, "size", 0) or 0)
    content_type = str(
        getattr(file_obj, "content_type", "")
        or "application/octet-stream"
    ).lower()

    if size <= 0:
        raise ActionError("Le fichier est vide.")

    if size > MAX_DOC_BYTES:
        raise ActionError("Le fichier dépasse 10 MiB.")

    if content_type not in ALLOWED_DOC_MIME:
        raise ActionError(
            "Format non autorisé. Utilisez PDF, JPEG ou PNG."
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1
            FROM public.pending_installations
            WHERE id = %s
            """,
            [pending_id],
        )
        if cursor.fetchone() is None:
            raise ActionError(
                "Installation en attente introuvable.",
                status="not_found",
                http_status=404,
            )

    original_name = _safe_filename(
        str(getattr(file_obj, "name", "document"))
    )
    storage_path = (
        f"{pending_id}/"
        f"{uuid4()}-{original_name}"
    )
    content = file_obj.read()

    try:
        upload_storage_object(
            bucket=DOC_BUCKET,
            storage_path=storage_path,
            content=content,
            content_type=content_type,
        )
    except Exception as exc:
        raise _external_error(exc) from exc

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO public.pending_installation_docs
                    (
                        pending_installation_id,
                        kind,
                        label,
                        storage_path,
                        mime_type,
                        size_bytes,
                        status,
                        uploaded_by
                    )
                VALUES
                    (%s, %s, %s, %s, %s, %s, 'pending', %s)
                RETURNING id
                """,
                [
                    pending_id,
                    kind,
                    label,
                    storage_path,
                    content_type,
                    size,
                    actor["user_id"],
                ],
            )
            doc_id = str(cursor.fetchone()[0])
            audit(
                cursor,
                actor_id=actor["user_id"],
                action="installation_doc.upload",
                entity="pending_installation_docs",
                entity_id=doc_id,
                after={
                    "pending_installation_id": pending_id,
                    "kind": kind,
                    "label": label,
                    "storage_path": storage_path,
                    "mime_type": content_type,
                    "size_bytes": size,
                },
            )
    except Exception:
        try:
            delete_storage_object(
                bucket=DOC_BUCKET,
                storage_path=storage_path,
            )
        except Exception:
            pass
        raise

    return {
        "ok": True,
        "status": "uploaded",
        "doc_id": doc_id,
    }


def view_install_document(
    actor: dict[str, Any],
    row_id: str,
) -> dict[str, Any]:
    del actor

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT storage_path
            FROM public.pending_installation_docs
            WHERE id = %s
            """,
            [row_id],
        )
        row = cursor.fetchone()

    if not row:
        raise ActionError(
            "Justificatif introuvable.",
            status="not_found",
            http_status=404,
        )

    try:
        url = signed_storage_url(
            bucket=DOC_BUCKET,
            storage_path=row[0],
            expires_in=300,
        )
    except Exception as exc:
        raise _external_error(exc) from exc

    return {
        "ok": True,
        "status": "signed",
        "signed_url": url,
        "expires_in": 300,
    }


def delete_install_document(
    actor: dict[str, Any],
    row_id: str,
) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                storage_path,
                pending_installation_id,
                kind,
                label,
                status
            FROM public.pending_installation_docs
            WHERE id = %s
            FOR UPDATE
            """,
            [row_id],
        )
        row = cursor.fetchone()

    if not row:
        raise ActionError(
            "Justificatif introuvable.",
            status="not_found",
            http_status=404,
        )

    storage_path, pending_id, kind, label, status = row

    # Storage is deleted through the Storage API, never by manipulating its SQL schema.
    try:
        delete_storage_object(
            bucket=DOC_BUCKET,
            storage_path=storage_path,
        )
    except Exception as exc:
        raise _external_error(exc) from exc

    with connection.cursor() as cursor:
        cursor.execute(
            """
            DELETE FROM public.pending_installation_docs
            WHERE id = %s
            """,
            [row_id],
        )
        if cursor.rowcount != 1:
            raise ActionError(
                "Le justificatif a changé d’état.",
                status="conflict",
                http_status=409,
            )
        audit(
            cursor,
            actor_id=actor["user_id"],
            action="installation_doc.delete",
            entity="pending_installation_docs",
            entity_id=row_id,
            before={
                "pending_installation_id": str(pending_id),
                "kind": kind,
                "label": label,
                "status": status,
                "storage_path": storage_path,
            },
            after={"deleted": True},
        )

    return {
        "ok": True,
        "status": "deleted",
        "doc_id": row_id,
    }
