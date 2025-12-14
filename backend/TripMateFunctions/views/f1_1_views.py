from ..models import Trip, TripDay, ItineraryItem
from ..serializers.f1_1_serializers import (
    TripSerializer,
    TripDaySerializer,
    ItineraryItemSerializer,
)
from .base_views import BaseViewSet


class TripViewSet(BaseViewSet):
    queryset = Trip.objects.all().select_related("owner")
    serializer_class = TripSerializer


class TripDayViewSet(BaseViewSet):
    queryset = TripDay.objects.all()
    serializer_class = TripDaySerializer


class ItineraryItemViewSet(BaseViewSet):
    queryset = ItineraryItem.objects.all()
    serializer_class = ItineraryItemSerializer
