from rest_framework import generics, filters, pagination, permissions
from ..models import Trip
from ..serializers.f2_4_serializers import (
    F24CommunityTripPreviewSerializer,
    F24CommunityTripDetailSerializer,
)


class F24CommunityTripPagination(pagination.PageNumberPagination):
    """
    Pagination for community itineraries.
    3 items per page to match the Discovery UI.
    """

    page_size = 3
    page_size_query_param = "page_size"  # optional override
    max_page_size = 50


class F24CommunityTripListView(generics.ListAPIView):
    """
    F2.4 - List public itineraries for discovery.

    Supports:
      - ?search=<text> across title, main_city, main_country, travel_type
      - ?main_country=<country name> (eg. 'Singapore')

    Example:
      /api/f2/community/?main_country=Singapore&page=1
    """

    serializer_class = F24CommunityTripPreviewSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "main_city", "main_country", "travel_type"]
    pagination_class = F24CommunityTripPagination

    def get_queryset(self):
        # Only public trips; demo + real users are allowed.
        qs = (
            Trip.objects.filter(visibility="public")
            .select_related("owner")
            .prefetch_related(
                "photos",      # used for cover photo
                "items__tags", # used for aggregated tags
            )
        )

        params = self.request.query_params
        main_country = params.get("main_country")
        if main_country:
            qs = qs.filter(main_country__iexact=main_country)

        # You can add more filters (main_city, travel_type) later if needed.
        return qs.order_by("-created_at")


class F24CommunityTripDetailView(generics.RetrieveAPIView):
    """
    F2.4 - Read-only detail view for a community itinerary.

    Returns a Trip with:
      - owner_name, cover_photo_url, tags
      - nested days[] with items[] for day-by-day timeline and map
    """

    serializer_class = F24CommunityTripDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "pk"

    def get_queryset(self):
        return (
            Trip.objects.filter(visibility="public")
            .select_related("owner")
            .prefetch_related(
                "photos",          # Trip.photos for cover image
                "days__items",     # TripDay.items for timeline
                "items__tags",     # ItineraryItem.tags for aggregated tags
            )
        )
