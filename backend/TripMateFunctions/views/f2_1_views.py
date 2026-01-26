from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.shortcuts import get_object_or_404
from datetime import timedelta

from ..models import Trip, TripCollaborator, AppUser
from ..serializers.f1_1_serializers import TripSerializer
from ..serializers.f2_1_serializers import (
    F21SyncRequestSerializer,
    F21SyncResponseSerializer,
)

PRESENCE_TTL_SECONDS = 20


class F21RealTimeCoEditingSyncView(APIView):
    """
    F2.1 - Real-Time Co-Editing sync endpoint.

    You can call this via short polling (1-2s):
      - send last_synced_at and local changes
      - receive latest server state / deltas
    """

    def post(self, request, *args, **kwargs):
        req = F21SyncRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        data = req.validated_data

        trip_id = data["trip_id"]
        # TODO: apply `data["changes"]` into DB with conflict resolution.

        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response(
                {"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND
            )

        trip_payload = TripSerializer(trip).data

        res_data = {
            "trip": trip_payload,
            "changes": {},  # TODO: send minimal deltas if you want
            "server_timestamp": timezone.now(),
        }
        res = F21SyncResponseSerializer(res_data)
        return Response(res.data, status=status.HTTP_200_OK)


class F21TripPresencePollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, trip_id: int, *args, **kwargs):
        user = getattr(request, "app_user", None) or getattr(request, "user", None)
        if not isinstance(user, AppUser):
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        trip = get_object_or_404(Trip, id=trip_id)
        is_member = trip.owner_id == user.id or TripCollaborator.objects.filter(
            trip=trip,
            user=user,
        ).exists()
        if not is_member:
            return Response(
                {"detail": "Not a collaborator on this trip."},
                status=status.HTTP_403_FORBIDDEN,
            )

        now = timezone.now()
        AppUser.objects.filter(id=user.id).update(last_active_at=now)
        cutoff = now - timedelta(seconds=PRESENCE_TTL_SECONDS)

        online_ids = set(
            AppUser.objects.filter(
                id=trip.owner_id,
                last_active_at__gte=cutoff,
            ).values_list("id", flat=True)
        )

        online_ids.update(
            TripCollaborator.objects.filter(
                trip=trip,
                user__isnull=False,
                user__last_active_at__gte=cutoff,
            ).values_list("user_id", flat=True)
        )

        return Response(
            {"online_user_ids": [str(uid) for uid in online_ids], "server_time": now},
            status=status.HTTP_200_OK,
        )
