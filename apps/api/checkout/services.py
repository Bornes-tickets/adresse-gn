from __future__ import annotations

import json
import re
from typing import Any

from django.db import connection, transaction

from .contracts import (
    normalize_client_type,
    normalize_payment_method,
    normalize_submission_channel,
)


class CheckoutOrderError(Exception):
    code = "CHECKOUT_ERROR"


class CheckoutInputError(CheckoutOrderError):
    code = "INVALID_INPUT"


class CheckoutAuthUserNotFoundError(CheckoutOrderError):
    code = "AUTH_USER_NOT_FOUND"


class CheckoutVerificationError(CheckoutOrderError):
    code = "VERIFICATION_REQUIRED"

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class CheckoutPlanNotFoundError(CheckoutOrderError):
    code = "PLAN_NOT_FOUND_OR_INACTIVE"


def _metadata_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}

        if isinstance(parsed, dict):
            return parsed

    return {}


def _resolve_verified_identity(
    *,
    auth_phone: str | None,
    auth_email: str | None,
    phone_confirmed_at,
    email_confirmed_at,
    user_metadata: Any,
    requested_email: str | None,
) -> dict[str, Any]:
    metadata = _metadata_dict(user_metadata)

    metadata_channel = str(
        metadata.get("adresse_gn_verification_channel") or ""
    ).strip().lower()

    if metadata_channel:
        channel = metadata_channel
    elif phone_confirmed_at is not None:
        channel = "sms"
    elif email_confirmed_at is not None:
        channel = "email"
    else:
        channel = ""

    if channel not in {"whatsapp", "email", "sms"}:
        raise CheckoutVerificationError(
            "INVALID_VERIFICATION_CHANNEL"
        )

    clean_requested_email = str(
        requested_email or ""
    ).strip()

    if channel in {"whatsapp", "sms"}:
        if phone_confirmed_at is None:
            raise CheckoutVerificationError(
                "PHONE_NOT_VERIFIED"
            )

        return {
            "channel": channel,
            "phone": auth_phone,
            "email": clean_requested_email or None,
            "phone_verified_at": phone_confirmed_at,
            "identity_verified_at": phone_confirmed_at,
        }

    if email_confirmed_at is None:
        raise CheckoutVerificationError(
            "EMAIL_NOT_VERIFIED"
        )

    clean_auth_email = str(
        auth_email or ""
    ).strip()

    if (
        clean_requested_email
        and clean_requested_email.lower()
        != clean_auth_email.lower()
    ):
        raise CheckoutVerificationError(
            "EMAIL_MISMATCH"
        )

    contact_phone = str(
        metadata.get("adresse_gn_contact_phone") or ""
    ).strip()

    if contact_phone:
        if not re.fullmatch(
            r"\+224[0-9]{9}",
            contact_phone,
        ):
            raise CheckoutVerificationError(
                "INVALID_CONTACT_PHONE"
            )
    else:
        contact_phone = None

    return {
        "channel": channel,
        "phone": contact_phone,
        "email": auth_email if auth_email else None,
        "phone_verified_at": None,
        "identity_verified_at": email_confirmed_at,
    }


def _create_checkout_order(
    *,
    user_id: str,
    payload: dict[str, Any],
) -> dict[str, str]:
    client_type = normalize_client_type(
        payload.get("client_type")
    )
    payment_method = normalize_payment_method(
        payload.get("payment_method")
    )
    submission_channel = normalize_submission_channel(
        payload.get("submission_channel")
    )

    full_name = str(
        payload.get("full_name") or ""
    )

    if not full_name.strip():
        raise CheckoutInputError(
            "FULL_NAME_REQUIRED"
        )

    lat = payload.get("lat")
    lng = payload.get("lng")

    if (lat is None) != (lng is None):
        raise CheckoutInputError(
            "LAT_LNG_MUST_BE_PROVIDED_TOGETHER"
        )

    if (
        lat is not None
        and not (-90 <= float(lat) <= 90)
    ):
        raise CheckoutInputError(
            "INVALID_LATITUDE"
        )

    if (
        lng is not None
        and not (-180 <= float(lng) <= 180)
    ):
        raise CheckoutInputError(
            "INVALID_LONGITUDE"
        )

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT set_config(
                'request.jwt.claim.sub',
                %s,
                true
            )
            """,
            [
                user_id,
            ],
        )

        cursor.execute(
            """
            SELECT
                phone,
                email,
                phone_confirmed_at,
                email_confirmed_at,
                COALESCE(
                    raw_user_meta_data,
                    '{}'::jsonb
                )
            FROM auth.users
            WHERE id = %s
            LIMIT 1
            """,
            [user_id],
        )

        auth_row = cursor.fetchone()

        if auth_row is None:
            raise CheckoutAuthUserNotFoundError(
                "AUTH_USER_NOT_FOUND"
            )

        identity = _resolve_verified_identity(
            auth_phone=auth_row[0],
            auth_email=auth_row[1],
            phone_confirmed_at=auth_row[2],
            email_confirmed_at=auth_row[3],
            user_metadata=auth_row[4],
            requested_email=payload.get("email"),
        )

        cursor.execute(
            """
            SELECT
                id,
                code,
                price_gnf,
                COALESCE(
                    recurring_price_gnf,
                    0
                ),
                COALESCE(
                    NULLIF(name ->> 'fr', ''),
                    NULLIF(name ->> 'en', ''),
                    code
                )
            FROM public.cms_plans
            WHERE
                code = %s
                AND active = true
            LIMIT 1
            """,
            [payload.get("plan_code")],
        )

        plan = cursor.fetchone()

        if plan is None:
            raise CheckoutPlanNotFoundError(
                "PLAN_NOT_FOUND_OR_INACTIVE"
            )

        (
            plan_id,
            plan_code,
            price_gnf,
            recurring_price_gnf,
            plan_label,
        ) = plan

        cursor.execute(
            """
            INSERT INTO public.profiles (
                id,
                full_name,
                phone
            )
            VALUES (
                %s,
                %s,
                %s
            )
            ON CONFLICT (id)
            DO UPDATE
            SET
                full_name = CASE
                    WHEN EXCLUDED.full_name IS NOT NULL
                     AND BTRIM(EXCLUDED.full_name) <> ''
                    THEN EXCLUDED.full_name
                    ELSE public.profiles.full_name
                END,
                phone = COALESCE(
                    EXCLUDED.phone,
                    public.profiles.phone
                )
            """,
            [
                user_id,
                full_name,
                identity["phone"],
            ],
        )

        cursor.execute(
            """
            INSERT INTO public.orders (
                customer_id,
                plan_id,
                offer_code,
                amount_gnf,
                recurring_amount_gnf,
                status,
                items,
                client_type,
                full_name,
                phone,
                email,
                address_line,
                nb_adresses,
                devis_demande,
                formule_code,
                formule_label,
                prix_ttc,
                payment_method,
                phone_verified_at,
                verification_channel,
                identity_verified_at,
                submitted_at,
                submission_channel
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                'pending',
                jsonb_build_array(
                    jsonb_build_object(
                        'qty',
                        1,
                        'code',
                        %s,
                        'label',
                        %s
                    )
                ),
                %s,
                %s,
                %s,
                %s,
                %s,
                1,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                NOW(),
                %s
            )
            RETURNING
                id,
                order_ref
            """,
            [
                user_id,
                plan_id,
                plan_code,
                price_gnf,
                recurring_price_gnf,
                plan_code,
                plan_label,
                client_type,
                full_name,
                identity["phone"],
                identity["email"],
                payload.get("address_line"),
                bool(
                    payload.get(
                        "devis_demande",
                        False,
                    )
                ),
                plan_code,
                plan_label,
                price_gnf,
                payment_method,
                identity["phone_verified_at"],
                identity["channel"],
                identity["identity_verified_at"],
                submission_channel,
            ],
        )

        order_row = cursor.fetchone()

        if order_row is None:
            raise CheckoutOrderError(
                "ORDER_INSERT_FAILED"
            )

        order_id = order_row[0]
        order_ref = order_row[1]

        place_type = str(
            payload.get("place_type") or ""
        ).strip()

        if not place_type:
            place_type = "other"

        place_name = str(
            payload.get("place_name") or ""
        ).strip()

        cursor.execute(
            """
            INSERT INTO public.order_sites (
                order_id,
                sequence_no,
                place_type,
                place_name,
                requested_location,
                location_accuracy_m,
                commune_id,
                district_id,
                sector_id,
                address_line,
                access_point_note,
                status
            )
            VALUES (
                %s,
                1,
                %s,
                %s,
                CASE
                    WHEN
                        %s::double precision IS NULL
                        OR
                        %s::double precision IS NULL
                    THEN NULL
                    ELSE
                        ST_SetSRID(
                            ST_MakePoint(
                                %s::double precision,
                                %s::double precision
                            ),
                            4326
                        )::geography
                END,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'pending'
            )
            """,
            [
                order_id,
                place_type,
                place_name or None,
                lat,
                lng,
                lng,
                lat,
                payload.get("accuracy_m"),
                payload.get("commune_id"),
                payload.get("district_id"),
                payload.get("sector_id"),
                payload.get("address_line"),
                payload.get("access_point_note"),
            ],
        )

    return {
        "order_id": str(order_id),
        "order_ref": str(order_ref),
    }


def create_checkout_order(
    *,
    user_id: str,
    payload: dict[str, Any],
) -> dict[str, str]:
    # order_events reste exclusivement produit
    # par le trigger PostgreSQL trg_orders_status_event_v1.
    with transaction.atomic():
        return _create_checkout_order(
            user_id=user_id,
            payload=payload,
        )
