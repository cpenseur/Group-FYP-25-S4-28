# backend/TripMateFunctions/serializers/f1_5_serializers.py
from rest_framework import serializers


class SidebarSuggestionsRequestSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    day_id = serializers.IntegerField()
    current_item_id = serializers.IntegerField(required=False, allow_null=True)


class F15PlaceSerializer(serializers.Serializer):
    place_id = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    lat = serializers.FloatField(required=False, allow_null=True)
    lon = serializers.FloatField(required=False, allow_null=True)
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    source = serializers.CharField(required=False, allow_blank=True)


class F15SuggestionCardSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=["place", "optimization"])
    category = serializers.CharField(required=False, allow_blank=True)
    title = serializers.CharField()
    subtitle = serializers.CharField(required=False, allow_blank=True)
    reason = serializers.CharField(required=False, allow_blank=True)
    actions = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    place = F15PlaceSerializer(required=False)


class F15SidebarResponseSerializer(serializers.Serializer):
    suggestions = F15SuggestionCardSerializer(many=True)
    buckets = serializers.DictField(required=False)
    anchor = serializers.DictField(required=False)
