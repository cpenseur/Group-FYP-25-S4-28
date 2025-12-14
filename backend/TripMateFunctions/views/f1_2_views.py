from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Trip, ItineraryItem
from ..serializers.f1_2_serializers import (
    F12RouteOptimizationRequestSerializer,
    F12RouteOptimizationResponseSerializer,
)


class F12RouteOptimizationView(APIView):
    """
    F1.2 - Route Optimization

    POST:
      - Accepts coordinates (and optionally trip_id)
      - Calls ORS Matrix + TSP heuristic (TODO)
      - Returns optimized order and summary

    Later you can:
      - Update ItineraryItem.sort_order when trip_id is supplied
      - Cache results in Supabase
    """

    def post(self, request, *args, **kwargs):
        req_serializer = F12RouteOptimizationRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)
        data = req_serializer.validated_data

        # TODO: integrate OpenRouteService + TSP logic.
        # For now, just echo back in same order as a stub.
        coords = data["coordinates"]
        legs = []
        total_distance = 0.0
        total_duration = 0.0

        for idx, coord in enumerate(coords):
            legs.append(
                {
                    "index": idx,
                    "lat": coord.get("lat"),
                    "lon": coord.get("lon"),
                    "distance_m": 0.0,  # TODO
                    "duration_s": 0.0,  # TODO
                }
            )

        res = {
            "total_distance_m": total_distance,
            "total_duration_s": total_duration,
            "legs": legs,
        }

        res_serializer = F12RouteOptimizationResponseSerializer(res)
        return Response(res_serializer.data, status=status.HTTP_200_OK)
