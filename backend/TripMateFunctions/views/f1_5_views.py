# backend/TripMateFunctions/views/f1_5_views.py
import os
import json
import time
import re
import hashlib
import threading
import requests

from django.shortcuts import get_object_or_404
from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..models import AppUser, Trip, TripDay, ItineraryItem
from ..serializers.f1_5_serializers import (
    SidebarSuggestionsRequestSerializer,
    F15SidebarResponseSerializer,
)

def _get_user_profile_context(user: AppUser) -> dict:
    # These fields must exist on your AppUser (or adjust names accordingly)
    return {
        "nationality": getattr(user, "nationality", None),
        "interests": getattr(user, "interests", None),
        "travel_pace": getattr(user, "travel_pace", None),
        "budget_level": getattr(user, "budget_level", None),
        "diet_preference": getattr(user, "diet_preference", None),
        "mobility_needs": getattr(user, "mobility_needs", None),
    }


def _profile_booster_suggestions(ctx: dict) -> list[dict]:
    out = []

    diet = (ctx.get("diet_preference") or "").lower()
    mobility = (ctx.get("mobility_needs") or "").lower()
    pace = (ctx.get("travel_pace") or "").lower()
    budget = (ctx.get("budget_level") or "").lower()

    if diet:
        # keep these generic + global, not country-limited
        out.append({
            "kind": "optimization",
            "category": "Food",
            "title": "Food fit check (diet preference)",
            "reason": f"You marked diet preference as “{ctx.get('diet_preference')}”. When choosing restaurants, confirm menu fit and consider using Google Maps filters + reviews to spot suitable options quickly.",
            "actions": ["View on map"],
        })

    if mobility:
        out.append({
            "kind": "optimization",
            "category": "Optimization",
            "title": "Accessibility & mobility note",
            "reason": f"You marked mobility needs as “{ctx.get('mobility_needs')}”. Consider checking ‘wheelchair accessible’ tags and street-view/entry stairs before committing.",
            "actions": ["View on map"],
        })

    if pace in ["slow", "relaxed"]:
        out.append({
            "kind": "optimization",
            "category": "Optimization",
            "title": "Relaxed pace spacing",
            "reason": "You prefer a slower pace. It’s usually better to cap at ~3–4 major stops/day and add buffer time for transit + breaks.",
            "actions": ["Add"],
        })

    if budget in ["low", "budget", "backpacker"]:
        out.append({
            "kind": "optimization",
            "category": "Other",
            "title": "Budget tip",
            "reason": "For budget trips, prioritize free viewpoints, parks, markets, and check local transit day-passes before using ride-hailing.",
            "actions": ["Add"],
        })

    return out[:3]


# ----------------------------
# simple in-memory cache
# ----------------------------
_SIDEBAR_CACHE: dict[str, dict] = {}
_SIDEBAR_CACHE_LOCK = threading.Lock()

def _cache_key(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def _cache_get(key: str):
    now = time.time()
    with _SIDEBAR_CACHE_LOCK:
        entry = _SIDEBAR_CACHE.get(key)
        if not entry:
            return None
        if entry.get("expires_at", 0) <= now:
            _SIDEBAR_CACHE.pop(key, None)
            return None
        return entry.get("value")

def _cache_set(key: str, value: dict, ttl_seconds: int):
    expires_at = time.time() + max(int(ttl_seconds), 1)
    with _SIDEBAR_CACHE_LOCK:
        _SIDEBAR_CACHE[key] = {"expires_at": expires_at, "value": value}


def _infer_meal_gap_suggestion(day_items, current_item_id: int | None):
    """
    If there's a big gap between current item and next item, suggest adding a meal stop.
    """
    if not day_items:
        return None

    # pick current index
    idx = 0
    if current_item_id:
        for i, it in enumerate(day_items):
            if it.id == current_item_id:
                idx = i
                break

    curr = day_items[idx]
    nxt = day_items[idx + 1] if idx + 1 < len(day_items) else None
    if not nxt:
        return None

    # only if both have start_time or end_time data
    curr_end = getattr(curr, "end_time", None) or getattr(curr, "start_time", None)
    nxt_start = getattr(nxt, "start_time", None) or getattr(nxt, "end_time", None)
    if not curr_end or not nxt_start:
        return None

    gap_minutes = (nxt_start - curr_end).total_seconds() / 60.0
    if gap_minutes < 90:
        return None

    # skip if a meal-ish stop exists already in between (simple heuristic: titles)
    meal_words = ["lunch", "dinner", "breakfast", "brunch", "cafe", "restaurant", "ramen", "sushi"]
    titles = " ".join([(it.title or "").lower() for it in day_items]).lower()
    if any(w in titles for w in meal_words):
        return None

    return {
        "kind": "optimization",
        "title": "Add a meal stop in the gap",
        "reason": f"There’s about {int(gap_minutes)} minutes between stops. A nearby lunch/cafe break can make the day feel smoother.",
        "actions": ["Add"],
        "category": "Food",
    }


def _mapbox_poi_nearby(lat: float, lon: float, limit: int = 15):
    token = (os.getenv("MAPBOX_ACCESS_TOKEN") or "").strip()
    if not token:
        return []

    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lon},{lat}.json"
    params = {
        "access_token": token,
        "limit": min(max(limit, 1), 20),
        "types": "poi",
        "language": "en",
    }

    try:
        r = requests.get(url, params=params, timeout=10)
        if r.status_code != 200:
            return []
        data = r.json()
    except Exception:
        return []

    feats = data.get("features") or []
    out = []
    for f in feats:
        props = f.get("properties") or {}
        coord = (f.get("geometry") or {}).get("coordinates") or []
        f_lon = coord[0] if len(coord) > 0 else None
        f_lat = coord[1] if len(coord) > 1 else None

        out.append({
            "place_id": f.get("id") or f.get("place_name"),
            "name": f.get("text") or f.get("place_name") or "Suggestion",
            "category": (props.get("category") or "").strip() or None,
            "address": f.get("place_name"),
            "lat": f_lat,
            "lon": f_lon,
            "source": "mapbox",
        })
    return out


def _bucketize(pois: list[dict]):
    """
    Make simple buckets: Nearby / Food / Culture / Shopping
    """
    buckets = {"Nearby": [], "Food": [], "Culture": [], "Shopping": []}
    for p in pois:
        cat = (p.get("category") or "").lower()
        name = (p.get("name") or "").lower()

        if any(w in cat for w in ["restaurant", "cafe", "food", "bar"]) or any(w in name for w in ["cafe", "restaurant"]):
            buckets["Food"].append(p)
        elif any(w in cat for w in ["museum", "gallery", "historic", "monument", "temple", "shrine"]):
            buckets["Culture"].append(p)
        elif any(w in cat for w in ["shop", "market", "mall", "store", "shopping"]):
            buckets["Shopping"].append(p)
        else:
            buckets["Nearby"].append(p)

    # keep lists short
    for k in buckets:
        buckets[k] = buckets[k][:8]

    return buckets


class F15AIRecommendationsSidebarView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = SidebarSuggestionsRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        user = getattr(request, "user", None)
        if not isinstance(user, AppUser):
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        trip_id = data["trip_id"]
        day_id = data["day_id"]
        current_item_id = data.get("current_item_id")

        allowed_trip_ids = Trip.objects.filter(
            Q(owner=user) | Q(collaborators__user=user)
        ).values_list("id", flat=True)

        if trip_id not in set(allowed_trip_ids):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        day = get_object_or_404(TripDay, pk=day_id, trip_id=trip_id)
        day_items = list(ItineraryItem.objects.filter(trip_id=trip_id, day_id=day.id).order_by("sort_order", "id"))

        anchor = None
        if current_item_id:
            anchor = next((it for it in day_items if it.id == current_item_id), None)
        if not anchor:
            anchor = day_items[0] if day_items else None

        if not anchor or anchor.lat is None or anchor.lon is None:
            payload = {"suggestions": [], "buckets": {}, "anchor": None}
            return Response(payload, status=status.HTTP_200_OK)

        ttl = int(os.getenv("SEALION_SIDEBAR_CACHE_TTL_SECONDS", "600"))
        profile_ctx = _get_user_profile_context(user)

        cache_payload = {
            "trip_id": trip_id,
            "day_id": day_id,
            "current_item_id": current_item_id,
            "anchor_lat": float(anchor.lat),
            "anchor_lon": float(anchor.lon),
            "day_date": str(getattr(day, "date", "")),

            # personalization
            "nationality": profile_ctx.get("nationality"),
            "interests": profile_ctx.get("interests"),
            "travel_pace": profile_ctx.get("travel_pace"),
            "budget_level": profile_ctx.get("budget_level"),
            "diet_preference": profile_ctx.get("diet_preference"),
            "mobility_needs": profile_ctx.get("mobility_needs"),
        }

        key = _cache_key(cache_payload)

        cached = _cache_get(key)
        if cached:
            cached["cached"] = True
            return Response(cached, status=status.HTTP_200_OK)

        pois = _mapbox_poi_nearby(float(anchor.lat), float(anchor.lon), limit=18)
        buckets = _bucketize(pois)

        suggestions = []
        for bucket_name, items in buckets.items():
            for p in items[:6]:
                suggestions.append({
                    "kind": "place",
                    "category": bucket_name,
                    "title": p["name"],
                    "subtitle": p.get("address"),
                    "place": p,
                    "actions": ["View on map", "Add"],
                })

        opt = _infer_meal_gap_suggestion(day_items, current_item_id)
        if opt:
            suggestions.insert(0, opt)

        profile_sugs = _profile_booster_suggestions(profile_ctx)

        payload_out = {
            "suggestions": (profile_sugs + suggestions)[:20],
            "cached": False,
        }

        # validate response shape
        F15SidebarResponseSerializer(data=payload_out).is_valid(raise_exception=True)

        _cache_set(key, payload_out, ttl)
        return Response(payload_out, status=status.HTTP_200_OK)