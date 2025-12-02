from rest_framework import serializers
from ..models import Trip, AppUser


class F24CommunityTripPreviewSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            "id",
            "title",
            "main_city",
            "main_country",
            "travel_type",
            "start_date",
            "end_date",
            "visibility",
            "owner_name",
        ]

    def get_owner_name(self, obj):
        return getattr(obj.owner, "full_name", "") or obj.owner.email


class F24CommunityTripDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = "__all__"
