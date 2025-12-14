from rest_framework import serializers


class F12RouteOptimizationRequestSerializer(serializers.Serializer):
    """
    Request payload for F1.2 Route Optimization
    """
    trip_id = serializers.IntegerField(required=False, help_text="Optional Trip ID")
    coordinates = serializers.ListField(
        child=serializers.DictField(
            child=serializers.FloatField(),
        ),
        help_text='List of {"lat": float, "lon": float}',
    )
    profile = serializers.ChoiceField(
        choices=["driving-car", "foot-walking", "cycling-regular"],
        default="driving-car",
    )


class F12RouteLegSerializer(serializers.Serializer):
    index = serializers.IntegerField()
    lat = serializers.FloatField()
    lon = serializers.FloatField()
    distance_m = serializers.FloatField()
    duration_s = serializers.FloatField()


class F12RouteOptimizationResponseSerializer(serializers.Serializer):
    """
    Response payload summarising optimized route.
    """
    total_distance_m = serializers.FloatField()
    total_duration_s = serializers.FloatField()
    legs = F12RouteLegSerializer(many=True)
