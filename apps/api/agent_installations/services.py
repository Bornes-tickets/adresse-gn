from __future__ import annotations

import base64
import binascii
import json
import urllib.error
import urllib.parse
import urllib.request

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db import (
    IntegrityError,
    connection,
    transaction,
)

from entitlements import (
    installation_requirements_from_order_items,
)


INSTALLATION_PHOTO_BUCKET = (
    "installation-photos"
)

INSTALLATION_PHOTO_SIGNED_URL_SECONDS = (
    60 * 60 * 24 * 365
)

INSTALLATION_PHOTO_MAX_BYTES = (
    500 * 1024
)

INSTALLATION_PHOTO_PREFIX = (
    "data:image/jpeg;base64,"
)


ADDRESS_CATEGORY_CHOICES = frozenset(
    {
        "habitation",
        "restaurant",
        "hotel",
        "bar",
        "commerce",
        "entreprise",
        "administration",
        "ecole",
        "sante",
        "pharmacie",
        "banque",
        "tourisme",
        "other",
    }
)


class AgentCompletionError(
    RuntimeError
):
    code = "AGENT_COMPLETE_ERROR"


class AgentCompletionNotFoundError(
    AgentCompletionError
):
    code = "AGENT_COMPLETE_NOT_FOUND"


class AgentCompletionContractError(
    AgentCompletionError
):
    code = (
        "AGENT_COMPLETE_CONTRACT_INVALID"
    )


class AgentCompletionStateError(
    AgentCompletionError
):
    code = (
        "AGENT_COMPLETE_STATE_INVALID"
    )


class AgentCompletionConflictError(
    AgentCompletionError
):
    code = "AGENT_COMPLETE_CONFLICT"


class AgentCompletionStorageError(
    AgentCompletionError
):
    code = (
        "AGENT_COMPLETE_STORAGE_ERROR"
    )


def _clean_optional_text(
    value: Any,
) -> str | None:
    if value is None:
        return None

    clean = str(
        value
    ).strip()

    return clean or None


def _require_uuid_text(
    value: Any,
    *,
    field_name: str,
) -> str:
    try:
        parsed = UUID(
            str(
                value
            )
        )

    except (
        TypeError,
        ValueError,
        AttributeError,
    ) as exc:
        raise AgentCompletionContractError(
            f"{field_name} invalide."
        ) from exc

    return str(
        parsed
    )


def _decimal_value(
    value: Any,
    *,
    field_name: str,
) -> Decimal:
    try:
        result = Decimal(
            str(
                value
            )
        )

    except Exception as exc:
        raise AgentCompletionContractError(
            f"{field_name} invalide."
        ) from exc

    if not result.is_finite():
        raise AgentCompletionContractError(
            f"{field_name} invalide."
        )

    return result


def _validated_measures(
    raw_measures: Any,
) -> list[dict[str, Any]]:
    if not isinstance(
        raw_measures,
        (
            list,
            tuple,
        ),
    ):
        raise AgentCompletionContractError(
            "Mesures GPS invalides."
        )

    if len(
        raw_measures
    ) != 3:
        raise AgentCompletionContractError(
            (
                "Exactement trois mesures "
                "GPS sont requises."
            )
        )

    result: list[
        dict[str, Any]
    ] = []

    for sequence_no, raw in enumerate(
        raw_measures,
        start=1,
    ):
        if not isinstance(
            raw,
            dict,
        ):
            raise AgentCompletionContractError(
                "Mesure GPS invalide."
            )

        lat = _decimal_value(
            raw.get(
                "lat"
            ),
            field_name="lat",
        )

        lng = _decimal_value(
            raw.get(
                "lng"
            ),
            field_name="lng",
        )

        accuracy = _decimal_value(
            raw.get(
                "accuracy_m"
            ),
            field_name="accuracy_m",
        )

        taken_at = raw.get(
            "taken_at"
        )

        if (
            lat < Decimal("-90")
            or lat > Decimal("90")
        ):
            raise AgentCompletionContractError(
                "Latitude GPS invalide."
            )

        if (
            lng < Decimal("-180")
            or lng > Decimal("180")
        ):
            raise AgentCompletionContractError(
                "Longitude GPS invalide."
            )

        if (
            accuracy < Decimal("0")
            or accuracy > Decimal("3.0")
        ):
            raise AgentCompletionContractError(
                (
                    "Precision GPS hors "
                    "contrat Agent V1."
                )
            )

        if (
            not isinstance(
                taken_at,
                datetime,
            )
            or taken_at.tzinfo is None
        ):
            raise AgentCompletionContractError(
                "Horodatage GPS invalide."
            )

        result.append(
            {
                "sequence_no":
                    sequence_no,

                "lat":
                    lat,

                "lng":
                    lng,

                "accuracy_m":
                    accuracy,

                "taken_at":
                    taken_at,
            }
        )

    return result


def _aggregate_measures(
    measures: list[
        dict[str, Any]
    ],
) -> tuple[
    Decimal,
    Decimal,
    Decimal,
]:
    if len(
        measures
    ) != 3:
        raise AgentCompletionContractError(
            (
                "Exactement trois mesures "
                "GPS sont requises."
            )
        )

    divisor = Decimal(
        "3"
    )

    latitude = (
        sum(
            (
                item["lat"]
                for item in measures
            ),
            Decimal("0"),
        )
        / divisor
    ).quantize(
        Decimal("0.0000001"),
        rounding=ROUND_HALF_UP,
    )

    longitude = (
        sum(
            (
                item["lng"]
                for item in measures
            ),
            Decimal("0"),
        )
        / divisor
    ).quantize(
        Decimal("0.0000001"),
        rounding=ROUND_HALF_UP,
    )

    accuracy = (
        sum(
            (
                item[
                    "accuracy_m"
                ]
                for item in measures
            ),
            Decimal("0"),
        )
        / divisor
    ).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    return (
        latitude,
        longitude,
        accuracy,
    )


def _decode_photo(
    value: Any,
) -> bytes:
    photo = str(
        value or ""
    )

    if not photo.startswith(
        INSTALLATION_PHOTO_PREFIX
    ):
        raise AgentCompletionContractError(
            (
                "Photo JPEG Agent V1 "
                "invalide."
            )
        )

    encoded = photo[
        len(
            INSTALLATION_PHOTO_PREFIX
        ):
    ]

    try:
        raw = base64.b64decode(
            encoded,
            validate=True,
        )

    except (
        binascii.Error,
        ValueError,
    ) as exc:
        raise AgentCompletionContractError(
            "Photo base64 invalide."
        ) from exc

    if (
        not raw
        or len(
            raw
        ) > INSTALLATION_PHOTO_MAX_BYTES
        or not raw.startswith(
            b"\xff\xd8"
        )
    ):
        raise AgentCompletionContractError(
            (
                "Photo JPEG Agent V1 "
                "invalide."
            )
        )

    return raw


def _storage_request(
    *,
    method: str,
    path: str,
    data: bytes | None = None,
    content_type: str = (
        "application/json"
    ),
    extra_headers: (
        dict[str, str]
        | None
    ) = None,
) -> bytes:
    base_url = str(
        settings.SUPABASE_URL
    ).rstrip("/")

    server_key = str(
        settings.SUPABASE_SERVER_KEY
    ).strip()

    if not base_url:
        raise AgentCompletionStorageError(
            (
                "Supabase Storage "
                "non configure."
            )
        )

    if not server_key:
        raise AgentCompletionStorageError(
            (
                "Cle serveur Supabase "
                "Storage absente."
            )
        )

    headers = {
        "Authorization":
            f"Bearer {server_key}",

        "apikey":
            server_key,

        "Content-Type":
            content_type,
    }

    if extra_headers:
        headers.update(
            {
                str(key): str(value)
                for key, value
                in extra_headers.items()
            }
        )

    request = urllib.request.Request(
        f"{base_url}{path}",
        data=data,
        method=method,
        headers=headers,
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=30,
        ) as response:
            return response.read()

    except urllib.error.HTTPError as exc:
        try:
            body = (
                exc.read()
                .decode(
                    "utf-8",
                    errors="replace",
                )
            )

        except Exception:
            body = ""

        raise AgentCompletionStorageError(
            (
                "Supabase Storage a refuse "
                f"l operation HTTP {exc.code}. "
                f"{body[:300]}"
            )
        ) from exc

    except urllib.error.URLError as exc:
        raise AgentCompletionStorageError(
            (
                "Supabase Storage "
                "est inaccessible."
            )
        ) from exc


def _photo_object_path(
    *,
    agent_id: str,
    client_uuid: str,
) -> str:
    """
    Stable path by authenticated Agent + idempotence key.

    The database advisory lock on client_uuid prevents two
    concurrent Agent completion attempts from racing on the
    same object path.
    """

    return (
        f"{agent_id}/"
        f"{client_uuid}.jpg"
    )


def _delete_installation_photo(
    *,
    object_path: str,
    suppress_errors: bool = True,
) -> None:
    encoded_path = urllib.parse.quote(
        object_path,
        safe="/",
    )

    try:
        _storage_request(
            method="DELETE",
            path=(
                "/storage/v1/object/"
                f"{INSTALLATION_PHOTO_BUCKET}/"
                f"{encoded_path}"
            ),
        )

    except Exception:
        if not suppress_errors:
            raise


def _upload_installation_photo(
    *,
    agent_id: str,
    client_uuid: str,
    photo_bytes: bytes,
) -> tuple[str, str]:
    object_path = (
        _photo_object_path(
            agent_id=agent_id,
            client_uuid=client_uuid,
        )
    )

    encoded_path = urllib.parse.quote(
        object_path,
        safe="/",
    )

    _storage_request(
        method="POST",
        path=(
            "/storage/v1/object/"
            f"{INSTALLATION_PHOTO_BUCKET}/"
            f"{encoded_path}"
        ),
        data=photo_bytes,
        content_type="image/jpeg",
        extra_headers={
            "x-upsert": "true",
        },
    )

    sign_payload = json.dumps(
        {
            "expiresIn": (
                INSTALLATION_PHOTO_SIGNED_URL_SECONDS
            ),
        }
    ).encode(
        "utf-8"
    )

    try:
        raw = _storage_request(
            method="POST",
            path=(
                "/storage/v1/object/sign/"
                f"{INSTALLATION_PHOTO_BUCKET}/"
                f"{encoded_path}"
            ),
            data=sign_payload,
            content_type=(
                "application/json"
            ),
        )

        parsed = json.loads(
            raw.decode(
                "utf-8"
            )
        )

        signed = (
            parsed.get(
                "signedURL"
            )
            or parsed.get(
                "signedUrl"
            )
            or parsed.get(
                "signed_url"
            )
        )

        if not signed:
            raise AgentCompletionStorageError(
                (
                    "URL signee absente "
                    "de la reponse Storage."
                )
            )

        base_url = str(
            settings.SUPABASE_URL
        ).rstrip("/")

        signed_text = str(
            signed
        )

        if signed_text.startswith(
            (
                "http://",
                "https://",
            )
        ):
            full_signed_url = (
                signed_text
            )

        elif signed_text.startswith(
            "/storage/v1/"
        ):
            full_signed_url = (
                base_url
                + signed_text
            )

        else:
            full_signed_url = (
                f"{base_url}/storage/v1/"
                f"{signed_text.lstrip('/')}"
            )

        return (
            object_path,
            full_signed_url,
        )

    except Exception:
        _delete_installation_photo(
            object_path=object_path,
            suppress_errors=True,
        )
        raise


def _validate_business_payload(
    *,
    payload: dict[str, Any],
    requirements: dict[str, Any],
) -> dict[str, Any]:
    category = str(
        payload.get(
            "category"
        )
        or ""
    ).strip().lower()

    if (
        category
        not in ADDRESS_CATEGORY_CHOICES
    ):
        raise AgentCompletionContractError(
            "Categorie d adresse invalide."
        )

    visibility = str(
        payload.get(
            "visibility"
        )
        or ""
    ).strip().lower()

    if visibility != "private":
        raise AgentCompletionContractError(
            (
                "La pose terrain "
                "doit rester privee."
            )
        )

    if (
        requirements.get(
            "consent_required"
        )
        and payload.get(
            "consent"
        ) is not True
    ):
        raise AgentCompletionContractError(
            "Consentement obligatoire."
        )

    name = _clean_optional_text(
        payload.get(
            "name"
        )
    )

    if (
        requirements.get(
            "commercial_place_name_required"
        )
        and not name
    ):
        raise AgentCompletionContractError(
            (
                "Nom du lieu obligatoire "
                "pour ce contrat V1."
            )
        )

    access_point_note = (
        _clean_optional_text(
            payload.get(
                "access_point_note"
            )
        )
    )

    if (
        requirements.get(
            "access_point_note_required"
        )
        and not access_point_note
    ):
        raise AgentCompletionContractError(
            (
                "Note d acces detaillee "
                "obligatoire."
            )
        )

    return {
        "category":
            category,

        "visibility":
            visibility,

        "name":
            name,

        "access_point_note":
            access_point_note,

        "owner_name":
            _clean_optional_text(
                payload.get(
                    "owner_name"
                )
            ),

        "owner_phone":
            _clean_optional_text(
                payload.get(
                    "owner_phone"
                )
            ),
    }


def _require_snapshot(
    items: Any,
) -> dict[str, Any]:
    try:
        requirements = (
            installation_requirements_from_order_items(
                items
            )
        )

    except Exception as exc:
        raise AgentCompletionStateError(
            "Snapshot achete invalide."
        ) from exc

    if requirements is None:
        raise AgentCompletionStateError(
            "Snapshot physique V1 requis."
        )

    if (
        str(
            requirements.get(
                "fulfillment_kind"
            )
            or ""
        )
        != "physical_installation"
    ):
        raise AgentCompletionStateError(
            "Contrat physique requis."
        )

    if (
        int(
            requirements.get(
                "gps_measure_count"
            )
            or 0
        )
        != 3
    ):
        raise AgentCompletionStateError(
            "Contrat GPS V1 incoherent."
        )

    if (
        Decimal(
            str(
                requirements.get(
                    "gps_max_accuracy_m"
                )
            )
        )
        != Decimal("3.0")
    ):
        raise AgentCompletionStateError(
            "Seuil GPS V1 incoherent."
        )

    return requirements


def complete_agent_installation(
    *,
    pending_installation_id: str,
    agent_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Agent-only physical completion V1.

    Database writes are atomic.

    Supabase Storage is external to the PostgreSQL
    transaction. A photo uploaded by this attempt is
    therefore deleted best-effort if the database
    transaction fails.

    No routing, snap, K or radius operation is used.
    """

    clean_pending_id = (
        _require_uuid_text(
            pending_installation_id,
            field_name=(
                "pending_installation_id"
            ),
        )
    )

    clean_agent_id = (
        _require_uuid_text(
            agent_id,
            field_name="agent_id",
        )
    )

    clean_client_uuid = (
        _require_uuid_text(
            payload.get(
                "client_uuid"
            ),
            field_name="client_uuid",
        )
    )

    measures = _validated_measures(
        payload.get(
            "measures"
        )
    )

    (
        average_lat,
        average_lng,
        average_accuracy,
    ) = _aggregate_measures(
        measures
    )

    photo_bytes = _decode_photo(
        payload.get(
            "photo_base64"
        )
    )

    uploaded_path: str | None = None

    try:
        with transaction.atomic():

            # ------------------------------------------------------------
            # Canonical task + order lock.
            # ------------------------------------------------------------

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        pi.id,
                        pi.order_id,
                        pi.customer_id,
                        pi.beacon_id,
                        pi.status,
                        pi.assigned_agent_id,
                        pi.scheduled_at,
                        pi.completed_at,

                        o.status AS order_status,
                        o.customer_id AS order_customer_id,
                        o.beacon_id AS order_beacon_id,
                        o.items

                    FROM public.pending_installations pi

                    JOIN public.orders o
                      ON o.id = pi.order_id

                    WHERE pi.id = %s

                    FOR UPDATE OF pi, o
                    """,
                    [
                        clean_pending_id,
                    ],
                )

                pending_row = (
                    cursor.fetchone()
                )

            if pending_row is None:
                raise AgentCompletionNotFoundError(
                    (
                        "Intervention terrain "
                        "introuvable."
                    )
                )

            (
                pending_id,
                order_id,
                pending_customer_id,
                pending_beacon_id,
                pending_status,
                assigned_agent_id,
                scheduled_at,
                completed_at,
                order_status,
                order_customer_id,
                order_beacon_id,
                order_items,
            ) = pending_row


            # ------------------------------------------------------------
            # Serialize the idempotence key globally in this DB transaction.
            # This also protects the stable Storage object path.
            # ------------------------------------------------------------

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT pg_advisory_xact_lock(
                        hashtextextended(
                            %s,
                            0
                        )
                    )
                    """,
                    [
                        clean_client_uuid,
                    ],
                )


            # ------------------------------------------------------------
            # Preallocated beacon integrity.
            # ------------------------------------------------------------

            if (
                pending_beacon_id is None
                or order_beacon_id is None
                or str(
                    pending_beacon_id
                )
                != str(
                    order_beacon_id
                )
            ):
                raise AgentCompletionStateError(
                    (
                        "Pre-allocation balise "
                        "incoherente."
                    )
                )


            # ------------------------------------------------------------
            # Exactly one canonical order site.
            # ------------------------------------------------------------

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        beacon_id,
                        status

                    FROM public.order_sites

                    WHERE order_id = %s

                    ORDER BY
                        sequence_no ASC,
                        id ASC

                    FOR UPDATE
                    """,
                    [
                        order_id,
                    ],
                )

                site_rows = (
                    cursor.fetchall()
                )

            if len(
                site_rows
            ) != 1:
                raise AgentCompletionStateError(
                    (
                        "Un site canonique "
                        "unique est requis."
                    )
                )

            (
                order_site_id,
                site_beacon_id,
                _site_status,
            ) = site_rows[0]

            if (
                site_beacon_id is None
                or str(
                    site_beacon_id
                )
                != str(
                    pending_beacon_id
                )
            ):
                raise AgentCompletionStateError(
                    "Site et balise incoherents."
                )


            # ------------------------------------------------------------
            # IDEMPOTENT REPLAY.
            #
            # It intentionally precedes new-completion state gates and
            # Storage upload. A committed retry never creates new rows
            # and never uploads the photo again.
            # ------------------------------------------------------------

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        beacon_id,
                        agent_id,
                        order_site_id

                    FROM public.installations

                    WHERE client_uuid = %s

                    FOR UPDATE
                    """,
                    [
                        clean_client_uuid,
                    ],
                )

                replay_row = (
                    cursor.fetchone()
                )

            if replay_row is not None:
                (
                    installation_id,
                    replay_beacon_id,
                    replay_agent_id,
                    replay_site_id,
                ) = replay_row

                if (
                    str(
                        replay_beacon_id
                    )
                    != str(
                        pending_beacon_id
                    )

                    or str(
                        replay_agent_id
                    )
                    != clean_agent_id

                    or str(
                        replay_site_id
                    )
                    != str(
                        order_site_id
                    )
                ):
                    raise AgentCompletionConflictError(
                        (
                            "client_uuid deja utilise "
                            "pour une autre installation."
                        )
                    )

                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT sequence_no
                        FROM public.installation_measures
                        WHERE installation_id = %s
                          AND sequence_no IS NOT NULL
                        ORDER BY sequence_no
                        """,
                        [
                            installation_id,
                        ],
                    )

                    replay_sequences = [
                        int(
                            row[0]
                        )
                        for row
                        in cursor.fetchall()
                    ]

                    cursor.execute(
                        """
                        SELECT
                            a.id,
                            b.public_number

                        FROM public.addresses a

                        JOIN public.beacons b
                          ON b.id = a.beacon_id

                        WHERE a.beacon_id = %s
                        """,
                        [
                            pending_beacon_id,
                        ],
                    )

                    replay_address = (
                        cursor.fetchone()
                    )

                if replay_sequences != [
                    1,
                    2,
                    3,
                ]:
                    raise AgentCompletionConflictError(
                        (
                            "Installation rejouee "
                            "sans contrat GPS V1 complet."
                        )
                    )

                if replay_address is None:
                    raise AgentCompletionConflictError(
                        (
                            "Adresse canonique absente "
                            "pour le replay."
                        )
                    )

                (
                    replay_address_id,
                    replay_public_number,
                ) = replay_address

                replay_owner_id = (
                    order_customer_id
                    or pending_customer_id
                )

                if replay_owner_id is None:
                    raise AgentCompletionConflictError(
                        (
                            "Proprietaire absent "
                            "pour le replay."
                        )
                    )

                return {
                    "ok": True,
                    "status": str(
                        pending_status
                    ),
                    "idempotent": True,

                    "pending_installation_id":
                        str(
                            pending_id
                        ),

                    "order_id":
                        str(
                            order_id
                        ),

                    "order_site_id":
                        str(
                            order_site_id
                        ),

                    "installation_id":
                        str(
                            installation_id
                        ),

                    "beacon_id":
                        str(
                            pending_beacon_id
                        ),

                    "public_number":
                        str(
                            replay_public_number
                        ),

                    "address_id":
                        str(
                            replay_address_id
                        ),

                    "owner_id":
                        str(
                            replay_owner_id
                        ),
                }


            # ------------------------------------------------------------
            # NEW COMPLETION: immutable purchased snapshot is authority.
            # ------------------------------------------------------------

            requirements = (
                _require_snapshot(
                    order_items
                )
            )

            if str(
                order_status
            ) != "paid":
                raise AgentCompletionStateError(
                    "Commande non payee."
                )

            customer_id = (
                order_customer_id
                or pending_customer_id
            )

            if customer_id is None:
                raise AgentCompletionStateError(
                    "Commande sans proprietaire."
                )

            if assigned_agent_id is None:
                raise AgentCompletionStateError(
                    "Aucun agent affecte."
                )

            if (
                str(
                    assigned_agent_id
                )
                != clean_agent_id
            ):
                raise AgentCompletionStateError(
                    (
                        "Intervention affectee "
                        "a un autre agent."
                    )
                )

            if str(
                pending_status
            ) != "planned":
                raise AgentCompletionStateError(
                    (
                        "Intervention non planifiee "
                        "ou deja traitee."
                    )
                )

            if completed_at is not None:
                raise AgentCompletionStateError(
                    (
                        "completed_at doit rester "
                        "vide avant QC."
                    )
                )

            if scheduled_at is None:
                raise AgentCompletionStateError(
                    (
                        "Intervention sans "
                        "date planifiee."
                    )
                )


            # ------------------------------------------------------------
            # Lock canonical preallocated address + beacon.
            # ------------------------------------------------------------

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        a.id,
                        a.owner_id,
                        a.status,
                        a.visibility,
                        a.verification_level,

                        b.status,
                        b.public_number

                    FROM public.addresses a

                    JOIN public.beacons b
                      ON b.id = a.beacon_id

                    WHERE a.beacon_id = %s

                    FOR UPDATE OF a, b
                    """,
                    [
                        pending_beacon_id,
                    ],
                )

                address_rows = (
                    cursor.fetchall()
                )

            if len(
                address_rows
            ) != 1:
                raise AgentCompletionStateError(
                    (
                        "Adresse canonique "
                        "unique requise."
                    )
                )

            (
                address_id,
                address_owner_id,
                address_status,
                address_visibility,
                verification_level,
                beacon_status,
                public_number,
            ) = address_rows[0]

            if (
                address_owner_id is None
                or str(
                    address_owner_id
                )
                != str(
                    customer_id
                )
            ):
                raise AgentCompletionStateError(
                    (
                        "Proprietaire canonique "
                        "incoherent."
                    )
                )

            if str(
                beacon_status
            ) != "active":
                raise AgentCompletionStateError(
                    "Balise inactive."
                )

            if str(
                address_status
            ) != "active":
                raise AgentCompletionStateError(
                    "Adresse inactive."
                )

            if str(
                address_visibility
            ) != "private":
                raise AgentCompletionStateError(
                    (
                        "Adresse deja publiee "
                        "ou incoherente."
                    )
                )

            if (
                str(
                    verification_level
                )
                not in {
                    "pending",
                    "unverified",
                }
            ):
                raise AgentCompletionStateError(
                    (
                        "Niveau de verification "
                        "incompatible."
                    )
                )


            # ------------------------------------------------------------
            # Plan-specific field requirements.
            # ------------------------------------------------------------

            business = (
                _validate_business_payload(
                    payload=payload,
                    requirements=requirements,
                )
            )


            # ------------------------------------------------------------
            # Independent active-installation guard.
            # ------------------------------------------------------------

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id

                    FROM public.installations

                    WHERE
                        (
                            order_site_id = %s
                            OR beacon_id = %s
                        )

                        AND uninstalled_at IS NULL

                    FOR UPDATE
                    """,
                    [
                        order_site_id,
                        pending_beacon_id,
                    ],
                )

                active_rows = (
                    cursor.fetchall()
                )

            if active_rows:
                raise AgentCompletionConflictError(
                    (
                        "Une installation active "
                        "existe deja."
                    )
                )


            # ------------------------------------------------------------
            # External Storage upload.
            #
            # Still inside the DB transaction so task/beacon/site locks
            # are preserved. Any later DB failure triggers best-effort
            # deletion of this object outside the rollback.
            # ------------------------------------------------------------

            (
                uploaded_path,
                signed_photo_url,
            ) = _upload_installation_photo(
                agent_id=clean_agent_id,
                client_uuid=clean_client_uuid,
                photo_bytes=photo_bytes,
            )


            # ------------------------------------------------------------
            # Atomic business writes.
            # ------------------------------------------------------------

            with connection.cursor() as cursor:

                cursor.execute(
                    """
                    UPDATE public.addresses

                    SET
                        category = %s,
                        name = %s,

                        location = ST_SetSRID(
                            ST_MakePoint(
                                %s::double precision,
                                %s::double precision
                            ),
                            4326
                        )::geography,

                        accuracy_m = %s,
                        visibility = 'private',
                        access_point_note = %s

                    WHERE id = %s
                      AND beacon_id = %s
                      AND owner_id = %s
                      AND status = 'active'
                      AND visibility = 'private'

                      AND verification_level IN (
                          'pending',
                          'unverified'
                      )
                    """,
                    [
                        business[
                            "category"
                        ],

                        business[
                            "name"
                        ],

                        float(
                            average_lng
                        ),

                        float(
                            average_lat
                        ),

                        float(
                            average_accuracy
                        ),

                        business[
                            "access_point_note"
                        ],

                        address_id,
                        pending_beacon_id,
                        customer_id,
                    ],
                )

                if cursor.rowcount != 1:
                    raise AgentCompletionConflictError(
                        (
                            "Adresse modifiee "
                            "concurremment."
                        )
                    )


                cursor.execute(
                    """
                    INSERT INTO public.installations (
                        beacon_id,
                        agent_id,
                        gps_lat,
                        gps_lng,
                        accuracy_m,
                        photo_url,
                        installed_at,
                        validated_at,
                        validator_id,
                        client_uuid,
                        order_site_id
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        NOW(),
                        NULL,
                        NULL,
                        %s,
                        %s
                    )
                    RETURNING id
                    """,
                    [
                        pending_beacon_id,
                        clean_agent_id,

                        float(
                            average_lat
                        ),

                        float(
                            average_lng
                        ),

                        float(
                            average_accuracy
                        ),

                        signed_photo_url,
                        clean_client_uuid,
                        order_site_id,
                    ],
                )

                installation_id = (
                    cursor.fetchone()[0]
                )


                cursor.executemany(
                    """
                    INSERT INTO public.installation_measures (
                        installation_id,
                        lat,
                        lng,
                        accuracy_m,
                        taken_at,
                        sequence_no
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    )
                    """,
                    [
                        [
                            installation_id,
                            item["lat"],
                            item["lng"],
                            item[
                                "accuracy_m"
                            ],
                            item[
                                "taken_at"
                            ],
                            item[
                                "sequence_no"
                            ],
                        ]
                        for item
                        in measures
                    ],
                )


                # Service-level exactly-three invariant.
                with connection.cursor() as count_cursor:
                    count_cursor.execute(
                        """
                        SELECT COUNT(*)

                        FROM public.installation_measures

                        WHERE installation_id = %s
                          AND sequence_no IS NOT NULL
                        """,
                        [
                            installation_id,
                        ],
                    )

                    measure_count = int(
                        count_cursor.fetchone()[0]
                    )

                if measure_count != 3:
                    raise AgentCompletionConflictError(
                        (
                            "Cardinalite GPS V1 "
                            "incomplete."
                        )
                    )


                # Optional declarative owner/contact metadata only.
                # addresses.owner_id remains the authority.
                if (
                    business[
                        "owner_name"
                    ]
                    or business[
                        "owner_phone"
                    ]
                ):
                    cursor.execute(
                        """
                        INSERT INTO public.unclaimed_owners (
                            beacon_id,
                            name,
                            phone,
                            consent_at
                        )
                        VALUES (
                            %s,
                            %s,
                            %s,
                            NOW()
                        )
                        """,
                        [
                            pending_beacon_id,

                            business[
                                "owner_name"
                            ],

                            business[
                                "owner_phone"
                            ],
                        ],
                    )


                cursor.execute(
                    """
                    UPDATE public.order_sites

                    SET
                        status = 'done',
                        updated_at = NOW()

                    WHERE id = %s
                      AND beacon_id = %s
                    """,
                    [
                        order_site_id,
                        pending_beacon_id,
                    ],
                )

                if cursor.rowcount != 1:
                    raise AgentCompletionConflictError(
                        (
                            "Site modifie "
                            "concurremment."
                        )
                    )


                cursor.execute(
                    """
                    UPDATE public.orders

                    SET
                        installed_at = NOW(),
                        updated_at = NOW()

                    WHERE id = %s
                      AND beacon_id = %s
                      AND status = 'paid'
                    """,
                    [
                        order_id,
                        pending_beacon_id,
                    ],
                )

                if cursor.rowcount != 1:
                    raise AgentCompletionConflictError(
                        (
                            "Commande modifiee "
                            "concurremment."
                        )
                    )


                cursor.execute(
                    """
                    UPDATE public.pending_installations

                    SET
                        assigned_agent_id = %s,
                        status = 'installed',
                        updated_at = NOW()

                    WHERE id = %s
                      AND beacon_id = %s
                      AND assigned_agent_id = %s
                      AND status = 'planned'
                      AND scheduled_at IS NOT NULL
                      AND completed_at IS NULL
                    """,
                    [
                        clean_agent_id,
                        pending_id,
                        pending_beacon_id,
                        clean_agent_id,
                    ],
                )

                if cursor.rowcount != 1:
                    raise AgentCompletionConflictError(
                        (
                            "Intervention modifiee "
                            "concurremment."
                        )
                    )


                cursor.execute(
                    """
                    INSERT INTO public.audit_logs (
                        actor_id,
                        action,
                        entity,
                        entity_id,
                        after
                    )
                    VALUES (
                        %s,
                        'installation.agent_complete.v1',
                        'installations',
                        %s,

                        jsonb_build_object(
                            'pending_installation_id',
                            %s,

                            'order_id',
                            %s,

                            'order_site_id',
                            %s,

                            'beacon_id',
                            %s,

                            'address_id',
                            %s,

                            'public_number',
                            %s,

                            'client_uuid',
                            %s,

                            'gps_measure_count',
                            3,

                            'gps_accuracy_max_m',
                            3.0
                        )
                    )
                    RETURNING id
                    """,
                    [
                        clean_agent_id,
                        installation_id,
                        pending_id,
                        order_id,
                        order_site_id,
                        pending_beacon_id,
                        address_id,
                        public_number,
                        clean_client_uuid,
                    ],
                )

                audit_id = (
                    cursor.fetchone()[0]
                )


            result = {
                "ok":
                    True,

                "status":
                    "installed",

                "idempotent":
                    False,

                "pending_installation_id":
                    str(
                        pending_id
                    ),

                "order_id":
                    str(
                        order_id
                    ),

                "order_site_id":
                    str(
                        order_site_id
                    ),

                "installation_id":
                    str(
                        installation_id
                    ),

                "beacon_id":
                    str(
                        pending_beacon_id
                    ),

                "public_number":
                    str(
                        public_number
                    ),

                "address_id":
                    str(
                        address_id
                    ),

                "owner_id":
                    str(
                        customer_id
                    ),

                "audit_id":
                    str(
                        audit_id
                    ),

                "gps": {
                    "measure_count":
                        3,

                    "lat":
                        float(
                            average_lat
                        ),

                    "lng":
                        float(
                            average_lng
                        ),

                    "accuracy_m":
                        float(
                            average_accuracy
                        ),
                },
            }


        return result


    except IntegrityError as exc:
        if uploaded_path:
            _delete_installation_photo(
                object_path=uploaded_path,
                suppress_errors=True,
            )

        raise AgentCompletionConflictError(
            (
                "Conflit d idempotence "
                "ou d installation active."
            )
        ) from exc


    except Exception:
        if uploaded_path:
            _delete_installation_photo(
                object_path=uploaded_path,
                suppress_errors=True,
            )

        raise
