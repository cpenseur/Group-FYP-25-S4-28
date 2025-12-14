# backend/TripMateFunctions/views/f1_2_views.py
import math

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Trip, ItineraryItem
from ..serializers.f1_2_serializers import (
    F12RouteOptimizationRequestSerializer,
    F12RouteOptimizationResponseSerializer,
)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Simple great-circle distance in kilometres between two lat/lon points.
    Good enough for an internal heuristic; you can swap to ORS distances later.
    """
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class F12RouteOptimizationView(APIView):
    """
    F1.2 – Route Optimization (simplified in-app heuristic).

    POST /api/f1/route-optimize/

    Body:
      {
        "trip_id": 5,
        "profile": "driving-car"   # optional, currently unused
      }

    Behaviour:
      - Loads all ItineraryItems for the trip that have lat/lon
      - Runs a nearest-neighbour heuristic to produce an efficient route
      - Updates each item's sort_order in DB
      - Returns optimised order + per-leg distance/time summary

    This matches the frontend call in ItineraryEditor:
      apiFetch("/f1/route-optimize/", { method: "POST", body: { trip_id } })
    """

    def post(self, request, *args, **kwargs):
        req_ser = F12RouteOptimizationRequestSerializer(data=request.data)
        req_ser.is_valid(raise_exception=True)
        validated = req_ser.validated_data

        trip_id = validated["trip_id"]

        # --- Load trip + items ------------------------------------------------
        try:
            trip = Trip.objects.get(pk=trip_id)
        except Trip.DoesNotExist:
            return Response(
                {"detail": "Trip not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        items = list(
            ItineraryItem.objects.filter(
                trip=trip, lat__isnull=False, lon__isnull=False
            ).order_by("sort_order", "start_time", "id")
        )

        # If fewer than 2 stops, nothing to optimise
        if len(items) < 2:
            data = {
                "optimized_order": [i.id for i in items],
                "legs": [],
                "total_distance_km": 0.0,
                "total_duration_min": 0.0,
            }
            res_ser = F12RouteOptimizationResponseSerializer(data)
            return Response(res_ser.data, status=status.HTTP_200_OK)

        # --- Nearest-neighbour heuristic over itinerary items ----------------
        remaining = items.copy()
        route = [remaining.pop(0)]  # start from first stop in existing order

        while remaining:
            last = route[-1]
            best_idx = 0
            best_dist = float("inf")
            for idx, candidate in enumerate(remaining):
                d = _haversine_km(
                    last.lat, last.lon, candidate.lat, candidate.lon
                )
                if d < best_dist:
                    best_dist = d
                    best_idx = idx
            route.append(remaining.pop(best_idx))

        # --- Build legs + totals (N4) ----------------------------------------
        SPEED_KMH = 25.0  # rough city speed; adjust or swap to ORS later

        legs = []
        total_dist = 0.0
        total_min = 0.0

        for a, b in zip(route[:-1], route[1:]):
            dist = _haversine_km(a.lat, a.lon, b.lat, b.lon)
            minutes = dist / SPEED_KMH * 60.0
            total_dist += dist
            total_min += minutes
            legs.append(
                {
                    "from_id": a.id,
                    "to_id": b.id,
                    "distance_km": round(dist, 2),
                    "duration_min": round(minutes, 1),
                }
            )

        optimized_ids = [i.id for i in route]

        # --- Persist new sort_order to DB (N3 + N6) -------------------------
        for order, item in enumerate(route, start=1):
            if item.sort_order != order:
                item.sort_order = order
                item.save(update_fields=["sort_order"])

        response_data = {
            "optimized_order": optimized_ids,
            "legs": legs,
            "total_distance_km": round(total_dist, 2),
            "total_duration_min": round(total_min, 1),
        }

        res_ser = F12RouteOptimizationResponseSerializer(response_data)
        return Response(res_ser.data, status=status.HTTP_200_OK)
