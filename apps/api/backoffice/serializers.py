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