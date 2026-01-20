from rest_framework import generics, filters, pagination, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import connection

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
        qs = (
            Trip.objects.filter(
                visibility="public",
                is_flagged=False,  # ✅ hide flagged trips
            )
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
            Trip.objects.filter(
                visibility="public",
                is_flagged=False,  # ✅ block flagged trip details too
            )
            .select_related("owner")
            .prefetch_related(
                "photos",
                "days__items",
                "items__tags",
            )
        )


class F24SponsoredCountriesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = """
            select country_name
            from community_sponsored
            where is_active = true
            order by country_name asc
        """
        with connection.cursor() as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()

        return Response([r[0] for r in rows])


class F24FlagTripView(APIView):
    """
    POST /api/f2/community/<trip_id>/flag/
    Marks a public trip as flagged.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, trip_id: int):
        # Only allow flagging public trips
        query = """
            update trip
            set is_flagged = true
            where id = %s
              and visibility = 'public'
            returning id, is_flagged
        """

        with connection.cursor() as cursor:
            cursor.execute(query, [trip_id])
            row = cursor.fetchone()

        if not row:
            return Response(
                {"detail": "Trip not found (or not public)."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({"ok": True, "trip_id": row[0], "is_flagged": row[1]})
