from rest_framework import serializers


class AddressSearchSerializer(serializers.Serializer):
    number = serializers.CharField(
        max_length=32,
        trim_whitespace=True,
        required=True,
        allow_blank=False,
    )


class RouteLogSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(
        choices=(
            "google_maps",
            "waze",
        ),
    )
