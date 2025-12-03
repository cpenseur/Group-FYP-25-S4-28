from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Trip
from ..serializers.f6_serializers import F6ExportPDFRequestSerializer
from ..serializers.f1_1_serializers import TripSerializer


class F6ExportPDFView(APIView):
    """
    F6 - Export itinerary as PDF.
    Backend just returns structured data; client can use jsPDF.
    """

    def post(self, request, *args, **kwargs):
        serializer = F6ExportPDFRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trip_id = serializer.validated_data["trip_id"]

        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response(
                {"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND
            )

        trip_data = TripSerializer(trip).data
        return Response(
            {"trip": trip_data}, status=status.HTTP_200_OK
        )  # frontend converts to PDF
