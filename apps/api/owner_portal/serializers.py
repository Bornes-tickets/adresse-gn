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