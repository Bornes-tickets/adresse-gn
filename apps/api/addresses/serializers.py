from rest_framework import serializers


REPORT_REASONS = (
    "wrong_location",
    "closed",
    "damaged_beacon",
    "other",
)


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


class AddressReportSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(
        choices=REPORT_REASONS,
    )

    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=True,
    )