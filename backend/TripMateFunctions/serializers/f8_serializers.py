from rest_framework import serializers
from ..models import AppUser, Trip, DestinationFAQ, DestinationQA, SupportTicket, CommunityFAQ, GeneralFAQ


class F8AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppUser
        fields = ["id", "email", "full_name", "role", "status", "created_at"]


class F8AdminTripSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True)

    class Meta:
        model = Trip
        fields = "__all__"

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["owner_email"] = instance.owner.email if instance.owner else None
        return data


class F8AdminDestinationFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = DestinationFAQ
        fields = "__all__"


class F8AdminDestinationQASerializer(serializers.ModelSerializer):
    class Meta:
        model = DestinationQA
        fields = "__all__"


class F8SupportTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = "__all__"


class F8CommunityFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityFAQ
        fields = "__all__"


class F8GeneralFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeneralFAQ
        fields = "__all__"
