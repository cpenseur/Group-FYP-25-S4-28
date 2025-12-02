from .base_views import BaseViewSet
from ..models import TripMediaHighlight, TripHistoryEntry
from ..serializers.f5_2_serializers import (
    F52TripMediaHighlightSerializer,
    F52TripHistoryEntrySerializer,
)


class F52TripMediaHighlightViewSet(BaseViewSet):
    queryset = TripMediaHighlight.objects.all()
    serializer_class = F52TripMediaHighlightSerializer


class F52TripHistoryEntryViewSet(BaseViewSet):
    queryset = TripHistoryEntry.objects.all()
    serializer_class = F52TripHistoryEntrySerializer
