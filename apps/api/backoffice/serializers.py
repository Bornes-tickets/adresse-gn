from rest_framework import serializers


class ClaimDecisionSerializer(
    serializers.Serializer
):
    decision = serializers.ChoiceField(
        choices=[
            "approved",
            "rejected",
        ],
    )

    note = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=500,
    )

class AccountReactivateSerializer(
    serializers.Serializer
):
    confirm = serializers.CharField(max_length=20)

    verification_method = serializers.ChoiceField(
        choices=[
            "email",
            "phone",
            "document",
            "in_person",
            "other",
        ],
    )

    verification_note = serializers.CharField(
        max_length=1000,
        allow_blank=False,
        trim_whitespace=True,
    )

    def validate_confirm(self, value):
        if value != "REACTIVER":
            raise serializers.ValidationError(
                "Saisissez REACTIVER pour confirmer."
            )
        return value



class PhysicalInstallationCompleteSerializer(
    serializers.Serializer
):
    agent_id = serializers.UUIDField()

    gps_lat = serializers.FloatField(
        min_value=-90,
        max_value=90,
    )

    gps_lng = serializers.FloatField(
        min_value=-180,
        max_value=180,
    )

    accuracy_m = serializers.FloatField(
        required=False,
        allow_null=True,
        min_value=0,
    )

    photo_url = serializers.URLField(
        required=False,
        allow_null=True,
        allow_blank=True,
        max_length=2048,
    )


class InstallationUninstallSerializer(
    serializers.Serializer
):
    agent_id = serializers.UUIDField()

    reason = serializers.CharField(
        max_length=1000,
        allow_blank=False,
        trim_whitespace=True,
    )

    photo_url = serializers.URLField(
        required=False,
        allow_null=True,
        allow_blank=True,
        max_length=2048,
    )
