from rest_framework import exceptions
from .base_views import BaseViewSet
from ..models import ItineraryItemNote, ItineraryItemTag, TravelDocument, AppUser
from ..serializers.f3_3_serializers import (
    F33ItineraryItemNoteSerializer,
    F33ItineraryItemTagSerializer,
    F33TravelDocumentSerializer,
)


class F33ItineraryItemNoteViewSet(BaseViewSet):
    """
    Endpoints:
      GET  /api/f3/notes/?trip=<tripId>        (all notes for trip)
      GET  /api/f3/notes/?item=<itemId>        (notes for a specific itinerary item)
      POST /api/f3/notes/                      (expects { item, content })
    """
    queryset = ItineraryItemNote.objects.all()
    serializer_class = F33ItineraryItemNoteSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        trip_id = self.request.query_params.get("trip")
        item_id = self.request.query_params.get("item")

        if item_id:
            qs = qs.filter(item_id=item_id)
        elif trip_id:
            qs = qs.filter(item__trip_id=trip_id)

        user = getattr(self.request, "user", None)
        if isinstance(user, AppUser):
            qs = qs.filter(user=user)

        return qs.order_by("-updated_at", "-created_at")

    def perform_create(self, serializer):
        user = getattr(self.request, "user", None)
        if not isinstance(user, AppUser):
            raise exceptions.NotAuthenticated("Login required to create note.")
        serializer.save(user=user)


class F33ItineraryItemTagViewSet(BaseViewSet):
    """
    Endpoints:
      GET  /api/f3/tags/?trip=<tripId>
      GET  /api/f3/tags/?item=<itemId>
      POST /api/f3/tags/  (expects { item, tag })
    """
    queryset = ItineraryItemTag.objects.all()
    serializer_class = F33ItineraryItemTagSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        trip_id = self.request.query_params.get("trip")
        item_id = self.request.query_params.get("item")

        if item_id:
            qs = qs.filter(item_id=item_id)
        elif trip_id:
            qs = qs.filter(item__trip_id=trip_id)

        # no user field in tag model, but you can restrict via item__trip collaborators later
        return qs.order_by("-created_at")


class F33TravelDocumentViewSet(BaseViewSet):
    """
    Endpoints:
      GET  /api/f3/documents/?trip=<tripId>
      POST /api/f3/documents/ (expects { trip, document_type, file_url, ... })
    """
    queryset = TravelDocument.objects.all()
    serializer_class = F33TravelDocumentSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        trip_id = self.request.query_params.get("trip")
        if trip_id:
            qs = qs.filter(trip_id=trip_id)

        user = getattr(self.request, "user", None)
        if isinstance(user, AppUser):
            qs = qs.filter(user=user)

        return qs.order_by("-uploaded_at")

    def perform_create(self, serializer):
        user = getattr(self.request, "user", None)
        if not isinstance(user, AppUser):
            raise exceptions.NotAuthenticated("Login required to upload document.")
        serializer.save(user=user)
