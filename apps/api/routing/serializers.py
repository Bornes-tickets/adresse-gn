from rest_framework import serializers


MAX_BIGINT = 9223372036854775807


class StateToStateRouteSerializer(
    serializers.Serializer
):
    start_state_id = serializers.IntegerField(
        min_value=0,
        max_value=MAX_BIGINT,
        required=True,
    )

    end_state_id = serializers.IntegerField(
        min_value=0,
        max_value=MAX_BIGINT,
        required=True,
    )