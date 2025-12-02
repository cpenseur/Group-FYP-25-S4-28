from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..serializers.f2_2_serializers import (
    F22GroupTripRequestSerializer,
    F22GroupTripResponseSerializer,
)


class F22GroupTripGeneratorView(APIView):
    """
    F2.2 - Group Trip Generator

    POST:
      - Aggregates multiple users' preferences
      - Calls SEA-LION + A* routing
      - Returns merged itinerary
    """

    def post(self, request, *args, **kwargs):
        req = F22GroupTripRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        data = req.validated_data

        # TODO: implement merge logic + AI + routing
        stub_res = {
            "trip_id": None,
            "title": f"Group trip to {data['destination']}",
            "days": data["trip_length_days"],
            "itinerary": {},  # fill later
        }

        res = F22GroupTripResponseSerializer(stub_res)
        return Response(res.data, status=status.HTTP_200_OK)
