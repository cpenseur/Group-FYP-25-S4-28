# backend/TripMateFunctions/serializers/f1_5_serializers.py
"""
F1.5 - AI Recommendations System Serializers

This file contains all serializers for:
- F1.5a: AI Recommendations Sidebar
- F1.5b: Recommendations Page
"""

from rest_framework import serializers


# ============================================================================
# F1.5a - Sidebar Serializers
# ============================================================================

class F15SidebarContextSerializer(serializers.Serializer):
    """
    Input serializer for sidebar suggestions request.
    
    Request body:
    {
        "trip_id": 123,
        "day_index": 1,  // optional
        "current_item_id": 456  // optional
    }
    """
    trip_id = serializers.IntegerField(required=True)
    day_index = serializers.IntegerField(required=False, allow_null=True)
    current_item_id = serializers.IntegerField(required=False, allow_null=True)


class F15SuggestionSerializer(serializers.Serializer):
    """
    Single suggestion card format.
    
    Categories:
    - Nearby: Places near current locations
    - Food: Restaurant and meal recommendations
    - Culture: Museums, temples, cultural sites
    - Optimization: Route and planning suggestions
    - Other: Miscellaneous suggestions
    
    Action Types:
    - add: Add new item to itinerary
    - replace: Replace existing item
    - view_on_map: Just show on map
    """
    suggestion_id = serializers.CharField(max_length=255)
    category = serializers.ChoiceField(
        choices=["Nearby", "Food", "Culture", "Optimization", "Other"]
    )
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(max_length=500)
    destination_id = serializers.IntegerField(required=False, allow_null=True)
    lat = serializers.FloatField(required=False, allow_null=True)
    lon = serializers.FloatField(required=False, allow_null=True)
    action_type = serializers.ChoiceField(
        choices=["add", "replace", "view_on_map"]
    )
    place = F15PlaceSerializer(required=False)


class F15SidebarResponseSerializer(serializers.Serializer):
    """
    Response format for sidebar suggestions.
    
    Response:
    {
        "suggestions": [
            {
                "suggestion_id": "...",
                "category": "Nearby",
                "title": "Visit Senso-ji Temple",
                "description": "Historic Buddhist temple...",
                "lat": 35.7148,
                "lon": 139.7967,
                "action_type": "add"
            },
            ...
        ],
        "cached": false
    }
    """
    suggestions = F15SuggestionSerializer(many=True)
    cached = serializers.BooleanField(default=False)


# ============================================================================
# F1.5b - Recommendations Page Serializers
# ============================================================================

class DestinationInfoSerializer(serializers.Serializer):
    """
    Destination information response format.
    
    Used by: GET /f1/recommendations/destination-info/?destination=Tokyo
    
    Response:
    {
        "destination": "Tokyo",
        "description": "Tokyo is...",
        "best_time": "March-May, September-November",
        "avg_budget": "$100-150 per day",
        "popular_activities": ["Sightseeing", "Food Tours", ...],
        "fun_facts": ["Tokyo has...", ...],
        "lat": 35.6762,
        "lon": 139.6503
    }
    """
    destination = serializers.CharField(max_length=255)
    description = serializers.CharField()
    best_time = serializers.CharField(max_length=255, required=False)
    avg_budget = serializers.CharField(max_length=255, required=False)
    popular_activities = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False
    )
    fun_facts = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
    lat = serializers.FloatField(required=False, allow_null=True)
    lon = serializers.FloatField(required=False, allow_null=True)


class GuideSerializer(serializers.Serializer):
    """
    Travel guide card format.
    
    Used by: GET /f1/recommendations/featured-guides/?destination=Tokyo&limit=6
    
    Response:
    {
        "guides": [
            {
                "id": "123",
                "title": "10-Day Tokyo Winter Itinerary",
                "author": "TravelExpert",
                "author_avatar": "https://...",
                "thumbnail": "https://...",
                "destination": "Tokyo",
                "days": 10,
                "views": 15234,
                "saves": 456,
                "verified": true,
                "year": "2025"
            },
            ...
        ]
    }
    """
    id = serializers.CharField(max_length=255)
    title = serializers.CharField(max_length=255)
    author = serializers.CharField(max_length=255)
    author_avatar = serializers.URLField(required=False, allow_null=True)
    thumbnail = serializers.URLField()
    destination = serializers.CharField(max_length=255)
    days = serializers.IntegerField()
    views = serializers.IntegerField()
    saves = serializers.IntegerField()
    verified = serializers.BooleanField()
    year = serializers.CharField(max_length=4, required=False, allow_null=True)


class DestinationCardSerializer(serializers.Serializer):
    """
    Destination card format.
    
    Used by: GET /f1/recommendations/popular-destinations/?destination=Tokyo&limit=6
    
    Response:
    {
        "destinations": [
            {
                "id": "456",
                "title": "Kyoto",
                "description": "Ancient capital with...",
                "thumbnail": "https://...",
                "saved": false,
                "category": "Nearby",
                "country": "Japan"
            },
            ...
        ]
    }
    """
    id = serializers.CharField(max_length=255)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField()
    thumbnail = serializers.URLField()
    saved = serializers.BooleanField()
    category = serializers.ChoiceField(choices=["Nearby", "Popular"])
    country = serializers.CharField(max_length=255)


class SaveActionSerializer(serializers.Serializer):
    """
    Save/Unsave action request format.
    
    Used by:
    - POST /f1/recommendations/save-guide/
    - POST /f1/recommendations/unsave-guide/
    - POST /f1/recommendations/save-destination/
    - POST /f1/recommendations/unsave-destination/
    
    Request body:
    {
        "guide_id": "123"  // OR
        "destination_id": "456"
    }
    
    One of guide_id or destination_id is required.
    """
    guide_id = serializers.CharField(max_length=255, required=False)
    destination_id = serializers.CharField(max_length=255, required=False)

    def validate(self, data):
        """Ensure at least one ID is provided"""
        if not data.get('guide_id') and not data.get('destination_id'):
            raise serializers.ValidationError(
                "Either guide_id or destination_id is required"
            )
        return data


# ============================================================================
# Response Wrappers
# ============================================================================

class GuideListResponseSerializer(serializers.Serializer):
    """Wrapper for guide list response"""
    guides = GuideSerializer(many=True)


class DestinationListResponseSerializer(serializers.Serializer):
    """Wrapper for destination list response"""
    destinations = DestinationCardSerializer(many=True)


class SaveResponseSerializer(serializers.Serializer):
    """Standard response for save/unsave actions"""
    success = serializers.BooleanField()
    created = serializers.BooleanField(required=False)
    guide_id = serializers.CharField(max_length=255, required=False)
    destination_id = serializers.CharField(max_length=255, required=False)
