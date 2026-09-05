import json
import mimetypes
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import uuid4

from django.conf import settings
from django.db import IntegrityError, connection

from .services import get_address_detail


CLAIM_EVIDENCE_BUCKET = "claim-evidence"
CLAIM_SIGNED_URL_SECONDS = 60 * 60 * 24 * 365


class ClaimStorageError(Exception):
    pass


def _resolve_claim_target(
    raw_number: str,
) -> dict[str, Any]:
    detail = get_address_detail(
        raw_number=raw_number,
    )

    if detail["status"] == "invalid":
        return {
            "ok": False,
            "status": "invalid",
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
            "message": (
                "Adresse introuvable."
            ),
        }

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                a.id,
                a.owner_id,
                (
                    SELECT u.id
                    FROM public.unclaimed_owners u
                    WHERE u.beacon_id = %s
                    LIMIT 1
                )
            FROM public.addresses a
            WHERE a.beacon_id = %s
            LIMIT 1
            """,
            [
                beacon_id,
                beacon_id,
            ],
        )

        row = cursor.fetchone()

    if row is None:
        return {
            "ok": False,
            "status": "not_found",
            "message": (
                "Aucune adresse n'est rattachée "
                "à cette balise."
            ),
        }

    return {
        "ok": True,
        "status": "found",
        "beacon_id": beacon_id,
        "address_id": row[0],
        "owner_id": row[1],
        "unclaimed_owner_id": row[2],
    }


def _profile_exists(
    user_id: str,
) -> bool:
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

        return (
            cursor.fetchone()
            is not None
        )


def get_claim_context(
    raw_number: str,
    user_id: str,
) -> dict[str, Any]:
    target = _resolve_claim_target(
        raw_number=raw_number,
    )

    if not target["ok"]:
        return target

    beacon_id = target[
        "beacon_id"
    ]

    owner_id = target[
        "owner_id"
    ]

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT status
            FROM public.claim_requests
            WHERE
                beacon_id = %s
                AND requester_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            [
                beacon_id,
                user_id,
            ],
        )

        claim = cursor.fetchone()

    return {
        "ok": True,
        "status": "found",
        "is_mine": (
            owner_id is not None
            and str(owner_id) == str(user_id)
        ),
        "claim_status": (
            claim[0]
            if claim
            else None
        ),
    }


def _storage_admin_headers() -> dict[str, str]:
    key = getattr(
        settings,
        "SUPABASE_SERVER_KEY",
        "",
    )

    if not key:
        raise ClaimStorageError(
            "La clé serveur Supabase Storage "
            "n'est pas configurée."
        )

    headers = {
        "apikey": key,
        "User-Agent": (
            "Adresse-GN-Django/1.0"
        ),
    }

    # Les anciennes clés service_role sont des JWT.
    # Les nouvelles sb_secret_* doivent rester
    # uniquement dans l'en-tête apikey.
    if (
        key.startswith("eyJ")
        or key.count(".") == 2
    ):
        headers[
            "Authorization"
        ] = f"Bearer {key}"

    return headers


def _storage_request(
    method: str,
    url: str,
    *,
    body: bytes | None = None,
    content_type: str | None = None,
) -> dict[str, Any]:
    headers = (
        _storage_admin_headers()
    )

    if content_type:
        headers[
            "Content-Type"
        ] = content_type

    request = Request(
        url=url,
        data=body,
        headers=headers,
        method=method,
    )

    try:
        with urlopen(
            request,
            timeout=30,
        ) as response:
            raw = response.read()

    except HTTPError as exc:
        try:
            error_body = (
                exc.read()
                .decode(
                    "utf-8",
                    errors="replace",
                )
            )
        except Exception:
            error_body = ""

        raise ClaimStorageError(
            "Supabase Storage a refusé "
            f"l'opération HTTP {exc.code}. "
            f"{error_body[:300]}"
        ) from exc

    except URLError as exc:
        raise ClaimStorageError(
            "Supabase Storage est inaccessible."
        ) from exc

    if not raw:
        return {}

    try:
        return json.loads(
            raw.decode("utf-8")
        )
    except json.JSONDecodeError:
        return {}


def _safe_extension(
    filename: str,
    content_type: str,
) -> str:
    suffix = (
        Path(filename)
        .suffix
        .lower()
    )

    if (
        suffix
        and len(suffix) <= 10
        and suffix[1:].isalnum()
    ):
        return suffix

    guessed = mimetypes.guess_extension(
        content_type
    )

    if guessed:
        return guessed

    if content_type == "application/pdf":
        return ".pdf"

    return ".bin"


def _upload_claim_evidence(
    *,
    user_id: str,
    number: str,
    uploaded_file,
) -> tuple[str, str]:
    content_type = (
        getattr(
            uploaded_file,
            "content_type",
            None,
        )
        or mimetypes.guess_type(
            uploaded_file.name
        )[0]
        or "application/octet-stream"
    )

    extension = _safe_extension(
        uploaded_file.name,
        content_type,
    )

    object_path = (
        f"{user_id}/"
        f"{number}-"
        f"{uuid4().hex}"
        f"{extension}"
    )

    encoded_path = quote(
        object_path,
        safe="/",
    )

    bucket = quote(
        CLAIM_EVIDENCE_BUCKET,
        safe="",
    )

    base_url = (
        settings.SUPABASE_URL
        .rstrip("/")
    )

    upload_url = (
        f"{base_url}"
        f"/storage/v1/object/"
        f"{bucket}/{encoded_path}"
    )

    uploaded_file.seek(0)

    file_bytes = (
        uploaded_file.read()
    )

    _storage_request(
        "POST",
        upload_url,
        body=file_bytes,
        content_type=content_type,
    )

    sign_url = (
        f"{base_url}"
        f"/storage/v1/object/sign/"
        f"{bucket}/{encoded_path}"
    )

    sign_body = json.dumps(
        {
            "expiresIn":
                CLAIM_SIGNED_URL_SECONDS,
        }
    ).encode("utf-8")

    try:
        signed = _storage_request(
            "POST",
            sign_url,
            body=sign_body,
            content_type=(
                "application/json"
            ),
        )
    except Exception:
        _delete_claim_evidence(
            object_path
        )
        raise

    signed_url = (
        signed.get("signedURL")
        or signed.get("signedUrl")
        or signed.get("signed_url")
    )

    if not signed_url:
        _delete_claim_evidence(
            object_path
        )

        raise ClaimStorageError(
            "Impossible de générer "
            "l'accès sécurisé à la preuve."
        )

    if signed_url.startswith(
        "http://"
    ) or signed_url.startswith(
        "https://"
    ):
        full_signed_url = (
            signed_url
        )

    elif signed_url.startswith(
        "/storage/v1/"
    ):
        full_signed_url = (
            f"{base_url}"
            f"{signed_url}"
        )

    elif signed_url.startswith(
        "/object/"
    ):
        full_signed_url = (
            f"{base_url}"
            f"/storage/v1"
            f"{signed_url}"
        )

    else:
        full_signed_url = (
            f"{base_url}"
            f"/storage/v1/"
            f"{signed_url.lstrip('/')}"
        )

    return (
        object_path,
        full_signed_url,
    )


def _delete_claim_evidence(
    object_path: str,
) -> None:
    try:
        base_url = (
            settings.SUPABASE_URL
            .rstrip("/")
        )

        bucket = quote(
            CLAIM_EVIDENCE_BUCKET,
            safe="",
        )

        encoded_path = quote(
            object_path,
            safe="/",
        )

        delete_url = (
            f"{base_url}"
            f"/storage/v1/object/"
            f"{bucket}/{encoded_path}"
        )

        _storage_request(
            "DELETE",
            delete_url,
        )

    except Exception:
        # Nettoyage best effort.
        # Une erreur de cleanup ne doit pas masquer
        # l'erreur métier principale.
        pass


def create_address_claim(
    *,
    raw_number: str,
    requester_id: str,
    explanation: str,
    evidence_file=None,
) -> dict[str, Any]:
    target = _resolve_claim_target(
        raw_number=raw_number,
    )

    if not target["ok"]:
        return target

    if not _profile_exists(
        requester_id
    ):
        return {
            "ok": False,
            "status": "profile_missing",
            "claim_id": None,
            "message": (
                "Le profil utilisateur "
                "Adresse GN est introuvable."
            ),
        }

    owner_id = target[
        "owner_id"
    ]

    if owner_id is not None:
        if (
            str(owner_id)
            == str(requester_id)
        ):
            return {
                "ok": False,
                "status": "already_mine",
                "claim_id": None,
                "message": (
                    "Cette adresse vous "
                    "appartient déjà."
                ),
            }

        return {
            "ok": False,
            "status": "already_owned",
            "claim_id": None,
            "message": (
                "Cette adresse a déjà un "
                "propriétaire enregistré."
            ),
        }

    beacon_id = target[
        "beacon_id"
    ]

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id
            FROM public.claim_requests
            WHERE
                beacon_id = %s
                AND requester_id = %s
                AND status = 'pending'
            LIMIT 1
            """,
            [
                beacon_id,
                requester_id,
            ],
        )

        pending = cursor.fetchone()

    if pending is not None:
        return {
            "ok": False,
            "status": "pending_exists",
            "claim_id": str(
                pending[0]
            ),
            "message": (
                "Une demande est déjà en cours "
                "pour cette adresse."
            ),
        }

    evidence_text = (
        explanation.strip()
    )

    uploaded_path = None

    if evidence_file is not None:
        uploaded_path, signed_url = (
            _upload_claim_evidence(
                user_id=requester_id,
                number=raw_number,
                uploaded_file=(
                    evidence_file
                ),
            )
        )

        evidence_text = (
            f"{evidence_text}"
            f"\n\nPreuve : "
            f"{signed_url}"
        )

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO public.claim_requests
                    (
                        beacon_id,
                        requester_id,
                        unclaimed_owner_id,
                        evidence
                    )
                VALUES
                    (
                        %s,
                        %s,
                        %s,
                        %s
                    )
                RETURNING
                    id,
                    status,
                    created_at
                """,
                [
                    beacon_id,
                    requester_id,
                    target[
                        "unclaimed_owner_id"
                    ],
                    evidence_text,
                ],
            )

            created = (
                cursor.fetchone()
            )

    except IntegrityError:
        if uploaded_path:
            _delete_claim_evidence(
                uploaded_path
            )

        return {
            "ok": False,
            "status": "pending_exists",
            "claim_id": None,
            "message": (
                "Une demande est déjà en cours "
                "pour cette adresse."
            ),
        }

    except Exception:
        if uploaded_path:
            _delete_claim_evidence(
                uploaded_path
            )

        raise

    return {
        "ok": True,
        "status": "created",
        "claim_id": str(
            created[0]
        ),
        "claim_status": (
            created[1]
        ),
        "created_at": (
            created[2].isoformat()
            if created[2]
            else None
        ),
        "message": (
            "Demande envoyée. "
            "Notre équipe vérifie sous 48 h."
        ),
    }