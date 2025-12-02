from rest_framework import generics, filters
from ..models import Trip
from ..serializers.f2_4_serializers import (
    F24CommunityTripPreviewSerializer,
    F24CommunityTripDetailSerializer,
)


class F24CommunityTripListView(generics.ListAPIView):
    """
    F2.4 - List public itineraries for discovery.
    """
    serializer_class = F24CommunityTripPreviewSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "main_city", "main_country", "travel_type"]

    def get_queryset(self):
        return Trip.objects.filter(visibility="public").select_related("owner")


class F24CommunityTripDetailView(generics.RetrieveAPIView):
    """
    F2.4 - Read-only detail view for a community itinerary.
    """
    queryset = Trip.objects.filter(visibility="public")
    serializer_class = F24CommunityTripDetailSerializer
    lookup_field = "pk"
