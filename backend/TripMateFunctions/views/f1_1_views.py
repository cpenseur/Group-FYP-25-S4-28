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
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from django.conf import settings
import logging

from ..models import AppUser, Trip, TripDay, ItineraryItem, TripCollaborator
from ..serializers.f1_1_serializers import (
    TripSerializer,
    TripDaySerializer,
    ItineraryItemSerializer,
    TripOverviewSerializer,
    TripCollaboratorInviteSerializer,
)
from .base_views import BaseViewSet

logger = logging.getLogger(__name__)

class TripViewSet(BaseViewSet):
    queryset = Trip.objects.all().select_related("owner")
    serializer_class = TripSerializer

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
        if self.action == "list":
            return TripOverviewSerializer
        return TripSerializer

    def perform_create(self, serializer):
        user = getattr(self.request, "user", None)

        if not isinstance(user, AppUser):
            raise exceptions.NotAuthenticated("You must be logged in to create a trip.")

        trip = serializer.save(owner=user)

        TripCollaborator.objects.get_or_create(
            trip=trip,
            user=user,
            defaults={
                "role": TripCollaborator.Role.OWNER,
                "status": TripCollaborator.Status.ACTIVE,
                "accepted_at": timezone.now(),
            },
        )

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
                    "status": TripCollaborator.Status.INVITED,
                },
            )
        else:
            collab, created = TripCollaborator.objects.get_or_create(
                trip=trip,
                invited_email=email,
                defaults={
                    "role": role,
                    "status": TripCollaborator.Status.INVITED,
                },
            )
            
        collab.ensure_token()
        collab.save(update_fields=["invite_token"])
        invite_url = f"http://localhost:5173/accept-invite?token={collab.invite_token}"
        
        try:
            send_mail(
                subject="You're invited to a Trip on TripMate ✈️",
                message=(
                    f"You've been invited to join a trip.\n\n"
                    f"Click the link below to accept the invite:\n"
                    f"{invite_url}\n\n"
                    f"If you didn't expect this, you can ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Failed to send invitation email to {email}: {str(e)}")

        return Response(
            {
                "kind": "linked" if invitee else "invited",
                "email": email,
                "invite_token": collab.invite_token,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        trip = self.get_object()

        response = super().partial_update(request, *args, **kwargs)
        trip.refresh_from_db()

        if trip.start_date and trip.end_date:
            desired_days = (trip.end_date - trip.start_date).days + 1
            if desired_days < 1:
                desired_days = 1

            qs = TripDay.objects.filter(trip=trip).order_by("day_index")
            existing = qs.count()

            if desired_days > existing:
                for i in range(existing + 1, desired_days + 1):
                    TripDay.objects.create(
                        trip=trip,
                        day_index=i,
                        date=trip.start_date + timedelta(days=i - 1),
                    )

            elif desired_days < existing:
                extra = qs.filter(day_index__gt=desired_days)
                extra.delete()

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
    queryset = TripDay.objects.all().order_by("trip", "day_index")
    serializer_class = TripDaySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            qs = qs.filter(trip_id=trip_id)
        return qs

    def perform_create(self, serializer):
        from django.db.models import Max
        from datetime import timedelta
        from django.shortcuts import get_object_or_404

        request = self.request
        trip_id = request.data.get("trip")

        if not trip_id:
            raise ValueError("trip field is required to create a new day")

        trip = get_object_or_404(Trip, pk=trip_id)

        max_index = (
            TripDay.objects.filter(trip=trip)
            .aggregate(Max("day_index"))
            .get("day_index__max") or 0
        )
        next_index = max_index + 1

        date = request.data.get("date")
        if not date and trip.start_date:
            date = trip.start_date + timedelta(days=next_index - 1)

        serializer.save(
            trip=trip,
            day_index=next_index,
            date=date,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        trip = instance.trip
        removed_index = instance.day_index

        self.perform_destroy(instance)

        TripDay.objects.filter(
            trip=trip,
            day_index__gt=removed_index,
        ).update(day_index=F("day_index") - 1)

        return Response(status=status.HTTP_204_NO_CONTENT)


class ItineraryItemViewSet(BaseViewSet):
    queryset = ItineraryItem.objects.all()
    serializer_class = ItineraryItemSerializer