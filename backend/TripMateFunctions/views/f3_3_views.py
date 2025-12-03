from .base_views import BaseViewSet
from ..models import ItineraryItemNote, ItineraryItemTag, TravelDocument
from ..serializers.f3_3_serializers import (
    F33ItineraryItemNoteSerializer,
    F33ItineraryItemTagSerializer,
    F33TravelDocumentSerializer,
)


class F33ItineraryItemNoteViewSet(BaseViewSet):
    queryset = ItineraryItemNote.objects.all()
    serializer_class = F33ItineraryItemNoteSerializer


class F33ItineraryItemTagViewSet(BaseViewSet):
    queryset = ItineraryItemTag.objects.all()
    serializer_class = F33ItineraryItemTagSerializer


class F33TravelDocumentViewSet(BaseViewSet):
    queryset = TravelDocument.objects.all()
    serializer_class = F33TravelDocumentSerializer
