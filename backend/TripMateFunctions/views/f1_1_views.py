# backend/TripMateFunctions/views/f1_1_views.py
from django.db.models import F
from django.db import models
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import exceptions
from rest_framework.permissions import IsAuthenticated
from datetime import timedelta
from django.db import transaction
from django.utils.dateparse import parse_date
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ..models import AppUser, Trip, TripDay, ItineraryItem, TripCollaborator
from ..serializers.f1_1_serializers import (
    TripSerializer,
    TripDaySerializer,
    ItineraryItemSerializer,
    TripOverviewSerializer,
    TripCollaboratorInviteSerializer,
)
from .base_views import BaseViewSet


class TripViewSet(BaseViewSet):
    queryset = Trip.objects.all().select_related("owner")
    serializer_class = TripSerializer

    def get_permissions(self):
        if self.action in ["create"]:
            return [IsAuthenticated()]
        return super().get_permissions()
    
    def get_permissions(self):
        if self.action in ["create", "list", "retrieve", "overview"]:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not isinstance(user, AppUser):
            return Trip.objects.none()

        return (
            qs.filter(Q(owner=user) | Q(collaborators__user=user))
            .distinct()
            .select_related("owner")
        )
    
    def get_serializer_class(self):
        # Optional but recommended
        if self.action == "list":
            return TripOverviewSerializer
        return TripSerializer

    def perform_create(self, serializer):
        user = getattr(self.request, "user", None)

        if not isinstance(user, AppUser):
            raise exceptions.NotAuthenticated("You must be logged in to create a trip.")

        # Save trip and keep instance
        trip = serializer.save(owner=user)

        # Ensure owner exists as a TripCollaborator row
        TripCollaborator.objects.get_or_create(
            trip=trip,
            user=user,
            defaults={
                "role": TripCollaborator.Role.OWNER,
                "status": TripCollaborator.Status.ACTIVE,
                "accepted_at": timezone.now(),
            },
        )


        # Auto-create TripDay rows so itinerary shows empty days immediately
        if trip.start_date and trip.end_date and trip.end_date >= trip.start_date:
            num_days = (trip.end_date - trip.start_date).days + 1

            TripDay.objects.bulk_create([
                TripDay(
                    trip=trip,
                    day_index=i + 1,
                    date=trip.start_date + timedelta(days=i),
                )
                for i in range(num_days)
            ])

    @action(detail=True, methods=["post"], url_path="collaborators", permission_classes=[IsAuthenticated])
    def add_collaborator(self, request, pk=None):
        trip = self.get_object()

        email = (request.data.get("email") or "").strip().lower()
        role = (request.data.get("role") or TripCollaborator.Role.EDITOR)

        if not email:
            return Response(
                {"email": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # basic access control: only owner can invite (simple + safe)
        user = getattr(request, "user", None)
        if not isinstance(user, AppUser) or trip.owner_id != user.id:
            return Response(
                {"detail": "Only the trip owner can invite collaborators."},
                status=status.HTTP_403_FORBIDDEN,
            )

        invitee = AppUser.objects.filter(email=email).first()

        if invitee:
            collab, created = TripCollaborator.objects.get_or_create(
                trip=trip,
                user=invitee,
                defaults={
                    "role": role,
                    "status": TripCollaborator.Status.ACTIVE,
                    "accepted_at": timezone.now(),
                },
            )

            collab.ensure_token()
            collab.save(update_fields=["invite_token"])
            return Response(
                {
                    "kind": "linked",
                    "id": invitee.id,
                    "email": invitee.email,
                    "full_name": invitee.full_name or "",
                    "role": collab.role,
                    "invite_token": collab.invite_token, 
                },
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )

        # not AppUser yet → create pending invite
        collab, created = TripCollaborator.objects.get_or_create(
            trip=trip,
            invited_email=email,
            defaults={
                "role": role,
                "status": TripCollaborator.Status.INVITED,
            },
        )

        invite_url = f"http://localhost:5173/accept-invite?token={collab.invite_token}"

        send_mail(
            subject="You're invited to a Trip on TripMate ✈️",
            message=(
                f"You've been invited to join a trip.\n\n"
                f"Click the link below to accept the invite:\n"
                f"{invite_url}\n\n"
                f"If you didn’t expect this, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        return Response(
            {
                "kind": "invited",
                "email": email,
                "invite_token": collab.invite_token,  # keep for testing; remove later if you want
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )



    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        trip = self.get_object()

        # Let DRF update the Trip first
        response = super().partial_update(request, *args, **kwargs)
        trip.refresh_from_db()

        # Only sync if dates exist (and at least start_date exists)
        if trip.start_date and trip.end_date:
            desired_days = (trip.end_date - trip.start_date).days + 1
            if desired_days < 1:
                desired_days = 1

            qs = TripDay.objects.filter(trip=trip).order_by("day_index")
            existing = qs.count()

            # create missing days
            if desired_days > existing:
                for i in range(existing + 1, desired_days + 1):
                    TripDay.objects.create(
                        trip=trip,
                        day_index=i,
                        date=trip.start_date + timedelta(days=i - 1),
                    )

            # delete extra days (highest day_index first)
            elif desired_days < existing:
                extra = qs.filter(day_index__gt=desired_days)
                extra.delete()  # your FK is SET_NULL, so items become unscheduled

            # now set all dates consistently
            for day in TripDay.objects.filter(trip=trip):
                day.date = trip.start_date + timedelta(days=day.day_index - 1)
                day.save(update_fields=["date"])

        return response

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

    def destroy(self, request, *args, **kwargs):
        """
        DELETE /trip-days/<id>/

        - Deletes the TripDay
        - Re-indexes remaining days for that trip so day_index stays 1..N
        - ItineraryItem.day is already SET_NULL via FK (items become unscheduled)
        """
        instance: TripDay = self.get_object()
        trip = instance.trip
        removed_index = instance.day_index

        # delete this day
        self.perform_destroy(instance)

        # shift all later days up by 1
        TripDay.objects.filter(
            trip=trip,
            day_index__gt=removed_index,
        ).update(day_index=F("day_index") - 1)

        return Response(status=status.HTTP_204_NO_CONTENT)


class ItineraryItemViewSet(BaseViewSet):
    queryset = ItineraryItem.objects.all()
    serializer_class = ItineraryItemSerializer
