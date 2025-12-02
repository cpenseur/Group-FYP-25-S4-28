from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Destination, DestinationFAQ, DestinationQA, CountryInfo
from ..serializers.f1_6_serializers import (
    F16DestinationFAQRequestSerializer,
    F16DestinationFAQPanelSerializer,
)


class F16DestinationFAQView(APIView):
    """
    F1.6 - Destination FAQ Panel

    POST:
      - body: {"destination_id": ...}
      - loads Destination, FAQ, Q&A, CountryInfo
      - returns combined panel payload
    """

    def post(self, request, *args, **kwargs):
        req = F16DestinationFAQRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        dest_id = req.validated_data["destination_id"]

        try:
            destination = Destination.objects.get(id=dest_id)
        except Destination.DoesNotExist:
            return Response(
                {"detail": "Destination not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        faqs = DestinationFAQ.objects.filter(destination=destination, is_published=True)
        qas = DestinationQA.objects.filter(destination=destination, is_public=True)

        country_info = None
        if destination.country_code:
            country_info = (
                CountryInfo.objects.filter(country_code=destination.country_code)
                .order_by("-updated_at")
                .first()
            )

        panel_data = {
            "destination": destination,
            "faqs": faqs,
            "community_qas": qas,
            "country_info": country_info,
        }

        serializer = F16DestinationFAQPanelSerializer(panel_data)
        return Response(serializer.data, status=status.HTTP_200_OK)
