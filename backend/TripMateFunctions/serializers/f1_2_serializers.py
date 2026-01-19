# backend/TripMateFunctions/serializers/f1_2_serializers.py
from rest_framework import serializers


class F12RouteOptimizationRequestSerializer(serializers.Serializer):
    """
    Request payload for F1.2 Route Optimization.

    For our current flow we mainly use:
      - trip_id  (required)
      - profile  (optional: driving-car / foot-walking / cycling-regular)

    If you want to support fully generic optimisation later, you can
    still add coordinates in addition to trip_id.
    """
    trip_id = serializers.IntegerField(required=True, help_text="Trip ID to optimise")
    profile = serializers.ChoiceField(
        choices=["driving-car", "foot-walking", "cycling-regular"],
        default="driving-car",
    )


class F12RouteLegSerializer(serializers.Serializer):
    from_id = serializers.IntegerField()
    to_id = serializers.IntegerField()
    distance_km = serializers.FloatField()
    duration_min = serializers.FloatField()


class F12ItemOrderUpdateSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    day = serializers.IntegerField(allow_null=True)
    sort_order = serializers.IntegerField()


class F12RouteOptimizationResponseSerializer(serializers.Serializer):
    """
    Response payload summarising optimised route in terms of itinerary items.
    """
    optimized_order = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="ItineraryItem IDs in optimised order",
    )
    legs = F12RouteLegSerializer(many=True)
    total_distance_km = serializers.FloatField()
    total_duration_min = serializers.FloatField()
    updated_items = F12ItemOrderUpdateSerializer(many=True, required=False)
