# backend/TripMateFunctions/serializers/f1_3_serializers.py
from rest_framework import serializers
from ..models import Trip


class F13AITripPromptSerializer(serializers.Serializer):
    """
    Prompt for AI Trip Generator, e.g.:
      "5 days in Osaka for food & culture"
    """
    prompt = serializers.CharField()
    city = serializers.CharField(required=False, allow_blank=True)
    days = serializers.IntegerField(required=False, min_value=1)
    interests = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )


class F13GeneratedStopSerializer(serializers.Serializer):
    day_index = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    lat = serializers.FloatField(required=False)
    lon = serializers.FloatField(required=False)
    start_time = serializers.CharField(required=False, allow_blank=True)
    end_time = serializers.CharField(required=False, allow_blank=True)


class F13GeneratedItinerarySerializer(serializers.Serializer):
    trip_id = serializers.IntegerField(required=False)
    title = serializers.CharField()
    main_city = serializers.CharField(required=False, allow_blank=True)
    main_country = serializers.CharField(required=False, allow_blank=True)
    days = serializers.IntegerField()
    stops = F13GeneratedStopSerializer(many=True)


class F13AIChatMessageSerializer(serializers.Serializer):
    """
    Chat message inside the AI chatbot, with optional trip context.
    """
    trip_id = serializers.IntegerField(required=False)
    message = serializers.CharField()
