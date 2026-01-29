from rest_framework import generics, filters, pagination, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListAPIView
from django.db import connection

from ..models import (Trip, 
                      CommunityFAQ,
                      )
from ..serializers.f2_4_serializers import (
    F24CommunityTripPreviewSerializer,
    F24CommunityTripDetailSerializer,
    F24CommunityFAQSerializer,
)


class F24CommunityTripPagination(pagination.PageNumberPagination):
    """
    Pagination for community itineraries.
    3 items per page to match the Discovery UI.
    """
    page_size = 3
    page_size_query_param = "page_size"
    max_page_size = 50


class F24CommunityTripListView(generics.ListAPIView):
    """
    F2.4 - List public itineraries for discovery.

    Supports:
      - ?search=<text> across title, main_city, main_country
      - ?main_country=<country name> (eg. 'Singapore')

    Example:
      /api/f2/community/?main_country=Singapore&page=1
    """

    serializer_class = F24CommunityTripPreviewSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ["title", "main_city", "main_country"]
    pagination_class = F24CommunityTripPagination

    def get_queryset(self):
        qs = (
            Trip.objects.filter(
                visibility="public",
                is_flagged=False,
            )
            .select_related("owner")
            .prefetch_related("photos")
        )

        main_country = self.request.query_params.get("main_country")
        if main_country:
            qs = qs.filter(main_country__iexact=main_country.strip())

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
                is_flagged=False,
            )
            .select_related("owner")
            .prefetch_related(
                "photos",
                "days__items",
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
    Marks a public trip as flagged AND stores the flag details.

    Expected JSON body:
      {
        "flag_category": "<string>",
        "flag_reason": "<string>"
      }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, trip_id: int):
        flag_category = request.data.get("flag_category") or request.data.get("category")
        flag_reason = request.data.get("flag_reason") or request.data.get("reason")

        if not flag_category or not str(flag_category).strip():
            return Response(
                {"detail": "flag_category is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not flag_reason or len(str(flag_reason).strip()) < 5:
            return Response(
                {"detail": "flag_reason is required (min 5 characters)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        flag_category = str(flag_category).strip()
        flag_reason = str(flag_reason).strip()

        query = """
            update trip
            set
                is_flagged = true,
                flag_category = %s,
                flag_reason = %s
            where id = %s
              and visibility = 'public'
            returning id, is_flagged, flag_category, flag_reason
        """

        with connection.cursor() as cursor:
            cursor.execute(query, [flag_category, flag_reason, trip_id])
            row = cursor.fetchone()

        if not row:
            return Response(
                {"detail": "Trip not found (or not public)."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            {
                "ok": True,
                "trip_id": row[0],
                "is_flagged": row[1],
                "flag_category": row[2],
                "flag_reason": row[3],
            },
            status=status.HTTP_200_OK,
        )

class F24CommunityFAQListView(ListAPIView):
    serializer_class = F24CommunityFAQSerializer
    permission_classes = [permissions.AllowAny]  # ✅ add this

    def get_queryset(self):
        qs = CommunityFAQ.objects.filter(is_published=True).order_by("country", "category", "id")

        country = self.request.query_params.get("country")
        category = self.request.query_params.get("category")

        if country:
            qs = qs.filter(country__iexact=country)
        if category:
            qs = qs.filter(category__iexact=category)

        return qs