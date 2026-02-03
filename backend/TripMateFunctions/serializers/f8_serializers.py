from rest_framework import serializers
from ..models import AppUser, Trip, DestinationFAQ, DestinationQA, SupportTicket, CommunityFAQ


class F8AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppUser
        fields = ["id", "email", "full_name", "role", "status", "created_at"]


class F8AdminTripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = "__all__"


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

class F8AdminCommunityFAQSerializer(serializers.ModelSerializer):
    """
    Serializer for CommunityFAQ (community_faq table)
    Clean serializer without extra fields
    """
    class Meta:
        model = CommunityFAQ
        fields = [
            'id',
            'country',
            'category',
            'question',
            'answer',
            'is_published',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']