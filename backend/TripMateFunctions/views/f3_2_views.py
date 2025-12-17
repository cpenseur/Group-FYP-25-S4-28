from django.db.models import Q
from rest_framework import viewsets, exceptions
from rest_framework.exceptions import PermissionDenied, ValidationError
from ..models import Checklist, ChecklistItem, Trip, TripCollaborator, AppUser
from ..serializers.f3_2_serializers import F32ChecklistSerializer, F32ChecklistItemSerializer

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

def _user_can_access_trip(user, trip: Trip) -> bool:
    if not user:
        return False
    if trip.owner_id == user.id:
        return True
    return TripCollaborator.objects.filter(
        trip=trip,
        user=user,
        status=TripCollaborator.Status.ACTIVE,
    ).exists()


class F32ChecklistViewSet(viewsets.ModelViewSet):
    serializer_class = F32ChecklistSerializer
    queryset = Checklist.objects.all()

    def get_queryset(self):
        user = get_app_user(self.request)
        trip_id = self.request.query_params.get("trip")

        qs = Checklist.objects.all()

        # if trip filter is provided, enforce trip access
        if trip_id:
            try:
                trip = Trip.objects.get(id=trip_id)
            except Trip.DoesNotExist:
                raise ValidationError({"trip": "Trip not found"})

            if not _user_can_access_trip(user, trip):
                raise PermissionDenied("You do not have access to this trip.")

            qs = qs.filter(trip_id=trip_id)

        # Only show user’s own checklists OR checklists for trips user can access
        qs = qs.filter(
            Q(owner_id=user.id) |
            Q(trip__owner_id=user.id) |
            Q(trip__collaborators__user_id=user.id, trip__collaborators__status=TripCollaborator.Status.ACTIVE)
        ).distinct()

        return qs.order_by("-updated_at")

    def perform_create(self, serializer):
        user = get_app_user(self.request)
        trip_id = self.request.data.get("trip")

        if not trip_id:
            raise ValidationError({"trip": "Trip is required."})

        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            raise ValidationError({"trip": "Trip not found"})

        if not _user_can_access_trip(user, trip):
            raise PermissionDenied("You do not have access to this trip.")

        serializer.save(owner=user)


class F32ChecklistItemViewSet(viewsets.ModelViewSet):
    serializer_class = F32ChecklistItemSerializer
    queryset = ChecklistItem.objects.all()

    def get_queryset(self):
        user = get_app_user(self.request)
        checklist_id = self.request.query_params.get("checklist")

        qs = ChecklistItem.objects.select_related("checklist", "checklist__trip")

        if checklist_id:
            qs = qs.filter(checklist_id=checklist_id)

        # only items of checklists the user can access
        qs = qs.filter(
            Q(checklist__owner_id=user.id) |
            Q(checklist__trip__owner_id=user.id) |
            Q(checklist__trip__collaborators__user_id=user.id, checklist__trip__collaborators__status=TripCollaborator.Status.ACTIVE)
        ).distinct()

        return qs.order_by("sort_order", "id")

    def perform_create(self, serializer):
        user = get_app_user(self.request)
        checklist = serializer.validated_data.get("checklist")

        if not checklist:
            raise ValidationError({"checklist": "Checklist is required."})

        trip = checklist.trip
        if trip and not _user_can_access_trip(user, trip) and checklist.owner_id != user.id:
            raise PermissionDenied("You do not have access to this checklist/trip.")

        serializer.save()
