from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from ..models import Trip
from ..serializers.f1_1_serializers import TripSerializer
from ..serializers.f2_1_serializers import (
    F21SyncRequestSerializer,
    F21SyncResponseSerializer,
)


class F21RealTimeCoEditingSyncView(APIView):
    """
    F2.1 - Real-Time Co-Editing sync endpoint.

    You can call this via short polling (1–2s):
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
