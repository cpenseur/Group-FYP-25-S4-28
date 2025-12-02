from rest_framework import serializers
from ..models import Trip, TripDay, ItineraryItem


class TripDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = TripDay
        fields = ["id", "trip", "date", "day_index", "note"]


class ItineraryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItineraryItem
        fields = [
            "id",
            "trip",
            "day",
            "destination",
            "title",
            "item_type",
            "start_time",
            "end_time",
            "lat",
            "lon",
            "address",
            "notes_summary",
            "cost_amount",
            "cost_currency",
            "booking_reference",
            "is_all_day",
            "sort_order",
        ]


class TripSerializer(serializers.ModelSerializer):
    days = TripDaySerializer(many=True, read_only=True)
    items = ItineraryItemSerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = [
            "id",
            "owner",
            "title",
            "main_city",
            "main_country",
            "visibility",
            "start_date",
            "end_date",
            "description",
            "travel_type",
            "is_demo",
            "created_at",
            "updated_at",
            "days",
            "items",
        ]
