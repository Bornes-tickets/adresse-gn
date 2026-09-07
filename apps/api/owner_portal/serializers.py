from rest_framework import serializers


ADDRESS_CATEGORIES = [
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
]


class OwnerBeaconUpdateSerializer(
    serializers.Serializer
):
    name = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=120,
    )

    category = serializers.ChoiceField(
        choices=ADDRESS_CATEGORIES,
    )

    visibility = serializers.ChoiceField(
        choices=[
            "public",
            "private",
        ],
    )

    access_point_note = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=400,
    )


class OwnerMovingReportSerializer(
    serializers.Serializer
):
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=1000,
    )


class OwnerFavoriteCreateSerializer(
    serializers.Serializer
):
    number = serializers.CharField(
        max_length=32,
    )

    alias = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=80,
    )


class OwnerFavoriteUpdateSerializer(
    serializers.Serializer
):
    alias = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=80,
    )



class OwnerProfileUpdateSerializer(
    serializers.Serializer
):
    full_name = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=120,
    )

    phone = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=30,
    )

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "Aucune modification fournie."
            )

        return attrs


class OwnerAccountDeactivateSerializer(
    serializers.Serializer
):
    confirm = serializers.CharField(
        max_length=20,
    )

    def validate_confirm(self, value):
        if value != "DESACTIVER":
            raise serializers.ValidationError(
                "Saisissez DESACTIVER pour confirmer."
            )

        return value
