from rest_framework import serializers


class F14AdaptivePlanRequestSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    day_index = serializers.IntegerField()
    apply_changes = serializers.BooleanField(default=False)


class F14AdaptiveChangeSerializer(serializers.Serializer):
    """
    Represents one proposed change to the day plan.
    """
    item_id = serializers.IntegerField(required=False)
    action = serializers.ChoiceField(choices=["move", "replace", "add", "remove"])
    reason = serializers.CharField()
    from_time = serializers.CharField(required=False, allow_blank=True)
    to_time = serializers.CharField(required=False, allow_blank=True)
    new_title = serializers.CharField(required=False, allow_blank=True)
    new_destination_id = serializers.IntegerField(required=False)
    new_start_time = serializers.CharField(required=False, allow_blank=True)
    new_end_time = serializers.CharField(required=False, allow_blank=True)


class F14AdaptivePlanResponseSerializer(serializers.Serializer):
    summary = serializers.CharField()
    changes = F14AdaptiveChangeSerializer(many=True)
