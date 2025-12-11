# backend/TripMateFunctions/views/f1_1_views.py
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Trip, TripDay, ItineraryItem
from ..serializers.f1_1_serializers import (
    TripSerializer,
    TripDaySerializer,
    ItineraryItemSerializer,
    TripOverviewSerializer,
)
from .base_views import BaseViewSet


class TripViewSet(BaseViewSet):
    queryset = Trip.objects.all().select_related("owner")
    serializer_class = TripSerializer

    def perform_create(self, serializer):
        """
        Attach owner from request.user (AppUser) if available.
        Adjust this if your BaseViewSet already does something similar.
        """
        user = getattr(self.request, "app_user", None) or getattr(
            self.request, "user", None
        )
        serializer.save(owner=user)

    @action(detail=True, methods=["get"], url_path="overview")
    def overview(self, request, pk=None):
        trip = self.get_object()
        ser = TripOverviewSerializer(trip, context={"request": request})
        return Response(ser.data)


class TripDayViewSet(BaseViewSet):
    """
    Supports:
      - GET /f1/trip-days/?trip=<trip_id>
      - POST /f1/trip-days/     (auto-add next day)
    """
    queryset = TripDay.objects.all().order_by("trip", "day_index")
    serializer_class = TripDaySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            qs = qs.filter(trip_id=trip_id)
        return qs

    def perform_create(self, serializer):
        """
        Auto-append a new day at the end of the trip.
        Rules:
        - day_index = (max existing) + 1
        - date = trip.start_date + (day_index - 1)
        """
        from django.db.models import Max
        from datetime import timedelta
        from django.shortcuts import get_object_or_404

        request = self.request
        trip_id = request.data.get("trip")

        if not trip_id:
            raise ValueError("trip field is required to create a new day")

        trip = get_object_or_404(Trip, pk=trip_id)

        # Determine next day index
        max_index = (
            TripDay.objects.filter(trip=trip)
            .aggregate(Max("day_index"))
            .get("day_index__max") or 0
        )
        next_index = max_index + 1

        # Auto-compute date if trip has a start_date
        date = request.data.get("date")
        if not date and trip.start_date:
            date = trip.start_date + timedelta(days=next_index - 1)

        serializer.save(
            trip=trip,
            day_index=next_index,
            date=date,
        )


class ItineraryItemViewSet(BaseViewSet):
    queryset = ItineraryItem.objects.all()
    serializer_class = ItineraryItemSerializer
