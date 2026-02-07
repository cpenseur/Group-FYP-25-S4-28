# backend/TripMateFunctions/views/f1_4_views.py
import os
import json
import time
import hashlib
import threading
import requests
from datetime import datetime, date, time as dt_time, timedelta

from django.shortcuts import get_object_or_404
from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from ..models import AppUser, Trip, TripDay, ItineraryItem
from ..serializers.f1_4_serializers import (
    AdaptivePlanRequestSerializer,
    F14AdaptivePlanResponseSerializer,
)

# ----------------------------
# in-memory cache for preview
# ----------------------------
_ADAPTIVE_CACHE: dict[str, dict] = {}
_ADAPTIVE_CACHE_LOCK = threading.Lock()
_OSM_CACHE: dict[str, dict] = {}
_OSM_CACHE_LOCK = threading.Lock()
_OTM_CACHE: dict[str, dict] = {}
_OTM_CACHE_LOCK = threading.Lock()
_GEO_CACHE: dict[str, dict] = {}
_GEO_CACHE_LOCK = threading.Lock()

def _cache_key(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def _cache_get(key: str):
    now = time.time()
    with _ADAPTIVE_CACHE_LOCK:
        entry = _ADAPTIVE_CACHE.get(key)
        if not entry:
            return None
        if entry.get("expires_at", 0) <= now:
            _ADAPTIVE_CACHE.pop(key, None)
            return None
        return entry.get("value")

def _cache_set(key: str, value: dict, ttl_seconds: int):
    expires_at = time.time() + max(int(ttl_seconds), 1)
    with _ADAPTIVE_CACHE_LOCK:
        _ADAPTIVE_CACHE[key] = {"expires_at": expires_at, "value": value}


def _cache_osm_get(key: str):
    now = time.time()
    with _OSM_CACHE_LOCK:
        entry = _OSM_CACHE.get(key)
        if not entry:
            return None
        if entry.get("expires_at", 0) <= now:
            _OSM_CACHE.pop(key, None)
            return None
        return entry.get("value")


def _cache_osm_set(key: str, value: dict, ttl_seconds: int):
    expires_at = time.time() + max(int(ttl_seconds), 1)
    with _OSM_CACHE_LOCK:
        _OSM_CACHE[key] = {"expires_at": expires_at, "value": value}


def _cache_otm_get(key: str):
    now = time.time()
    with _OTM_CACHE_LOCK:
        entry = _OTM_CACHE.get(key)
        if not entry:
            return None
        if entry.get("expires_at", 0) <= now:
            _OTM_CACHE.pop(key, None)
            return None
        return entry.get("value")


def _cache_otm_set(key: str, value: dict, ttl_seconds: int):
    expires_at = time.time() + max(int(ttl_seconds), 1)
    with _OTM_CACHE_LOCK:
        _OTM_CACHE[key] = {"expires_at": expires_at, "value": value}


def _cache_geo_get(key: str):
    now = time.time()
    with _GEO_CACHE_LOCK:
        entry = _GEO_CACHE.get(key)
        if not entry:
            return False, None
        if entry.get("expires_at", 0) <= now:
            _GEO_CACHE.pop(key, None)
            return False, None
        return True, entry.get("value")


def _cache_geo_set(key: str, value, ttl_seconds: int):
    expires_at = time.time() + max(int(ttl_seconds), 1)
    with _GEO_CACHE_LOCK:
        _GEO_CACHE[key] = {"expires_at": expires_at, "value": value}


def _is_outdoor(title: str, item_type: str | None):
    t = (title or "").lower()
    it = (item_type or "").lower()
    outdoor_words = ["park","garden","viewpoint","hike","trail","beach","mount","mountain","lake","river","outdoor","lookout","summit"]
    indoor_words = ["museum","gallery","aquarium","shopping","mall","market","restaurant","cafe","indoors","theatre","cinema","tower","observatory"]

    if any(w in it for w in ["park","nature","outdoor"]):
        return True
    if any(w in it for w in ["museum","shopping","restaurant","cafe"]):
        return False

    if any(w in t for w in outdoor_words):
        return True
    if any(w in t for w in indoor_words):
        return False

    return False


def _open_meteo_day(lat: float, lon: float, date_str: str):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum,precipitation_probability_max,weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max",
        "timezone": "auto",
        "start_date": date_str,
        "end_date": date_str,
    }
    try:
        r = requests.get(url, params=params, timeout=10)
        if r.status_code != 200:
            return None
        data = r.json()
    except Exception:
        return None

    daily = data.get("daily") or {}
    ps = (daily.get("precipitation_sum") or [None])[0]
    pp = (daily.get("precipitation_probability_max") or [None])[0]
    wc = (daily.get("weathercode") or [None])[0]
    tmax = (daily.get("temperature_2m_max") or [None])[0]
    tmin = (daily.get("temperature_2m_min") or [None])[0]
    wind = (daily.get("windspeed_10m_max") or [None])[0]
    return {
        "precipitation_sum": ps,
        "precipitation_probability_max": pp,
        "weathercode": wc,
        "temperature_2m_max": tmax,
        "temperature_2m_min": tmin,
        "windspeed_10m_max": wind,
    }


def _open_meteo_archive_day(lat: float, lon: float, date_str: str):
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum,weather_code,temperature_2m_max,temperature_2m_min,windspeed_10m_max",
        "timezone": "auto",
        "start_date": date_str,
        "end_date": date_str,
    }
    try:
        r = requests.get(url, params=params, timeout=12)
        if r.status_code != 200:
            return None
        data = r.json()
    except Exception:
        return None

    daily = data.get("daily") or {}
    ps = (daily.get("precipitation_sum") or [None])[0]
    wc = (daily.get("weather_code") or [None])[0]
    tmax = (daily.get("temperature_2m_max") or [None])[0]
    tmin = (daily.get("temperature_2m_min") or [None])[0]
    wind = (daily.get("windspeed_10m_max") or [None])[0]
    return {
        "precipitation_sum": ps,
        "precipitation_probability_max": None,
        "weathercode": wc,
        "temperature_2m_max": tmax,
        "temperature_2m_min": tmin,
        "windspeed_10m_max": wind,
    }


def _open_meteo_climate_day(lat: float, lon: float, date_str: str):
    url = "https://climate-api.open-meteo.com/v1/climate"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min",
        "models": "EC_Earth3P_HR",
        "start_date": date_str,
        "end_date": date_str,
    }
    try:
        r = requests.get(url, params=params, timeout=12)
        if r.status_code != 200:
            return None
        data = r.json()
    except Exception:
        return None

    daily = data.get("daily") or {}
    tmax = (daily.get("temperature_2m_max") or [None])[0]
    tmin = (daily.get("temperature_2m_min") or [None])[0]
    return {
        "temperature_2m_max": tmax,
        "temperature_2m_min": tmin,
    }


def _geocode_trip_location(trip: Trip):
    parts = []
    if trip.main_city:
        parts.append(str(trip.main_city).strip())
    if trip.main_country:
        parts.append(str(trip.main_country).strip())
    query = ", ".join([p for p in parts if p])
    if not query:
        return None

    cache_key = f"geo:{query.lower()}"
    hit, cached = _cache_geo_get(cache_key)
    if hit:
        return cached

    try:
        r = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={
                "name": query,
                "count": 1,
                "language": "en",
                "format": "json",
            },
            timeout=8,
        )
        if r.status_code != 200:
            return None
        data = r.json() or {}
        results = data.get("results") or []
        if not results:
            _cache_geo_set(cache_key, None, 60 * 60 * 24)
            return None
        first = results[0] or {}
        lat = first.get("latitude")
        lon = first.get("longitude")
        if lat is None or lon is None:
            _cache_geo_set(cache_key, None, 60 * 60 * 24)
            return None
        coords = (float(lat), float(lon))
        _cache_geo_set(cache_key, coords, 60 * 60 * 24 * 7)
        return coords
    except Exception:
        return None


def _find_anchor_item(trip_id: int, day: TripDay, day_items: list[ItineraryItem]):
    for it in day_items:
        if it.lat is not None and it.lon is not None:
            return it

    candidates = list(
        ItineraryItem.objects.filter(
            trip_id=trip_id,
            lat__isnull=False,
            lon__isnull=False,
        ).select_related("day")
    )
    if not candidates:
        return None

    target_index = day.day_index
    best = None
    best_delta = None
    for it in candidates:
        day_index = it.day.day_index if it.day else None
        delta = abs(day_index - target_index) if day_index is not None else 10_000
        if best is None or delta < best_delta:
            best = it
            best_delta = delta

    return best


def _compute_weather_context(
    date_str: str,
    anchor: ItineraryItem | None,
    fallback_coords: tuple[float, float] | None = None,
):
    def _parse_date(d: str):
        try:
            return datetime.strptime(d, "%Y-%m-%d").date()
        except Exception:
            return None

    def _missing_temps(data: dict | None) -> bool:
        if not data:
            return True
        return data.get("temperature_2m_max") is None and data.get("temperature_2m_min") is None

    def _merge(base: dict | None, extra: dict | None):
        if not extra:
            return base
        if not base:
            return extra
        merged = dict(base)
        for k, v in extra.items():
            if merged.get(k) is None:
                merged[k] = v
        return merged

    target_date = _parse_date(date_str)
    today = date.today()
    horizon = today + timedelta(days=16)

    def _fetch_for_coords(lat: float, lon: float):
        if target_date and target_date < today:
            wx_local = _open_meteo_archive_day(lat, lon, date_str)
        else:
            wx_local = _open_meteo_day(lat, lon, date_str)

        if target_date and target_date > horizon and _missing_temps(wx_local):
            climate = _open_meteo_climate_day(lat, lon, date_str)
            wx_local = _merge(wx_local, climate)

        if target_date and target_date < today and _missing_temps(wx_local):
            climate = _open_meteo_climate_day(lat, lon, date_str)
            wx_local = _merge(wx_local, climate)

        return wx_local

    wx = None
    if anchor and anchor.lat is not None and anchor.lon is not None:
        wx = _fetch_for_coords(float(anchor.lat), float(anchor.lon))

    if _missing_temps(wx) and fallback_coords:
        wx = _merge(wx, _fetch_for_coords(float(fallback_coords[0]), float(fallback_coords[1])))

    rain_prob = (wx or {}).get("precipitation_probability_max")
    rain_sum = (wx or {}).get("precipitation_sum")
    weather_code = (wx or {}).get("weathercode")
    temp_max = (wx or {}).get("temperature_2m_max")
    temp_min = (wx or {}).get("temperature_2m_min")
    wind_max = (wx or {}).get("windspeed_10m_max")

    is_rainy = False
    if isinstance(rain_prob, (int, float)) and rain_prob >= 60:
        is_rainy = True
    if isinstance(rain_sum, (int, float)) and rain_sum >= 5:
        is_rainy = True

    bad_weather_reasons = []
    if isinstance(rain_prob, (int, float)) and rain_prob >= 60:
        bad_weather_reasons.append("High rain risk")
    if isinstance(rain_sum, (int, float)) and rain_sum >= 5:
        bad_weather_reasons.append("Heavy precipitation")
    if isinstance(weather_code, (int, float)) and weather_code >= 80:
        bad_weather_reasons.append("Storm or thunder risk")
    if isinstance(temp_max, (int, float)) and temp_max >= 35:
        bad_weather_reasons.append("Extreme heat")
    if isinstance(temp_min, (int, float)) and temp_min <= 5:
        bad_weather_reasons.append("Very cold")
    if isinstance(wind_max, (int, float)) and wind_max >= 60:
        bad_weather_reasons.append("High winds")

    return wx, is_rainy, len(bad_weather_reasons) > 0, bad_weather_reasons


def _round_coord(val: float) -> float:
    return round(val, 4)


def _fetch_osm_opening_hours(lat: float | None, lon: float | None):
    """Query Overpass for nearby POIs with opening_hours. Cache for 24h."""
    if lat is None or lon is None:
        return None

    rlat = _round_coord(lat)
    rlon = _round_coord(lon)
    cache_key = f"osm:{rlat}:{rlon}"
    cached = _cache_osm_get(cache_key)
    if cached is not None:
        return cached

    query = f"""
    [out:json][timeout:10];
    (
      node(around:200,{rlat},{rlon})[opening_hours];
      way(around:200,{rlat},{rlon})[opening_hours];
      relation(around:200,{rlat},{rlon})[opening_hours];
    );
    out tags center 1;
    """
    result = {"opening_hours": None, "source": "unknown", "confidence": 0.2, "tags": {}}
    try:
        resp = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            timeout=12,
        )
        if resp.status_code == 200:
            data = resp.json() or {}
            elements = data.get("elements") or []
            if elements:
                elem = elements[0]
                tags = elem.get("tags") or {}
                oh = tags.get("opening_hours")
                if oh:
                    result = {
                        "opening_hours": oh,
                        "source": "osm",
                        "confidence": 1.0,
                        "tags": tags,
                    }
    except Exception:
        # keep default result
        pass

    _cache_osm_set(cache_key, result, 60 * 60 * 24)
    return result


def _get_otm_key() -> str:
    return (os.environ.get("OPENTRIPMAP_API_KEY") or "").strip()


def _otm_kinds_for_item(item: ItineraryItem):
    text = f"{item.item_type or ''} {item.title or ''}".lower()
    if "museum" in text:
        return "museums"
    if any(w in text for w in ["park", "garden", "nature", "beach", "trail", "hike", "outdoor"]):
        return "natural"
    if any(w in text for w in ["shopping", "mall", "market", "shop"]):
        return "shops"
    if any(w in text for w in ["restaurant", "cafe", "food", "dining"]):
        return "foods"
    if any(w in text for w in ["temple", "church", "mosque", "cathedral", "religion"]):
        return "religion"
    if any(w in text for w in ["gallery", "art", "exhibit"]):
        return "cultural"
    return "interesting_places"


def _fetch_otm_candidates(lat: float, lon: float, kinds: str | None, limit: int = 6, radius: int = 2500):
    api_key = _get_otm_key()
    if not api_key:
        return []

    params = {
        "apikey": api_key,
        "radius": radius,
        "lat": lat,
        "lon": lon,
        "limit": limit,
        "rate": "3",
        "format": "json",
    }
    if kinds:
        params["kinds"] = kinds

    cache_key = f"otm:radius:{round(lat,4)}:{round(lon,4)}:{kinds}:{limit}:{radius}"
    cached = _cache_otm_get(cache_key)
    if cached is not None:
        return cached

    try:
        r = requests.get("https://api.opentripmap.com/0.1/en/places/radius", params=params, timeout=10)
        if r.status_code != 200:
            return []
        data = r.json()
        if not isinstance(data, list):
            return []
        _cache_otm_set(cache_key, data, 60 * 60 * 6)
        return data
    except Exception:
        return []


def _fetch_otm_details(xid: str):
    api_key = _get_otm_key()
    if not api_key or not xid:
        return None

    cache_key = f"otm:detail:{xid}"
    cached = _cache_otm_get(cache_key)
    if cached is not None:
        return cached

    try:
        url = f"https://api.opentripmap.com/0.1/en/places/xid/{xid}"
        r = requests.get(url, params={"apikey": api_key}, timeout=10)
        if r.status_code != 200:
            return None
        data = r.json()
        if not isinstance(data, dict):
            return None
        _cache_otm_set(cache_key, data, 60 * 60 * 12)
        return data
    except Exception:
        return None


def _format_otm_address(addr: dict | None):
    if not isinstance(addr, dict):
        return None
    parts = [
        addr.get("road"),
        addr.get("suburb"),
        addr.get("city") or addr.get("town") or addr.get("village"),
        addr.get("state"),
        addr.get("country"),
    ]
    cleaned = [p for p in parts if p]
    return ", ".join(cleaned) if cleaned else None


def _build_replacement_options(it: ItineraryItem, trip_date: date | None, start_dt: datetime | None, end_dt: datetime | None):
    if it.lat is None or it.lon is None:
        return []

    kinds = _otm_kinds_for_item(it)
    candidates = _fetch_otm_candidates(float(it.lat), float(it.lon), kinds=kinds, limit=6, radius=2500)
    if not candidates:
        return []

    when_dt = start_dt or end_dt
    options = []
    seen = set()

    for cand in candidates:
        name = (cand.get("name") or "").strip()
        xid = cand.get("xid")
        if not name or name.lower() == (it.title or "").lower():
            continue
        if xid in seen:
            continue
        seen.add(xid)

        point = cand.get("point") or {}
        lat = point.get("lat")
        lon = point.get("lon")
        if lat is None or lon is None:
            continue

        details = _fetch_otm_details(xid) if xid else None
        opening_hours = (details or {}).get("opening_hours")
        address = _format_otm_address((details or {}).get("address"))
        kinds_raw = (details or {}).get("kinds") or cand.get("kinds")

        is_open = None
        if opening_hours and when_dt and trip_date:
            open_t, close_t = _parse_hours_for_date(opening_hours, trip_date)
            if open_t and close_t:
                t = when_dt.time().replace(second=0, microsecond=0)
                is_open = open_t <= t <= close_t
                if is_open is False:
                    # skip if we know it's closed at that time
                    continue

        options.append(
            {
                "title": name,
                "lat": float(lat),
                "lon": float(lon),
                "distance_m": cand.get("dist"),
                "kinds": kinds_raw,
                "address": address,
                "opening_hours": opening_hours,
                "is_open": is_open,
                "xid": xid,
                "source": "opentripmap",
            }
        )

        if len(options) >= 4:
            break

    return options


def _parse_hours_for_date(opening_hours: str | None, trip_date: date | None):
    """
    Lightweight parser for common OSM opening_hours patterns.
    Returns (open_time, close_time) as datetime.time or (None, None) if unknown.
    Handles multiple ranges and skips 'off/closed' rules.
    """
    if not opening_hours or not trip_date:
        return None, None

    weekday = trip_date.weekday()  # Monday=0
    day_map = {"mo": 0, "tu": 1, "we": 2, "th": 3, "fr": 4, "sa": 5, "su": 6}

    rules = [r.strip() for r in opening_hours.split(";") if r.strip()]
    for rule in rules:
        parts = rule.lower().split()
        if not parts:
            continue

        days_part = parts[0]
        times_part = " ".join(parts[1:]) if len(parts) > 1 else ""

        day_matches = set()
        for chunk in days_part.split(","):
            chunk = chunk.strip()
            if "-" in chunk:
                start, end = chunk.split("-", 1)
                if start in day_map and end in day_map:
                    s, e = day_map[start], day_map[end]
                    if s <= e:
                        day_matches.update(range(s, e + 1))
                    else:
                        day_matches.update(range(s, 7))
                        day_matches.update(range(0, e + 1))
            elif chunk in day_map:
                day_matches.add(day_map[chunk])

        if day_matches and weekday not in day_matches:
            continue

        if "off" in times_part or "closed" in times_part:
            continue

        ranges = [r.strip() for r in times_part.split(",") if r.strip()]
        opens, closes = [], []
        for rng in ranges:
            if "-" not in rng:
                continue
            start_str, end_str = rng.split("-", 1)
            try:
                sh, sm = map(int, start_str.split(":"))
                eh, em = map(int, end_str.split(":"))
                opens.append(dt_time(sh, sm))
                closes.append(dt_time(eh, em))
            except Exception:
                continue

        if opens and closes:
            return min(opens), max(closes)

    return None, None


class F14AdaptivePlanningView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = AdaptivePlanRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        user = getattr(request, "user", None)
        if not isinstance(user, AppUser):
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        trip_id = data["trip_id"]
        day_id = data["day_id"]
        date_str = str(data["date"])
        trip_date = data.get("date")
        apply_changes = data.get("apply_changes", False)
        weather_only = data.get("weather_only", False)
        proposed_item_ids = data.get("proposed_item_ids") or []

        allowed_trip_ids = Trip.objects.filter(
            Q(owner=user) | Q(collaborators__user=user)
        ).values_list("id", flat=True)

        if trip_id not in set(allowed_trip_ids):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        trip = get_object_or_404(Trip, pk=trip_id)
        day = get_object_or_404(TripDay, pk=day_id, trip_id=trip_id)
        items_qs = ItineraryItem.objects.filter(trip_id=trip_id, day_id=day.id).order_by("sort_order", "id")
        items = list(items_qs)

        if not items:
            ttl = int(os.getenv("SEALION_ADAPTIVE_CACHE_TTL_SECONDS", "300"))
            anchor = _find_anchor_item(trip_id, day, items)
            fallback_coords = _geocode_trip_location(trip) if (trip.main_city or trip.main_country) else None
            cache_key = _cache_key(
                {
                    "trip_id": trip_id,
                    "day_id": day_id,
                    "date": date_str,
                    "anchor_lat": float(anchor.lat) if anchor and anchor.lat is not None else None,
                    "anchor_lon": float(anchor.lon) if anchor and anchor.lon is not None else None,
                    "fallback_lat": float(fallback_coords[0]) if fallback_coords else None,
                    "fallback_lon": float(fallback_coords[1]) if fallback_coords else None,
                    "mode": "empty_day",
                }
            )
            cached = _cache_get(cache_key)
            if cached:
                return Response(cached, status=status.HTTP_200_OK)

            wx, is_rainy, is_bad_weather, bad_weather_reasons = _compute_weather_context(
                date_str,
                anchor,
                fallback_coords,
            )
            payload = {
                "applied": False,
                "weather": wx,
                "is_rainy": is_rainy,
                "is_bad_weather": is_bad_weather,
                "bad_weather_reasons": bad_weather_reasons,
                "reason": "No items for this day.",
                "proposed_item_ids": [],
                "changes": [],
                "replacement_suggestions": [],
            }
            _cache_set(cache_key, payload, ttl)
            return Response(payload, status=status.HTTP_200_OK)

        # -------------------
        # APPLY FLOW
        # -------------------
        if apply_changes:
            if not proposed_item_ids or len(proposed_item_ids) != len(items):
                return Response({"detail": "Invalid proposed_item_ids."}, status=status.HTTP_400_BAD_REQUEST)

            item_id_set = {it.id for it in items}
            if set(proposed_item_ids) != item_id_set:
                return Response({"detail": "proposed_item_ids must contain exactly the day items."}, status=status.HTTP_400_BAD_REQUEST)

            id_to_item = {it.id: it for it in items}
            updated_items_payload = []
            for idx, iid in enumerate(proposed_item_ids):
                it = id_to_item[iid]
                new_order = (idx + 1) * 10
                if it.sort_order != new_order:
                    it.sort_order = new_order
                    it.save(update_fields=["sort_order"])
                updated_items_payload.append(
                    {
                        "id": it.id,
                        "day": it.day_id,
                        "sort_order": it.sort_order,
                        "start_time": it.start_time.isoformat() if it.start_time else None,
                        "end_time": it.end_time.isoformat() if it.end_time else None,
                    }
                )

            # Optionally adjust times to opening hours if requested
            if data.get("apply_opening_hours"):
                def _parse_iso(ts: str | None):
                    if not ts:
                        return None
                    try:
                        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    except Exception:
                        return None

                for it in items:
                    oh_info = _fetch_osm_opening_hours(
                        float(it.lat) if it.lat is not None else None,
                        float(it.lon) if it.lon is not None else None,
                    )
                    opening_hours_text = (oh_info or {}).get("opening_hours")
                    if not opening_hours_text:
                        continue

                    open_t, close_t = _parse_hours_for_date(opening_hours_text, trip_date)
                    if not open_t or not close_t:
                        continue

                    start_dt = _parse_iso(getattr(it, "start_time", None))
                    end_dt = _parse_iso(getattr(it, "end_time", None))

                    # Determine base date for combining times
                    base_date = None
                    tzinfo = None
                    if start_dt:
                        base_date = start_dt.date()
                        tzinfo = start_dt.tzinfo
                    elif end_dt:
                        base_date = end_dt.date()
                        tzinfo = end_dt.tzinfo
                    else:
                        base_date = trip_date

                    if not base_date:
                        continue

                    def combine(t: dt_time):
                        return datetime.combine(base_date, t, tzinfo=tzinfo)

                    new_start = start_dt
                    new_end = end_dt

                    if start_dt:
                        if start_dt.time() < open_t or start_dt.time() > close_t:
                            new_start = combine(open_t)
                    if end_dt:
                        if end_dt.time() > close_t or end_dt.time() < open_t:
                            new_end = combine(close_t)

                    # Ensure order
                    if new_start and new_end and new_end <= new_start:
                        new_start = combine(open_t)
                        new_end = combine(close_t)

                    updates = []
                    if new_start and new_start != start_dt:
                        it.start_time = new_start
                        updates.append("start_time")
                    if new_end and new_end != end_dt:
                        it.end_time = new_end
                        updates.append("end_time")
                    if updates:
                        it.save(update_fields=updates)
                        for p in updated_items_payload:
                            if p["id"] == it.id:
                                p["start_time"] = it.start_time.isoformat() if it.start_time else None
                                p["end_time"] = it.end_time.isoformat() if it.end_time else None
                                break

            return Response({"applied": True, "updated_items": updated_items_payload}, status=status.HTTP_200_OK)

        anchor = _find_anchor_item(trip_id, day, items)
        fallback_coords = _geocode_trip_location(trip) if (trip.main_city or trip.main_country) else None
        ttl = int(os.getenv("SEALION_ADAPTIVE_CACHE_TTL_SECONDS", "300"))

        if weather_only:
            cache_key = _cache_key(
                {
                    "trip_id": trip_id,
                    "day_id": day_id,
                    "date": date_str,
                    "anchor_lat": float(anchor.lat) if anchor and anchor.lat is not None else None,
                    "anchor_lon": float(anchor.lon) if anchor and anchor.lon is not None else None,
                    "fallback_lat": float(fallback_coords[0]) if fallback_coords else None,
                    "fallback_lon": float(fallback_coords[1]) if fallback_coords else None,
                    "mode": "weather_only",
                }
            )
            cached = _cache_get(cache_key)
            if cached:
                return Response(cached, status=status.HTTP_200_OK)

            wx, is_rainy, is_bad_weather, bad_weather_reasons = _compute_weather_context(
                date_str,
                anchor,
                fallback_coords,
            )
            payload = {
                "applied": False,
                "weather": wx,
                "is_rainy": is_rainy,
                "is_bad_weather": is_bad_weather,
                "bad_weather_reasons": bad_weather_reasons,
                "reason": "Weather-only preview.",
                "proposed_item_ids": [],
                "changes": [],
                "replacement_suggestions": [],
            }
            _cache_set(cache_key, payload, ttl)
            return Response(payload, status=status.HTTP_200_OK)

        # -------------------
        # PREVIEW FLOW (cached)
        # -------------------
        key = _cache_key({
            "trip_id": trip_id,
            "day_id": day_id,
            "date": date_str,
            "anchor_lat": float(anchor.lat) if anchor and anchor.lat is not None else None,
            "anchor_lon": float(anchor.lon) if anchor and anchor.lon is not None else None,
            "fallback_lat": float(fallback_coords[0]) if fallback_coords else None,
            "fallback_lon": float(fallback_coords[1]) if fallback_coords else None,
            "item_ids": [it.id for it in items],
            "sort_orders": [it.sort_order for it in items],
        })

        cached = _cache_get(key)
        if cached:
            return Response(cached, status=status.HTTP_200_OK)

        wx, is_rainy, is_bad_weather, bad_weather_reasons = _compute_weather_context(
            date_str,
            anchor,
            fallback_coords,
        )

        old_order = [it.id for it in items]

        if is_rainy:
            indoor, outdoor = [], []
            for it in items:
                if _is_outdoor(it.title or "", getattr(it, "item_type", None)):
                    outdoor.append(it)
                else:
                    indoor.append(it)
            proposed = indoor + outdoor
        else:
            proposed = items[:]

        proposed_ids = [it.id for it in proposed]

        changes = []
        replacement_suggestions = []
        old_pos = {iid: i for i, iid in enumerate(old_order)}
        for new_i, iid in enumerate(proposed_ids):
            if old_pos[iid] != new_i:
                changes.append({"item_id": iid, "from_index": old_pos[iid], "to_index": new_i})

        payload = {
            "applied": False,
            "weather": wx,
            "is_rainy": is_rainy,
            "is_bad_weather": is_bad_weather,
            "bad_weather_reasons": bad_weather_reasons,
            "reason": (
                "Rain risk detected | Indoor stops moved earlier, outdoor stops later."
                if is_rainy else
                ("Weather risk detected | Consider indoor or safer alternatives."
                 if is_bad_weather else
                 "No strong weather signal | Keeping current order.")
            ),
            "proposed_item_ids": proposed_ids,
            "changes": changes,
            "replacement_suggestions": replacement_suggestions,
        }

        # -----------------------------
        # Opening hours awareness (OSM)
        # -----------------------------
        trip_date = data.get("date")

        def _parse_iso(ts: str | None):
            if not ts:
                return None
            try:
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                return None

        for it in items:
            opening_hours_text = None
            hours_source = "unknown"
            hours_confidence = 0.2

            # Prefer stored hours on the item (if any)
            existing = getattr(it, "opening_hours_json", None) or getattr(it, "opening_hours", None)
            if isinstance(existing, dict):
                opening_hours_text = existing.get("opening_hours") or existing.get("text") or None
                hours_source = existing.get("source") or hours_source
                hours_confidence = existing.get("confidence") or hours_confidence
            elif isinstance(existing, str):
                opening_hours_text = existing or None

            # Otherwise fetch from OSM
            if not opening_hours_text:
                oh_info = _fetch_osm_opening_hours(
                    float(it.lat) if it.lat is not None else None,
                    float(it.lon) if it.lon is not None else None,
                )
                opening_hours_text = (oh_info or {}).get("opening_hours")
                hours_source = (oh_info or {}).get("source") or hours_source
                hours_confidence = (oh_info or {}).get("confidence") or hours_confidence

            open_t, close_t = _parse_hours_for_date(opening_hours_text, trip_date)
            start_dt = _parse_iso(getattr(it, "start_time", None))
            end_dt = _parse_iso(getattr(it, "end_time", None))

            def add_change(action: str, note: str):
                changes.append({
                    "action": action,
                    "item_id": it.id,
                    "reason": note,
                    "opening_hours": opening_hours_text,
                    "hours_source": hours_source,
                    "hours_confidence": hours_confidence,
                })

            has_conflict = False
            if opening_hours_text and open_t and close_t and (start_dt or end_dt):
                if start_dt:
                    st = start_dt.time().replace(second=0, microsecond=0)
                    if st < open_t:
                        add_change(
                            "opening_hours_conflict",
                            f"Start time {st.strftime('%H:%M')} is before opening ({open_t.strftime('%H:%M')}).",
                        )
                        has_conflict = True
                if end_dt:
                    et = end_dt.time().replace(second=0, microsecond=0)
                    if et > close_t:
                        add_change(
                            "opening_hours_warning",
                            f"End time {et.strftime('%H:%M')} is after closing ({close_t.strftime('%H:%M')}).",
                        )
                        has_conflict = True

            if has_conflict:
                options = _build_replacement_options(it, trip_date, start_dt, end_dt)
                if options:
                    replacement_suggestions.append({"item_id": it.id, "options": options})

        # validate shape (optional but helps catch mistakes)
        F14AdaptivePlanResponseSerializer(data=payload).is_valid(raise_exception=True)

        _cache_set(key, payload, ttl)
        return Response(payload, status=status.HTTP_200_OK)
