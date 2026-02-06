# backend/TripMateFunctions/serializers/f1_4_serializers.py
from rest_framework import serializers


class AdaptivePlanRequestSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    day_id = serializers.IntegerField()
    date = serializers.DateField()

    # optional “apply” flow
    apply_changes = serializers.BooleanField(required=False, default=False)
    apply_opening_hours = serializers.BooleanField(required=False, default=False)
    proposed_item_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        default=list,
    )


class F14AdaptiveChangeSerializer(serializers.Serializer):
    item_id = serializers.IntegerField(required=False)
    action = serializers.ChoiceField(
        choices=[
            "move",
            "replace",
            "add",
            "remove",
            "opening_hours_conflict",
            "opening_hours_warning",
            "opening_hours_missing",
        ],
        required=False,
    )
    reason = serializers.CharField(required=False, allow_blank=True)
    from_time = serializers.CharField(required=False, allow_blank=True)
    to_time = serializers.CharField(required=False, allow_blank=True)
    new_title = serializers.CharField(required=False, allow_blank=True)
    new_destination_id = serializers.IntegerField(required=False)
    new_start_time = serializers.CharField(required=False, allow_blank=True)
    new_end_time = serializers.CharField(required=False, allow_blank=True)
    opening_hours = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    hours_source = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    hours_confidence = serializers.FloatField(required=False, allow_null=True)


class F14ReplacementOptionSerializer(serializers.Serializer):
    title = serializers.CharField()
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    address = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    distance_m = serializers.FloatField(required=False, allow_null=True)
    kinds = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    opening_hours = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_open = serializers.BooleanField(required=False, allow_null=True)
    xid = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    source = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class F14ReplacementSuggestionSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    options = F14ReplacementOptionSerializer(many=True)


class F14AdaptivePlanResponseSerializer(serializers.Serializer):
    applied = serializers.BooleanField()
    weather = serializers.DictField(required=False, allow_null=True)
    is_rainy = serializers.BooleanField(required=False)
    is_bad_weather = serializers.BooleanField(required=False)
    bad_weather_reasons = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )
    reason = serializers.CharField(required=False, allow_blank=True)
    proposed_item_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
    changes = serializers.ListField(
        child=F14AdaptiveChangeSerializer(), required=False, allow_empty=True
    )
    replacement_suggestions = serializers.ListField(
        child=F14ReplacementSuggestionSerializer(), required=False, allow_empty=True
    )


# ✅ aliases so existing views imports keep working
F14AdaptivePlanRequestSerializer = AdaptivePlanRequestSerializer
