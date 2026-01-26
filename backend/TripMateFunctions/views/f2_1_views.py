from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.shortcuts import get_object_or_404
from datetime import timedelta
import threading

from ..models import Trip, TripCollaborator, AppUser
from ..serializers.f1_1_serializers import TripSerializer
from ..serializers.f2_1_serializers import (
    F21SyncRequestSerializer,
    F21SyncResponseSerializer,
)

PRESENCE_TTL_SECONDS = 20
PRESENCE_BY_TRIP: dict[int, dict[str, timezone.datetime]] = {}
PRESENCE_LOCK = threading.Lock()


def _prune_presence(trip_id: int, now: timezone.datetime) -> dict[str, timezone.datetime]:
    trip_map = PRESENCE_BY_TRIP.get(trip_id)
    if not trip_map:
        return {}
    cutoff = now - timedelta(seconds=PRESENCE_TTL_SECONDS)
    for user_id, last_seen in list(trip_map.items()):
        if last_seen < cutoff:
            trip_map.pop(user_id, None)
    if not trip_map:
        PRESENCE_BY_TRIP.pop(trip_id, None)
        return {}
    return trip_map


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
            status=TripCollaborator.Status.ACTIVE,
        ).exists()
        if not is_member:
            return Response(
                {"detail": "Not a collaborator on this trip."},
                status=status.HTTP_403_FORBIDDEN,
            )

        now = timezone.now()
        with PRESENCE_LOCK:
            trip_map = PRESENCE_BY_TRIP.setdefault(trip_id, {})
            trip_map[str(user.id)] = now
            trip_map = _prune_presence(trip_id, now)
            online_ids = list(trip_map.keys())

        return Response(
            {"online_user_ids": online_ids, "server_time": now},
            status=status.HTTP_200_OK,
        )
