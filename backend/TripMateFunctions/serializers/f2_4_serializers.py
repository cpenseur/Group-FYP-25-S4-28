from typing import List, Optional

from rest_framework import serializers

from ..models import (
    Trip,
    TripPhoto,
    ItineraryItemTag,
    TripDay,
    ItineraryItem,
)

# -------------------------------------------------------------------
# Helper functions shared by both preview + detail serializers
# -------------------------------------------------------------------


def _owner_name_from_trip(trip: Trip) -> str:
    """
    Prefer the AppUser.full_name if available, otherwise fall back to email.
    """
    owner = getattr(trip, "owner", None)
    if not owner:
        return ""
    full_name = getattr(owner, "full_name", "") or ""
    return full_name or owner.email


def _cover_photo_from_trip(trip: Trip) -> Optional[str]:
    """
    Use the earliest uploaded TripPhoto as the cover photo, if any.
    If the Trip instance already has prefetch_related("photos") applied,
    this will re-use that queryset instead of hitting the DB again.
    """
    photos = getattr(trip, "photos", None)

    if photos is not None and hasattr(photos, "all"):
        photo = photos.all().order_by("created_at").first()
    else:
        photo = TripPhoto.objects.filter(trip=trip).order_by("created_at").first()

    return photo.file_url if photo else None


def _tags_from_trip(trip: Trip) -> List[str]:
    """
    Gather distinct tags from all itinerary items under this trip.

    Primary source:
      - ItineraryItemTag.tag (via item__trip)

    Fallback:
      - split Trip.travel_type by comma, e.g. "City, Food, Walks"
    """
    tag_values = (
        ItineraryItemTag.objects.filter(item__trip=trip)
        .values_list("tag", flat=True)
        .distinct()
    )
    tags = [t for t in tag_values if t]

    if tags:
        return tags

    # Fallback: derive tags from travel_type string
    if trip.travel_type:
        derived = [
            part.strip()
            for part in trip.travel_type.split(",")
            if part.strip()
        ]
        return derived

    return []


# -------------------------------------------------------------------
# Preview serializer for Discovery lists
# -------------------------------------------------------------------


class F24CommunityTripPreviewSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for the Discovery list views.
    Includes:
      - basic trip info
      - owner_name (derived from AppUser)
      - cover_photo_url (earliest TripPhoto)
      - tags (aggregated itinerary tags / travel_type)
    """

    owner_name = serializers.SerializerMethodField()
    cover_photo_url = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            "id",
            "title",
            "main_city",
            "main_country",
            "travel_type",
            "start_date",
            "end_date",
            "visibility",
            "owner_name",
            "cover_photo_url",
            "tags",
        ]

    def get_owner_name(self, obj: Trip) -> str:
        return _owner_name_from_trip(obj)

    def get_cover_photo_url(self, obj: Trip) -> Optional[str]:
        return _cover_photo_from_trip(obj)

    def get_tags(self, obj: Trip) -> List[str]:
        # Limit to 4 for neat UI; frontend also slices, but this keeps payload small.
        return _tags_from_trip(obj)[:4]


# -------------------------------------------------------------------
# Detail serializer with nested days & items (for itinerary page)
# -------------------------------------------------------------------


class F24ItineraryItemSerializer(serializers.ModelSerializer):
    """
    A single stop in the itinerary timeline.
    """

    class Meta:
        model = ItineraryItem
        fields = [
            "id",
            "title",
            "item_type",
            "start_time",
            "end_time",
            "lat",
            "lon",
            "address",
            "notes_summary",
            "sort_order",
        ]


class F24TripDaySerializer(serializers.ModelSerializer):
    """
    Day within a trip, including its ordered items.
    """

    items = F24ItineraryItemSerializer(many=True, read_only=True)

    class Meta:
        model = TripDay
        fields = ["id", "day_index", "date", "note", "items"]


class F24CommunityTripDetailSerializer(serializers.ModelSerializer):
    """
    Full detail for a single community itinerary.

    Includes:
      - all header info used in DiscoveryItineraryDetail
      - owner_name, cover_photo_url, tags
      - nested days[] with items[] (for day-by-day timeline + map)
    """

    owner_name = serializers.SerializerMethodField()
    cover_photo_url = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    days = F24TripDaySerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = [
            "id",
            "title",
            "main_city",
            "main_country",
            "travel_type",
            "start_date",
            "end_date",
            "visibility",
            "owner_name",
            "cover_photo_url",
            "tags",
            "description",
            "days",
        ]

    def get_owner_name(self, obj: Trip) -> str:
        return _owner_name_from_trip(obj)

    def get_cover_photo_url(self, obj: Trip) -> Optional[str]:
        return _cover_photo_from_trip(obj)

    def get_tags(self, obj: Trip) -> List[str]:
        return _tags_from_trip(obj)
