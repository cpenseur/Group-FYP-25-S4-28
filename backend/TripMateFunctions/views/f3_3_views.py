from django.db.models import Q
from rest_framework import exceptions
from .base_views import BaseViewSet
from ..models import (
    ItineraryItemNote,
    ItineraryItemTag,
    TravelDocument,
    AppUser,
    Trip,
    TripCollaborator,
    ItineraryItem,
)
from ..serializers.f3_3_serializers import (
    F33ItineraryItemNoteSerializer,
    F33ItineraryItemTagSerializer,
    F33TravelDocumentSerializer,
)

def get_app_user(request) -> AppUser:
    u = getattr(request, "user", None)
    if not u or not getattr(u, "is_authenticated", False):
        raise exceptions.NotAuthenticated("Login required.")

    # Case 1: auth already returns AppUser
    if isinstance(u, AppUser):
        return u

    # Case 2: auth returns Django User or something else with email/id
    email = getattr(u, "email", None)
    if email:
        try:
            return AppUser.objects.get(email=email)
        except AppUser.DoesNotExist:
            raise exceptions.NotAuthenticated("No matching AppUser for this login.")

    # If you want to support mapping by id, add it here (only if ids match)
    raise exceptions.NotAuthenticated("Cannot resolve AppUser from request.user.")

def _user_can_access_trip(user: AppUser, trip: Trip) -> bool:
    if not user:
        return False
    if trip.owner_id == user.id:
        return True
    return TripCollaborator.objects.filter(
        trip=trip,
        user=user,
        status=TripCollaborator.Status.ACTIVE,
    ).exists()



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
        qs = super().get_queryset().select_related("item", "item__trip")

        trip_id = self.request.query_params.get("trip")
        item_id = self.request.query_params.get("item")

        user = get_app_user(self.request)
        if not isinstance(user, AppUser):
            # if your app expects login for this page, block it
            raise exceptions.NotAuthenticated("Login required.")

        # If item is provided, validate trip access using that item
        if item_id:
            try:
                item = ItineraryItem.objects.select_related("trip").get(id=item_id)
            except ItineraryItem.DoesNotExist:
                raise exceptions.ValidationError({"item": "Itinerary item not found"})

            if not _user_can_access_trip(user, item.trip):
                raise exceptions.PermissionDenied("No access to this trip.")

            qs = qs.filter(item_id=item_id)

        # If trip is provided, validate trip access
        elif trip_id:
            try:
                trip = Trip.objects.get(id=trip_id)
            except Trip.DoesNotExist:
                raise exceptions.ValidationError({"trip": "Trip not found"})

            if not _user_can_access_trip(user, trip):
                raise exceptions.PermissionDenied("No access to this trip.")

            qs = qs.filter(item__trip_id=trip_id)

        # If neither trip nor item is provided, only return notes for trips the user can access
        else:
            qs = qs.filter(
                Q(item__trip__owner_id=user.id)
                | Q(
                    item__trip__collaborators__user_id=user.id,
                    item__trip__collaborators__status=TripCollaborator.Status.ACTIVE,
                )
            ).distinct()

        return qs.order_by("-updated_at", "-created_at")

    def perform_create(self, serializer):
        user = get_app_user(self.request)
        if not isinstance(user, AppUser):
            raise exceptions.NotAuthenticated("Login required to create note.")

        item = serializer.validated_data.get("item")
        if not item:
            raise exceptions.ValidationError({"item": "Item is required."})

        trip = getattr(item, "trip", None)
        if not trip or not _user_can_access_trip(user, trip):
            raise exceptions.PermissionDenied("No access to this trip.")

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

        user = get_app_user(self.request)
        if isinstance(user, AppUser):
            qs = qs.filter(user=user)

        return qs.order_by("-uploaded_at")

    def perform_create(self, serializer):
        user = get_app_user(self.request)
        if not isinstance(user, AppUser):
            raise exceptions.NotAuthenticated("Login required to upload document.")
        serializer.save(user=user)
