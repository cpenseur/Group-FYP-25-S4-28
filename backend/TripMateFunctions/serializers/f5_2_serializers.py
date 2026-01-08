from rest_framework import serializers
from ..models import TripMediaHighlight, TripHistoryEntry, AppUser


class F52TripMediaHighlightSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = TripMediaHighlight
        fields = ["id", "trip", "user", "title", "video_url", "metadata", "created_at"]
        read_only_fields = ["id", "user", "created_at"] 

class F52TripHistoryEntrySerializer(serializers.ModelSerializer):

    class Meta:
        model = TripHistoryEntry
        fields = ["id", "user", "trip", "media_highlight", "summary", "created_at"]
        read_only_fields = ["id", "user", "created_at"]  