from rest_framework import serializers
from ..models import TripShareLink


class F23TripShareLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripShareLink
        fields = ["id", "trip", "token", "permission", "expires_at", "is_active"]


class F23CreateShareLinkSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    permission = serializers.ChoiceField(choices=["view", "edit"], default="view")
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
