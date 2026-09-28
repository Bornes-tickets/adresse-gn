from __future__ import annotations

from rest_framework import serializers


class PublicTrackingOrderSerializer(serializers.Serializer):
    order_ref = serializers.CharField()
    status = serializers.CharField()
    formule_code = serializers.CharField(
        allow_blank=True,
        allow_null=True,
    )
    formule_label = serializers.CharField(
        allow_blank=True,
        allow_null=True,
    )
    installation_status = serializers.CharField(
        allow_blank=True,
        allow_null=True,
    )
    created_at = serializers.DateTimeField()
