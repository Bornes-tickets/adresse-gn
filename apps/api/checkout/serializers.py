from __future__ import annotations

from rest_framework import serializers

from .contracts import (
    normalize_client_type,
    normalize_payment_method,
    normalize_submission_channel,
)


class CheckoutOrderCreateSerializer(serializers.Serializer):
    plan_code = serializers.CharField(max_length=100, trim_whitespace=False)
    client_type = serializers.CharField(max_length=40, trim_whitespace=False)
    full_name = serializers.CharField(max_length=200, trim_whitespace=False)
    email = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=320,
        trim_whitespace=False,
    )
    payment_method = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=80,
        trim_whitespace=False,
    )
    place_type = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        default="other",
        max_length=80,
        trim_whitespace=False,
    )
    place_name = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=200,
        trim_whitespace=False,
    )
    lat = serializers.FloatField(
        required=False,
        allow_null=True,
        min_value=-90,
        max_value=90,
    )
    lng = serializers.FloatField(
        required=False,
        allow_null=True,
        min_value=-180,
        max_value=180,
    )
    accuracy_m = serializers.FloatField(required=False, allow_null=True)
    commune_id = serializers.UUIDField(required=False, allow_null=True)
    district_id = serializers.UUIDField(required=False, allow_null=True)
    sector_id = serializers.UUIDField(required=False, allow_null=True)
    address_line = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=500,
        trim_whitespace=False,
    )
    access_point_note = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=1000,
        trim_whitespace=False,
    )
    devis_demande = serializers.BooleanField(
        required=False,
        default=False,
    )
    submission_channel = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        default="web",
        max_length=40,
        trim_whitespace=False,
    )

    def validate_client_type(self, value):
        try:
            return normalize_client_type(value)
        except ValueError as exc:
            raise serializers.ValidationError(
                "Type de client invalide."
            ) from exc

    def validate_payment_method(self, value):
        return normalize_payment_method(value)

    def validate_submission_channel(self, value):
        return normalize_submission_channel(value)

    def validate_full_name(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Le nom complet est obligatoire."
            )
        return value

    def validate(self, attrs):
        lat = attrs.get("lat")
        lng = attrs.get("lng")

        if (lat is None) != (lng is None):
            raise serializers.ValidationError(
                {
                    "location": (
                        "Latitude et longitude doivent "
                        "être fournies ensemble."
                    ),
                }
            )

        return attrs


class CheckoutOrderCreatedSerializer(serializers.Serializer):
    order_id = serializers.UUIDField()
    order_ref = serializers.CharField()
