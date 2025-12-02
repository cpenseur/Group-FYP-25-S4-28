import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Trip, TripShareLink
from ..serializers.f2_3_serializers import (
    F23TripShareLinkSerializer,
    F23CreateShareLinkSerializer,
)


class F23CreateShareLinkView(APIView):
    """
    F2.3 - Generate shareable link for a trip.
    """

    def post(self, request, *args, **kwargs):
        req = F23CreateShareLinkSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        data = req.validated_data

        try:
            trip = Trip.objects.get(id=data["trip_id"])
        except Trip.DoesNotExist:
            return Response(
                {"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND
            )

        link = TripShareLink.objects.create(
            trip=trip,
            token=uuid.uuid4().hex,
            permission=data["permission"],
            expires_at=data.get("expires_at"),
            is_active=True,
        )

        return Response(
            F23TripShareLinkSerializer(link).data, status=status.HTTP_201_CREATED
        )


class F23ResolveShareLinkView(APIView):
    """
    F2.3 - Resolve share token -> trip metadata, permissions.
      GET /api/f2/share/<token>/
    """

    def get(self, request, token, *args, **kwargs):
        try:
            link = TripShareLink.objects.get(token=token, is_active=True)
        except TripShareLink.DoesNotExist:
            return Response(
                {"detail": "Invalid or expired link"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(
            F23TripShareLinkSerializer(link).data,
            status=status.HTTP_200_OK,
        )
