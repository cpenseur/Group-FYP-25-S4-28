# backend/TripMateFunctions/serializers/f1_3_serializers.py
from rest_framework import serializers

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
    trip_id = serializers.IntegerField(required=False)
    message = serializers.CharField()
    history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True,
    )

    # Optional trip context from the frontend (avoids backend DB lookups)
    trip_context = serializers.DictField(required=False)

# ---- NEW (Solo AI Trip Generator request) ----
class F13SoloTripGenerateRequestSerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    duration_days = serializers.IntegerField(required=True, min_value=1)

    activities = serializers.ListField(child=serializers.CharField(), allow_empty=True, required=False)
    destination_types = serializers.ListField(child=serializers.CharField(), allow_empty=True, required=False)

    budget_min = serializers.DecimalField(
        required=False,
        allow_null=True,
        min_value=0,
        max_digits=12,
        decimal_places=2,
    )
    budget_max = serializers.DecimalField(required=False, allow_null=True, max_digits=12, decimal_places=2)

    additional_info = serializers.CharField(required=False, allow_blank=True)
    preferences_text = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        acts = attrs.get("activities") or []
        dests = attrs.get("destination_types") or []
        bmin = attrs.get("budget_min")
        bmax = attrs.get("budget_max")
        if len(acts) < 2:
            raise serializers.ValidationError({"activities": "Select at least two options."})
        if len(dests) < 2:
            raise serializers.ValidationError({"destination_types": "Select at least two options."})
        if bmin is not None and bmax is not None and bmin > bmax:
            raise serializers.ValidationError({
                "budget_min": "Minimum budget cannot exceed maximum budget."
            })
        
        return attrs

class F13SoloTripGenerateResponseSerializer(serializers.Serializer):
    trip_id = serializers.UUIDField()
