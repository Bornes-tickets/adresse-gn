from __future__ import annotations

from rest_framework import serializers


class PublicTrackingOrderSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    order_ref = serializers.CharField()
    status = serializers.CharField()
    client_type = serializers.CharField(allow_blank=True, allow_null=True)
    full_name = serializers.CharField(allow_blank=True, allow_null=True)
    phone = serializers.CharField(allow_blank=True, allow_null=True)
    address_line = serializers.CharField(allow_blank=True, allow_null=True)
    quartier = serializers.CharField(allow_blank=True, allow_null=True)
    formule_code = serializers.CharField(allow_blank=True, allow_null=True)
    formule_label = serializers.CharField(allow_blank=True, allow_null=True)
    prix_ttc = serializers.IntegerField()
    payment_method = serializers.CharField(allow_blank=True, allow_null=True)
    devis_demande = serializers.BooleanField()
    fulfillment_kind = serializers.CharField()
    installation_status = serializers.CharField(allow_blank=True, allow_null=True)
    created_at = serializers.DateTimeField()
