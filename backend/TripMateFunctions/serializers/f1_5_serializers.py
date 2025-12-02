from rest_framework import serializers


class F15SidebarContextSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    day_index = serializers.IntegerField(required=False)
    current_item_id = serializers.IntegerField(required=False)
    # Optional: include a light snapshot of items, tags, time gaps if needed.


class F15SuggestionSerializer(serializers.Serializer):
    """
    One suggestion card in the sidebar.
    """
    suggestion_id = serializers.CharField()
    category = serializers.ChoiceField(
        choices=["Nearby", "Food", "Culture", "Optimization", "Other"]
    )
    title = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    destination_id = serializers.IntegerField(required=False)
    lat = serializers.FloatField(required=False)
    lon = serializers.FloatField(required=False)
    action_type = serializers.ChoiceField(
        choices=["add", "replace", "view_on_map"], default="add"
    )


class F15SidebarResponseSerializer(serializers.Serializer):
    suggestions = F15SuggestionSerializer(many=True)
    cached = serializers.BooleanField(default=False)
