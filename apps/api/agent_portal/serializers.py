from __future__ import annotations

import base64
import binascii
import math

from rest_framework import serializers


AGENT_GPS_MEASURE_COUNT = 3
AGENT_GPS_MAX_ACCURACY_M = 3.0

INSTALLATION_PHOTO_MAX_BYTES = (
    500 * 1024
)

INSTALLATION_PHOTO_PREFIX = (
    "data:image/jpeg;base64,"
)

INSTALLATION_PHOTO_MAX_BASE64_CHARS = (
    (
        (
            INSTALLATION_PHOTO_MAX_BYTES
            + 2
        )
        // 3
    )
    * 4
)

INSTALLATION_PHOTO_MAX_INPUT_CHARS = (
    len(
        INSTALLATION_PHOTO_PREFIX
    )
    + INSTALLATION_PHOTO_MAX_BASE64_CHARS
)


ADDRESS_CATEGORY_CHOICES = (
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
)


class StrictSerializer(
    serializers.Serializer
):
    """
    Reject unknown client fields instead of silently
    ignoring them.

    This is important for authority-bearing fields:
    agent_id, beacon_id, order_id, sequence_no, etc.
    """

    def to_internal_value(
        self,
        data,
    ):
        if hasattr(
            data,
            "keys",
        ):
            unknown = sorted(
                set(
                    data.keys()
                )
                - set(
                    self.fields.keys()
                )
            )

            if unknown:
                raise serializers.ValidationError(
                    {
                        key: [
                            (
                                "Champ non autoris? "
                                "dans le contrat Agent V1."
                            )
                        ]
                        for key in unknown
                    }
                )

        return super().to_internal_value(
            data
        )


class AgentGpsMeasureSerializer(
    StrictSerializer
):
    lat = serializers.FloatField(
        min_value=-90.0,
        max_value=90.0,
    )

    lng = serializers.FloatField(
        min_value=-180.0,
        max_value=180.0,
    )

    accuracy_m = serializers.FloatField(
        min_value=0.0,
        max_value=(
            AGENT_GPS_MAX_ACCURACY_M
        ),
    )

    taken_at = serializers.DateTimeField()


    def validate(
        self,
        attrs,
    ):
        for field in (
            "lat",
            "lng",
            "accuracy_m",
        ):
            value = float(
                attrs[field]
            )

            if not math.isfinite(
                value
            ):
                raise serializers.ValidationError(
                    {
                        field: (
                            "Valeur num?rique "
                            "non finie interdite."
                        )
                    }
                )

        return attrs


class AgentTaskCompleteSerializer(
    StrictSerializer
):
    """
    Syntactic transport contract for Agent GPS V1.

    Business authority remains server-side:
    - authenticated Agent identity
    - paid order
    - immutable purchase snapshot
    - assigned pending task
    - beacon/site consistency
    - plan-specific field requirements

    Those checks belong to the transactional
    completion service implemented in P3-P1-B.
    """

    client_uuid = serializers.UUIDField(
        required=True,
    )

    measures = AgentGpsMeasureSerializer(
        many=True,
        required=True,
    )

    photo_base64 = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=False,
        max_length=(
            INSTALLATION_PHOTO_MAX_INPUT_CHARS
        ),
    )

    category = serializers.ChoiceField(
        choices=ADDRESS_CATEGORY_CHOICES,
        required=True,
    )

    # Syntactically optional here.
    # P3-P1-B enforces purchase/category semantics.
    name = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=False,
        trim_whitespace=True,
        max_length=160,
    )

    # Agent completion never publishes an address.
    # Public visibility is owned by the publication workflow.
    visibility = serializers.ChoiceField(
        choices=(
            "private",
        ),
        required=True,
    )

    # Optional syntactically.
    # Premium purchase snapshot may make it mandatory.
    access_point_note = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=False,
        trim_whitespace=True,
        max_length=500,
    )

    owner_name = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=False,
        trim_whitespace=True,
        max_length=160,
    )

    owner_phone = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=False,
        trim_whitespace=True,
        max_length=40,
    )

    consent = serializers.BooleanField(
        required=True,
    )


    def validate_photo_base64(
        self,
        value: str,
    ) -> str:
        if not value.startswith(
            INSTALLATION_PHOTO_PREFIX
        ):
            raise serializers.ValidationError(
                (
                    "La photo Agent V1 doit ?tre "
                    "un data URL JPEG base64."
                )
            )

        encoded = value[
            len(
                INSTALLATION_PHOTO_PREFIX
            ):
        ]

        if not encoded:
            raise serializers.ValidationError(
                "Photo vide."
            )

        try:
            raw = base64.b64decode(
                encoded,
                validate=True,
            )
        except (
            binascii.Error,
            ValueError,
        ) as exc:
            raise serializers.ValidationError(
                "Photo base64 invalide."
            ) from exc

        if not raw:
            raise serializers.ValidationError(
                "Photo vide."
            )

        if len(
            raw
        ) > INSTALLATION_PHOTO_MAX_BYTES:
            raise serializers.ValidationError(
                (
                    "La photo d?passe la limite "
                    "Agent V1 de 500 Kio."
                )
            )

        if not raw.startswith(
            b"\xff\xd8"
        ):
            raise serializers.ValidationError(
                "Le contenu photo n'est pas un JPEG."
            )

        return value


    def validate(
        self,
        attrs,
    ):
        measures = attrs.get(
            "measures"
        ) or []

        if len(
            measures
        ) != AGENT_GPS_MEASURE_COUNT:
            raise serializers.ValidationError(
                {
                    "measures": (
                        "Exactement trois mesures "
                        "GPS sont requises."
                    )
                }
            )

        if attrs.get(
            "consent"
        ) is not True:
            raise serializers.ValidationError(
                {
                    "consent": (
                        "Le consentement est "
                        "obligatoire."
                    )
                }
            )

        return attrs
