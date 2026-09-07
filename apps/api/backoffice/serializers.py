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
