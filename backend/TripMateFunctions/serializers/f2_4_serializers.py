from typing import List, Optional

from rest_framework import serializers

from ..models import (
    Trip,
    TripPhoto,
    ItineraryItemTag,
    TripDay,
    ItineraryItem,
    Profile,
    CommunityFAQ,
)

# -------------------------------------------------------------------
# Helper functions shared by both preview + detail serializers
# -------------------------------------------------------------------


def _owner_name_from_trip(trip: Trip) -> str:
    """
    Prefer Profile.name (profiles table, Profile.id == AppUser.id).
    Fallback to AppUser.full_name, then email.
    """
    owner = getattr(trip, "owner", None)
    if not owner:
        return ""

    # 1) profiles.name
    profile = Profile.objects.filter(id=owner.id).only("name").first()
    if profile and profile.name and str(profile.name).strip():
        return str(profile.name).strip()

    # 2) AppUser.full_name
    full_name = getattr(owner, "full_name", "") or ""
    if full_name.strip():
        return full_name.strip()

    # 3) email fallback
    return owner.email

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
    Gather distinct tags from itinerary_item_tag linked to this trip
    via itinerary_item (item__trip_id).

    IMPORTANT:
    - itinerary_item_tag stores one tag per row (not comma-separated).
    - We DO NOT fallback to Trip.travel_type (user explicitly requested this).
    """
    tag_values = (
        ItineraryItemTag.objects.filter(item__trip_id=trip.id)
        .values_list("tag", flat=True)
        .distinct()
    )

    tags: List[str] = []
    seen = set()

    for t in tag_values:
        if not t:
            continue
        tt = str(t).strip()
        if not tt:
            continue
        key = tt.lower()
        if key in seen:
            continue
        seen.add(key)
        tags.append(tt)

    return tags


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
      - tags (aggregated itinerary tags ONLY)
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
        # No fallback to travel_type; only itinerary_item_tag for this trip
        return _tags_from_trip(obj)

class F24CommunityFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityFAQ
        fields = ["id", "country", "category", "question", "answer"]