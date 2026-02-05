# backend/TripMateFunctions/views/f1_2_views.py
import math
import os
import logging

import requests
from django.conf import settings

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Trip, ItineraryItem, TripDay
from ..serializers.f1_2_serializers import (
    F12RouteOptimizationRequestSerializer,
    F12RouteOptimizationResponseSerializer,
    F12RouteLegsResponseSerializer,
)

logger = logging.getLogger(__name__)


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

def _get_ors_key() -> str:
    return (
        getattr(settings, "OPENROUTESERVICE_API_KEY", None)
        or os.environ.get("OPENROUTESERVICE_API_KEY")
        or ""
    ).strip()

def _normalize_profile(profile: str) -> str:
    p = (profile or "").strip()
    allowed = {
        "driving-car",
        "driving-hgv",
        "cycling-regular",
        "cycling-road",
        "cycling-mountain",
        "cycling-electric",
        "foot-walking",
        "foot-hiking",
        "wheelchair",
    }
    if p in allowed:
        return p
    return "driving-car"

def _fallback_speed_kmh(profile: str) -> float:
    p = (profile or "").strip()
    if p == "foot-walking":
        return 4.5
    if p == "cycling-regular":
        return 15.0
    return 30.0  # driving-car fallback

def _ors_leg(a, b, profile: str):
    """
    Returns (distance_km, duration_min) using OpenRouteService, or None on failure.
    """
    api_key = _get_ors_key()
    if not api_key:
        return None

    ors_profile = _normalize_profile(profile)
    url = f"https://api.openrouteservice.org/v2/directions/{ors_profile}"
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "coordinates": [[a.lon, a.lat], [b.lon, b.lat]],
        "instructions": False,
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=8)
        if resp.status_code != 200:
            logger.warning("ORS error %s: %s", resp.status_code, resp.text[:200])
            return None
        data = resp.json()
        routes = data.get("routes") or []
        if not routes:
            return None
        summary = routes[0].get("summary") or {}
        meters = summary.get("distance")
        seconds = summary.get("duration")
        if meters is None or seconds is None:
            return None
        return round(meters / 1000, 2), round(seconds / 60, 1)
    except Exception as exc:
        logger.warning("ORS request failed: %s", exc)
        return None

def _compute_leg(a, b, profile: str):
    """
    Compute per-leg distance/time using ORS when available, with fallback.
    """
    ors = _ors_leg(a, b, profile)
    if ors:
        return ors

    dist = _haversine_km(a.lat, a.lon, b.lat, b.lon)
    speed_kmh = _fallback_speed_kmh(profile)
    minutes = dist / speed_kmh * 60.0
    return round(dist, 2), round(minutes, 1)

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
                dist_km, minutes = _compute_leg(a, b, req_ser.validated_data.get("profile"))
                total_dist += dist_km
                total_min += minutes
                all_legs.append(
                    {
                        "from_id": a.id,
                        "to_id": b.id,
                        "distance_km": dist_km,
                        "duration_min": minutes,
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

        legs = []
        total_dist = 0.0
        total_min = 0.0

        for a, b in zip(route[:-1], route[1:]):
            dist_km, minutes = _compute_leg(a, b, req_ser.validated_data.get("profile"))
            total_dist += dist_km
            total_min += minutes
            legs.append(
                {
                    "from_id": a.id,
                    "to_id": b.id,
                    "distance_km": dist_km,
                    "duration_min": minutes,
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


class F12RouteLegsView(APIView):
    """
    Compute per-leg travel time/distance between stops (no reordering).

    POST /api/f1/route-legs/
    Body:
      {
        "trip_id": 5,
        "profile": "driving-car" | "foot-walking" | "cycling-regular"
      }
    """

    def post(self, request, *args, **kwargs):
        req_ser = F12RouteOptimizationRequestSerializer(data=request.data)
        req_ser.is_valid(raise_exception=True)
        trip_id = req_ser.validated_data["trip_id"]
        profile = req_ser.validated_data.get("profile")

        try:
            trip = Trip.objects.get(pk=trip_id)
        except Trip.DoesNotExist:
            return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

        days = list(TripDay.objects.filter(trip=trip).order_by("day_index", "id"))
        all_legs = []
        total_dist = 0.0
        total_min = 0.0

        for day in days:
            day_items = list(
                ItineraryItem.objects.filter(
                    trip=trip, day=day, lat__isnull=False, lon__isnull=False
                ).order_by("sort_order", "start_time", "id")
            )
            for a, b in zip(day_items[:-1], day_items[1:]):
                dist_km, minutes = _compute_leg(a, b, profile)
                total_dist += dist_km
                total_min += minutes
                all_legs.append(
                    {
                        "from_id": a.id,
                        "to_id": b.id,
                        "distance_km": dist_km,
                        "duration_min": minutes,
                    }
                )

        response_data = {
            "legs": all_legs,
            "total_distance_km": round(total_dist, 2),
            "total_duration_min": round(total_min, 1),
            "profile": profile or "driving-car",
        }
        res_ser = F12RouteLegsResponseSerializer(response_data)
        return Response(res_ser.data, status=status.HTTP_200_OK)
