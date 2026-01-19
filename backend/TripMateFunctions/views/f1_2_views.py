# backend/TripMateFunctions/views/f1_2_views.py
import math

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Trip, ItineraryItem, TripDay
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

def _nearest_neighbor_route(items):
    """items must all have lat/lon. Starts from first in current order."""
    if len(items) < 2:
        return items

    remaining = items.copy()
    route = [remaining.pop(0)]

    while remaining:
        last = route[-1]
        best_idx = 0
        best_dist = float("inf")
        for idx, cand in enumerate(remaining):
            d = _haversine_km(last.lat, last.lon, cand.lat, cand.lon)
            if d < best_dist:
                best_dist = d
                best_idx = idx
        route.append(remaining.pop(best_idx))

    return route

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
    
    Per-day optimisation: reorders stops within each day.
    """

    def post(self, request, *args, **kwargs):
        req_ser = F12RouteOptimizationRequestSerializer(data=request.data)
        req_ser.is_valid(raise_exception=True)
        trip_id = req_ser.validated_data["trip_id"]

        try:
            trip = Trip.objects.get(pk=trip_id)
        except Trip.DoesNotExist:
            return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

        days = list(TripDay.objects.filter(trip=trip).order_by("day_index", "id"))

        SPEED_KMH = 25.0

        all_legs = []
        total_dist = 0.0
        total_min = 0.0
        updated_items = []
        flattened_order = []

        # optimise each day separately
        for day in days:
            day_items = list(
                ItineraryItem.objects.filter(trip=trip, day=day, lat__isnull=False, lon__isnull=False)
                .order_by("sort_order", "start_time", "id")
            )

            route = _nearest_neighbor_route(day_items)

            # legs within the day route
            for a, b in zip(route[:-1], route[1:]):
                dist = _haversine_km(a.lat, a.lon, b.lat, b.lon)
                minutes = dist / SPEED_KMH * 60.0
                total_dist += dist
                total_min += minutes
                all_legs.append(
                    {
                        "from_id": a.id,
                        "to_id": b.id,
                        "distance_km": round(dist, 2),
                        "duration_min": round(minutes, 1),
                    }
                )

            # persist per-day sort_order 1..N
            for order, item in enumerate(route, start=1):
                if item.sort_order != order:
                    item.sort_order = order
                    item.save(update_fields=["sort_order"])

                updated_items.append({"id": item.id, "day": day.id, "sort_order": order})
                flattened_order.append(item.id)

        response_data = {
            "optimized_order": flattened_order,
            "legs": all_legs,
            "total_distance_km": round(total_dist, 2),
            "total_duration_min": round(total_min, 1),
            "updated_items": updated_items,
        }

        res_ser = F12RouteOptimizationResponseSerializer(response_data)
        return Response(res_ser.data, status=status.HTTP_200_OK)
    
class F12FullTripRouteOptimizationView(APIView):
    """
    Full trip optimisation: optimises across ALL stops, then redistributes them across days
    while keeping the same number of geocoded stops per day.
    """

    def post(self, request, *args, **kwargs):
        req_ser = F12RouteOptimizationRequestSerializer(data=request.data)
        req_ser.is_valid(raise_exception=True)
        trip_id = req_ser.validated_data["trip_id"]

        try:
            trip = Trip.objects.get(pk=trip_id)
        except Trip.DoesNotExist:
            return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

        days = list(TripDay.objects.filter(trip=trip).order_by("day_index", "id"))

        # all geocoded items, regardless of day
        items = list(
            ItineraryItem.objects.filter(trip=trip, lat__isnull=False, lon__isnull=False)
            .order_by("sort_order", "start_time", "id")
        )

        if len(items) < 2:
            response_data = {
                "optimized_order": [i.id for i in items],
                "legs": [],
                "total_distance_km": 0.0,
                "total_duration_min": 0.0,
                "updated_items": [{"id": i.id, "day": i.day_id, "sort_order": i.sort_order or 1} for i in items],
            }
            res_ser = F12RouteOptimizationResponseSerializer(response_data)
            return Response(res_ser.data, status=status.HTTP_200_OK)

        route = _nearest_neighbor_route(items)

        # keep same number of geocoded stops per day as before
        day_counts = []
        for day in days:
            c = (
                ItineraryItem.objects.filter(trip=trip, day=day, lat__isnull=False, lon__isnull=False)
                .count()
            )
            day_counts.append(c)

        # if days exist but all counts are 0 (rare), just keep original day assignment
        if sum(day_counts) == 0:
            day_counts = [len(route)] + [0] * max(0, len(days) - 1)

        SPEED_KMH = 25.0
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

        # redistribute route into days using the existing per-day stop counts
        updated_items = []
        idx = 0
        for day, count in zip(days, day_counts):
            chunk = route[idx : idx + count]
            idx += count

            for order, item in enumerate(chunk, start=1):
                changed = False
                if item.day_id != day.id:
                    item.day = day
                    changed = True
                if item.sort_order != order:
                    item.sort_order = order
                    changed = True

                if changed:
                    item.save(update_fields=["day", "sort_order"])

                updated_items.append({"id": item.id, "day": day.id, "sort_order": order})

        response_data = {
            "optimized_order": [i.id for i in route],
            "legs": legs,
            "total_distance_km": round(total_dist, 2),
            "total_duration_min": round(total_min, 1),
            "updated_items": updated_items,
        }

        res_ser = F12RouteOptimizationResponseSerializer(response_data)
        return Response(res_ser.data, status=status.HTTP_200_OK)
