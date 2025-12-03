from rest_framework import serializers


class F22UserPreferenceSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False)
    must_visit = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )
    interests = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )
    days = serializers.IntegerField(required=False, min_value=1)


class F22GroupTripRequestSerializer(serializers.Serializer):
    destination = serializers.CharField()
    preferences = F22UserPreferenceSerializer(many=True)
    trip_length_days = serializers.IntegerField(min_value=1)


class F22GroupTripResponseSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField(required=False)
    title = serializers.CharField()
    days = serializers.IntegerField()
    # You can reuse F13GeneratedStopSerializer if you want
    itinerary = serializers.JSONField()
