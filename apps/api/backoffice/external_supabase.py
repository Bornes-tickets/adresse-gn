from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from django.conf import settings


class SupabaseExternalError(RuntimeError):
    pass


def _setting(*names: str) -> str:
    for name in names:
        value = str(
            getattr(settings, name, "")
            or os.environ.get(name, "")
            or ""
        ).strip()
        if value:
            return value
    return ""


def supabase_url() -> str:
    value = _setting("SUPABASE_URL")
    if not value:
        raise SupabaseExternalError("SUPABASE_URL serveur manquant.")
    return value.rstrip("/")


def service_key() -> str:
    value = _setting(
        "SUPABASE_SECRET_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_KEY",
    )
    if not value:
        raise SupabaseExternalError("Clé serveur Supabase manquante.")
    return value


def publishable_key() -> str:
    value = _setting(
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )
    if not value:
        raise SupabaseExternalError("Clé publique Supabase manquante.")
    return value


def public_site_url(fallback: str | None = None) -> str:
    configured = _setting(
        "PUBLIC_SITE_URL",
        "NEXT_PUBLIC_SITE_URL",
        "SITE_URL",
    ).rstrip("/")
    if configured.startswith(("https://", "http://")):
        return configured

    candidate = str(fallback or "").strip().rstrip("/")
    if candidate.startswith(("https://", "http://")):
        return candidate

    return "http://localhost:3000"


def _admin_headers(
    *,
    content_type: str | None = "application/json",
) -> dict[str, str]:
    key = service_key()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _public_headers() -> dict[str, str]:
    key = publishable_key()
    return {
        "apikey": key,
        "Content-Type": "application/json",
    }


def _decode_error(exc: HTTPError) -> str:
    try:
        raw = exc.read(4096).decode("utf-8", errors="replace")
    except Exception:
        raw = ""

    if raw:
        try:
            payload = json.loads(raw)
            if isinstance(payload, dict):
                for key in (
                    "msg",
                    "message",
                    "error_description",
                    "error",
                ):
                    value = payload.get(key)
                    if value:
                        return str(value)
        except json.JSONDecodeError:
            return raw[:500]

    return f"HTTP {exc.code}"


def _json_request(
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    *,
    query: dict[str, str] | None = None,
    admin: bool = True,
) -> Any:
    url = f"{supabase_url()}{path}"
    if query:
        url += "?" + urlencode(query)

    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    request = Request(
        url,
        data=body,
        headers=(
            _admin_headers()
            if admin
            else _public_headers()
        ),
        method=method,
    )

    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read()
    except HTTPError as exc:
        raise SupabaseExternalError(_decode_error(exc)) from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise SupabaseExternalError(
            f"Service Supabase indisponible : {exc}"
        ) from exc

    if not raw:
        return {}

    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        return {"raw": raw.decode("utf-8", errors="replace")}


def _object_path(bucket: str, storage_path: str) -> str:
    safe_bucket = quote(bucket, safe="")
    safe_path = "/".join(
        quote(part, safe="")
        for part in storage_path.split("/")
        if part
    )
    return f"{safe_bucket}/{safe_path}"


def create_auth_user(
    *,
    email: str,
    password: str,
    full_name: str,
    phone: str | None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "full_name": full_name,
    }
    if phone:
        metadata["phone"] = phone

    result = _json_request(
        "POST",
        "/auth/v1/admin/users",
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": metadata,
        },
    )
    if not isinstance(result, dict):
        raise SupabaseExternalError("Réponse Auth Admin invalide.")
    return result


def update_auth_user(
    user_id: str,
    attributes: dict[str, Any],
) -> dict[str, Any]:
    result = _json_request(
        "PUT",
        f"/auth/v1/admin/users/{quote(user_id, safe='')}",
        attributes,
    )
    if not isinstance(result, dict):
        raise SupabaseExternalError("Réponse Auth Admin invalide.")
    return result


def delete_auth_user(user_id: str) -> None:
    _json_request(
        "DELETE",
        f"/auth/v1/admin/users/{quote(user_id, safe='')}",
    )


def send_password_recovery(
    *,
    email: str,
    redirect_to: str,
) -> None:
    _json_request(
        "POST",
        "/auth/v1/recover",
        {"email": email},
        query={"redirect_to": redirect_to},
        admin=False,
    )


def upload_storage_object(
    *,
    bucket: str,
    storage_path: str,
    content: bytes,
    content_type: str,
) -> None:
    url = (
        f"{supabase_url()}/storage/v1/object/"
        f"{_object_path(bucket, storage_path)}"
    )
    headers = _admin_headers(content_type=content_type)
    headers["x-upsert"] = "false"

    request = Request(
        url,
        data=content,
        headers=headers,
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            response.read()
    except HTTPError as exc:
        raise SupabaseExternalError(_decode_error(exc)) from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise SupabaseExternalError(
            f"Storage Supabase indisponible : {exc}"
        ) from exc


def delete_storage_object(
    *,
    bucket: str,
    storage_path: str,
) -> None:
    url = (
        f"{supabase_url()}/storage/v1/object/"
        f"{_object_path(bucket, storage_path)}"
    )
    request = Request(
        url,
        headers=_admin_headers(content_type=None),
        method="DELETE",
    )

    try:
        with urlopen(request, timeout=20) as response:
            response.read()
    except HTTPError as exc:
        raise SupabaseExternalError(_decode_error(exc)) from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise SupabaseExternalError(
            f"Storage Supabase indisponible : {exc}"
        ) from exc


def signed_storage_url(
    *,
    bucket: str,
    storage_path: str,
    expires_in: int = 300,
) -> str:
    result = _json_request(
        "POST",
        (
            "/storage/v1/object/sign/"
            + _object_path(bucket, storage_path)
        ),
        {"expiresIn": max(60, min(int(expires_in), 3600))},
    )

    signed = ""
    if isinstance(result, dict):
        signed = str(
            result.get("signedURL")
            or result.get("signedUrl")
            or ""
        ).strip()

    if not signed:
        raise SupabaseExternalError(
            "URL signée Storage non retournée."
        )

    if signed.startswith(("http://", "https://")):
        return signed

    if not signed.startswith("/"):
        signed = "/" + signed

    if signed.startswith("/storage/v1/"):
        return f"{supabase_url()}{signed}"

    return f"{supabase_url()}/storage/v1{signed}"
