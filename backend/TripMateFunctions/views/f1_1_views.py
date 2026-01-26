# backend/TripMateFunctions/views/f1_1_views.py
import os
import difflib
import requests
import logging
import re
import json
import time
import hashlib
import threading
from urllib.parse import quote
from django.db.models import F
from django.db import models
from django.db.models import Q
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import exceptions
from rest_framework.permissions import IsAuthenticated
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from django.conf import settings
import logging

from ..models import AppUser, Trip, TripDay, ItineraryItem, TripCollaborator
from ..serializers.f1_1_serializers import (
    TripSerializer,
    TripDaySerializer,
    ItineraryItemSerializer,
    TripOverviewSerializer,
    TripCollaboratorInviteSerializer,
)
from .f1_4_views import _fetch_osm_opening_hours  # reuse cached Overpass helper
from .base_views import BaseViewSet

logger = logging.getLogger(__name__)

class TripViewSet(BaseViewSet):
    queryset = Trip.objects.all().select_related("owner")
    serializer_class = TripSerializer
    
    def get_permissions(self):
        if self.action in ["create", "list", "retrieve", "overview"]:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not isinstance(user, AppUser):
            return Trip.objects.none()

        return (
            qs.filter(Q(owner=user) | Q(collaborators__user=user))
            .distinct()
            .select_related("owner")
        )
    
    def get_serializer_class(self):
        if self.action == "list":
            return TripOverviewSerializer
        return TripSerializer

    def perform_create(self, serializer):
        user = getattr(self.request, "user", None)

        if not isinstance(user, AppUser):
            raise exceptions.NotAuthenticated("You must be logged in to create a trip.")

        trip = serializer.save(owner=user)

        TripCollaborator.objects.get_or_create(
            trip=trip,
            user=user,
            defaults={
                "role": TripCollaborator.Role.OWNER,
                "status": TripCollaborator.Status.ACTIVE,
                "accepted_at": timezone.now(),
            },
        )

        if trip.start_date and trip.end_date and trip.end_date >= trip.start_date:
            num_days = (trip.end_date - trip.start_date).days + 1

            TripDay.objects.bulk_create([
                TripDay(
                    trip=trip,
                    day_index=i + 1,
                    date=trip.start_date + timedelta(days=i),
                )
                for i in range(num_days)
            ])

    @action(detail=True, methods=["post"], url_path="collaborators", permission_classes=[IsAuthenticated])
    def add_collaborator(self, request, pk=None):
        trip = self.get_object()

        email = (request.data.get("email") or "").strip().lower()
        role = (request.data.get("role") or TripCollaborator.Role.EDITOR)

        if not email:
            return Response(
                {"email": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = getattr(request, "user", None)
        if not isinstance(user, AppUser) or trip.owner_id != user.id:
            return Response(
                {"detail": "Only the trip owner can invite collaborators."},
                status=status.HTTP_403_FORBIDDEN,
            )

        invitee = AppUser.objects.filter(email=email).first()

        if invitee:
            collab, created = TripCollaborator.objects.get_or_create(
                trip=trip,
                user=invitee,
                defaults={
                    "role": role,
                    "status": TripCollaborator.Status.INVITED,
                },
            )
        else:
            collab, created = TripCollaborator.objects.get_or_create(
                trip=trip,
                invited_email=email,
                defaults={
                    "role": role,
                    "status": TripCollaborator.Status.INVITED,
                },
            )
            
        collab.ensure_token()
        collab.save(update_fields=["invite_token"])
        invite_url = f"http://localhost:5173/accept-invite?token={collab.invite_token}"
        
        try:
            send_mail(
                subject="You're invited to a Trip on TripMate ✈️",
                message=(
                    f"You've been invited to join a trip.\n\n"
                    f"Click the link below to accept the invite:\n"
                    f"{invite_url}\n\n"
                    f"If you didn't expect this, you can ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Failed to send invitation email to {email}: {str(e)}")

        return Response(
            {
                "kind": "linked" if invitee else "invited",
                "email": email,
                "invite_token": collab.invite_token,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        trip = self.get_object()

        response = super().partial_update(request, *args, **kwargs)
        trip.refresh_from_db()

        if trip.start_date and trip.end_date:
            desired_days = (trip.end_date - trip.start_date).days + 1
            if desired_days < 1:
                desired_days = 1

            qs = TripDay.objects.filter(trip=trip).order_by("day_index")
            existing = qs.count()

            if desired_days > existing:
                for i in range(existing + 1, desired_days + 1):
                    TripDay.objects.create(
                        trip=trip,
                        day_index=i,
                        date=trip.start_date + timedelta(days=i - 1),
                    )

            elif desired_days < existing:
                extra = qs.filter(day_index__gt=desired_days)
                extra.delete()

            for day in TripDay.objects.filter(trip=trip):
                day.date = trip.start_date + timedelta(days=day.day_index - 1)
                day.save(update_fields=["date"])

        return response

    @action(detail=True, methods=["get"], url_path="overview")
    def overview(self, request, pk=None):
        trip = self.get_object()
        ser = TripOverviewSerializer(trip, context={"request": request})
        return Response(ser.data)


class TripDayViewSet(BaseViewSet):
    queryset = TripDay.objects.all().order_by("trip", "day_index")
    serializer_class = TripDaySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            qs = qs.filter(trip_id=trip_id)
        return qs

    def perform_create(self, serializer):
        from django.db.models import Max
        from datetime import timedelta
        from django.shortcuts import get_object_or_404

        request = self.request
        trip_id = request.data.get("trip")

        if not trip_id:
            raise ValueError("trip field is required to create a new day")

        trip = get_object_or_404(Trip, pk=trip_id)

        max_index = (
            TripDay.objects.filter(trip=trip)
            .aggregate(Max("day_index"))
            .get("day_index__max") or 0
        )
        next_index = max_index + 1

        date = request.data.get("date")
        if not date and trip.start_date:
            date = trip.start_date + timedelta(days=next_index - 1)

        serializer.save(
            trip=trip,
            day_index=next_index,
            date=date,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        trip = instance.trip
        removed_index = instance.day_index

        self.perform_destroy(instance)

        TripDay.objects.filter(
            trip=trip,
            day_index__gt=removed_index,
        ).update(day_index=F("day_index") - 1)

        return Response(status=status.HTTP_204_NO_CONTENT)

logger = logging.getLogger(__name__)

# ----------------------------
# SeaLion caches (in-memory)
# ----------------------------
_SEALION_ABOUT_CACHE: dict[str, dict] = {}
_SEALION_ABOUT_CACHE_LOCK = threading.Lock()

_SEALION_TRAVEL_CACHE: dict[str, dict] = {}
_SEALION_TRAVEL_CACHE_LOCK = threading.Lock()

def _cache_key(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def _cache_get(cache: dict, lock: threading.Lock, key: str):
    now = time.time()
    with lock:
        entry = cache.get(key)
        if not entry:
            return None
        if entry.get("expires_at", 0) <= now:
            cache.pop(key, None)
            return None
        return entry.get("value")

def _cache_set(cache: dict, lock: threading.Lock, key: str, value: dict, ttl_seconds: int):
    expires_at = time.time() + max(int(ttl_seconds), 1)
    with lock:
        cache[key] = {"expires_at": expires_at, "value": value}

def _maybe_reset_caches(request):
    """
    Dev-only cache reset:
      /place-details/?reset_travel_cache=1
      /place-details/?reset_about_cache=1
      /place-details/?reset_all_cache=1
    Only works in DEBUG to prevent accidental prod nukes.
    """
    if not getattr(settings, "DEBUG", False):
        return

    if request.query_params.get("reset_all_cache") == "1":
        with _SEALION_ABOUT_CACHE_LOCK:
            _SEALION_ABOUT_CACHE.clear()
        with _SEALION_TRAVEL_CACHE_LOCK:
            _SEALION_TRAVEL_CACHE.clear()
        return

    if request.query_params.get("reset_about_cache") == "1":
        with _SEALION_ABOUT_CACHE_LOCK:
            _SEALION_ABOUT_CACHE.clear()

    if request.query_params.get("reset_travel_cache") == "1":
        with _SEALION_TRAVEL_CACHE_LOCK:
            _SEALION_TRAVEL_CACHE.clear()

def extract_city_hint(addr: str | None) -> str | None:
    """
    Better city heuristic than 'parts[1]':
    - Avoids returning postal code chunks like "3801 Jungfraujoch"
    - Prefers the last "name-like" token before the country
    """
    if not addr:
        return None
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    if len(parts) < 2:
        return None

    # try from right to left, skipping country-ish last part
    candidates = parts[:-1]  # exclude last (usually country)
    for p in reversed(candidates):
        # reject mostly-numeric chunks
        if re.match(r"^\d", p):
            # if it begins with digits, keep only the alpha tail if meaningful
            tail = re.sub(r"^[0-9\-\s]+", "", p).strip()
            if tail and re.search(r"[A-Za-z]", tail):
                return tail
            continue
        if re.search(r"[A-Za-z]", p):
            return p
    return None

def extract_country_hint(addr: str | None) -> str | None:
    if not addr:
        return None
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    if not parts:
        return None
    return parts[-1]


class ItineraryItemViewSet(BaseViewSet):
    queryset = ItineraryItem.objects.all()
    serializer_class = ItineraryItemSerializer
    
    @action(detail=True, methods=["get"], url_path="place-details")
    def place_details(self, request, pk=None):
        user = getattr(request, "user", None)
        if not isinstance(user, AppUser):
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)

        allowed_trip_ids = Trip.objects.filter(
            Q(owner=user) | Q(collaborators__user=user)
        ).values_list("id", flat=True)

        item = get_object_or_404(ItineraryItem, pk=pk, trip_id__in=allowed_trip_ids)
        trip = item.trip

        if item.lat is None or item.lon is None:
            return Response({"detail": "This itinerary item has no coordinates."}, status=status.HTTP_400_BAD_REQUEST)

        title = (item.title or "").strip()

        WIKI_HEADERS = {
            "User-Agent": "TripMate/1.0 (educational project; contact: youremail@example.com)"
        }

        MAPBOX_TOKEN = (os.getenv("MAPBOX_ACCESS_TOKEN") or "").strip()
        MAPBOX_ENABLED = bool(MAPBOX_TOKEN)

        def safe_get(url: str, timeout: int = 8, headers: dict | None = None, params: dict | None = None):
            try:
                return requests.get(url, timeout=timeout, headers=headers, params=params)
            except Exception:
                return None

        # ----------------------------
        # Mapbox helpers
        # ----------------------------
        def mapbox_reverse(lat: float, lon: float, types: str, limit: int = 1):
            if not MAPBOX_ENABLED:
                return None
            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lon},{lat}.json"
            params = {
                "access_token": MAPBOX_TOKEN,
                "limit": limit,
                "types": types,
                "language": "en",
            }
            r = safe_get(url, timeout=8, params=params)
            if not r or r.status_code != 200:
                return None
            try:
                data = r.json()
            except Exception:
                return None
            feats = data.get("features") or []
            return feats[0] if feats else None

        def mapbox_nearby(lat: float, lon: float, limit: int = 12):
            if not MAPBOX_ENABLED:
                return []
            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lon},{lat}.json"
            params = {
                "access_token": MAPBOX_TOKEN,
                "limit": limit,
                "types": "poi",
                "language": "en",
            }
            r = safe_get(url, timeout=8, params=params)
            if not r or r.status_code != 200:
                return []
            try:
                data = r.json()
            except Exception:
                return []
            out = []
            for f in (data.get("features") or []):
                out.append({
                    "xid": f.get("id") or f.get("place_name"),
                    "name": f.get("text") or f.get("place_name") or "Nearby place",
                    "kinds": ",".join(f.get("properties", {}).get("category", "").split(",")) or None,
                    "dist_m": None,          # Mapbox response doesn't provide distance directly here
                    "image_url": None,
                    "wikipedia": None,
                })
            return out

        # ----------------------------
        # Wikipedia helpers
        # ----------------------------
        def wiki_geosearch(lat: float, lon: float, radius_m: int = 10000, limit: int = 10):
            url = "https://en.wikipedia.org/w/api.php"
            params = {
                "action": "query",
                "list": "geosearch",
                "gscoord": f"{lat}|{lon}",
                "gsradius": radius_m,
                "gslimit": limit,
                "format": "json",
            }
            r = safe_get(url, timeout=8, headers=WIKI_HEADERS, params=params)
            if not r or r.status_code != 200:
                return []
            try:
                data = r.json()
            except Exception:
                return []
            return (data.get("query") or {}).get("geosearch") or []

        def wiki_summary(place_title: str):
            """
            More reliable than REST summary:
            Uses MediaWiki action=query to fetch extract + thumbnail + canonical page url.
            """
            if not place_title:
                return None

            url = "https://en.wikipedia.org/w/api.php"
            params = {
                "action": "query",
                "format": "json",
                "redirects": 1,
                "prop": "extracts|pageimages|info",
                "exintro": 1,
                "explaintext": 1,
                "piprop": "thumbnail",
                "pithumbsize": 800,
                "inprop": "url",
                "titles": place_title,
            }

            r = safe_get(url, timeout=10, headers=WIKI_HEADERS, params=params)
            if not r or r.status_code != 200:
                return None

            try:
                data = r.json()
            except Exception:
                return None

            pages = ((data.get("query") or {}).get("pages") or {})
            if not pages:
                return None

            # pages is dict keyed by pageid
            page = next(iter(pages.values()))
            if not page or page.get("missing") is not None:
                return None

            extract = (page.get("extract") or "").strip()
            thumb = ((page.get("thumbnail") or {}).get("source") or "").strip()
            page_url = (page.get("fullurl") or "").strip()

            # return shape similar to REST so the rest of your code works
            return {
                "extract": extract,
                "thumbnail": {"source": thumb} if thumb else {},
                "content_urls": {"desktop": {"page": page_url}} if page_url else {},
                "description": None,
            }


        def wiki_media_images(place_title: str, limit: int = 12):
            t = quote(place_title.replace(" ", "_"))
            url = f"https://en.wikipedia.org/api/rest_v1/page/media-list/{t}"
            r = safe_get(url, timeout=12, headers=WIKI_HEADERS)
            if not r or r.status_code != 200:
                return []
            try:
                data = r.json()
            except Exception:
                return []

            items = data.get("items") or []
            images = []
            for it in items:
                if it.get("type") != "image":
                    continue
                src = None
                orig = it.get("original")
                if isinstance(orig, dict):
                    src = orig.get("source")
                if not src:
                    thumb = it.get("thumbnail")
                    if isinstance(thumb, dict):
                        src = thumb.get("source")
                if src:
                    images.append(src)
                if len(images) >= limit:
                    break

            # de-dupe
            seen = set()
            deduped = []
            for u in images:
                if u in seen:
                    continue
                seen.add(u)
                deduped.append(u)
            return deduped

        def pick_best_wiki_title(title_hint: str, geo_results: list[dict]):
            """
            Prefer semantic match with the itinerary title, but still keep geo-sanity.
            This is what stops 'Interlaken Ost' overriding 'Interlaken' when hint is 'Interlaken'.
            """
            if not geo_results:
                return None

            hint = (title_hint or "").strip().lower()

            best = None
            best_score = -1.0

            for g in geo_results:
                t = (g.get("title") or "").strip()
                if not t:
                    continue

                sim = difflib.SequenceMatcher(None, hint, t.lower()).ratio() if hint else 0.0
                # Small penalty for distance (in meters); keeps results near the pin
                dist = float(g.get("dist") or 0.0)
                score = sim - (dist / 50000.0)  # 50km => -1.0 penalty

                if score > best_score:
                    best_score = score
                    best = t

            return best


        COMMONS_HEADERS = {"User-Agent": "TripMate/1.0 (educational project)"}

        BAD_TITLE_PATTERNS = re.compile(
            r"(map|diagram|chart|graph|logo|flag|coat[_\s]?of[_\s]?arms|"
            r"locator|svg|seal|emblem|signature|schematic|icon)",
            re.IGNORECASE,
        )

        def commons_category_members(category: str, limit: int = 30):
            """
            Returns Commons file titles from a category, e.g. 'Category:Interlaken'
            No API key required.
            """
            url = "https://commons.wikimedia.org/w/api.php"
            params = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": category,
                "cmtype": "file",
                "cmlimit": min(limit, 50),
                "format": "json",
            }
            r = requests.get(url, params=params, headers=COMMONS_HEADERS, timeout=10)
            if r.status_code != 200:
                return []
            data = r.json()
            return [m.get("title") for m in (data.get("query", {}).get("categorymembers") or []) if m.get("title")]

        def commons_imageinfo(file_titles: list[str], thumb_px: int = 900):
            """
            Converts Commons 'File:...' titles into direct thumb URLs.
            """
            if not file_titles:
                return []

            url = "https://commons.wikimedia.org/w/api.php"
            params = {
                "action": "query",
                "titles": "|".join(file_titles[:50]),
                "prop": "imageinfo",
                "iiprop": "url|mime",
                "iiurlwidth": thumb_px,
                "format": "json",
            }
            r = requests.get(url, params=params, headers=COMMONS_HEADERS, timeout=12)
            if r.status_code != 200:
                return []

            data = r.json()
            pages = (data.get("query") or {}).get("pages") or {}
            out = []
            for _, page in pages.items():
                infos = page.get("imageinfo") or []
                if not infos:
                    continue
                info = infos[0]
                mime = (info.get("mime") or "").lower()
                # keep only real images
                if not mime.startswith("image/"):
                    continue
                # prefer thumbnail url
                src = info.get("thumburl") or info.get("url")
                if src:
                    out.append(src)
            return out

        def looks_like_real_photo(file_title: str):
            """
            Filter out non-scenic and non-photo files.
            """
            t = (file_title or "").lower()
            if BAD_TITLE_PATTERNS.search(t):
                return False
            # reject common non-photo types
            if t.endswith(".svg") or t.endswith(".pdf") or t.endswith(".gif"):
                return False
            return True

        def commons_scenic_images(place_name: str, limit: int = 12):
            """
            1) Try exact category
            2) Try 'Category:<place_name> (Switzerland)' etc not available without search,
            so we just try a few smart variants.
            """
            if not place_name:
                return []

            candidates = [
                f"Category:{place_name}",
                f"Category:{place_name} (Switzerland)",
                f"Category:{place_name} landscapes",
                f"Category:{place_name} scenery",
            ]

            # collect file titles
            file_titles = []
            seen_titles = set()

            for cat in candidates:
                members = commons_category_members(cat, limit=40)
                for ft in members:
                    if ft in seen_titles:
                        continue
                    seen_titles.add(ft)
                    if looks_like_real_photo(ft):
                        file_titles.append(ft)

                if len(file_titles) >= limit * 3:
                    break

            # convert to urls
            urls = commons_imageinfo(file_titles, thumb_px=900)

            # de-dupe preserving order
            seen = set()
            deduped = []
            for u in urls:
                if u in seen:
                    continue
                seen.add(u)
                deduped.append(u)
                if len(deduped) >= limit:
                    break
            return deduped
        
        # ----------------------------
        # Openverse helpers (fallback)
        # ----------------------------
        def openverse_search(query: str, limit: int = 12):
            """
            Openverse: free CC images search. No API key needed.
            Prefer 'thumbnail' (direct image) and dedupe.
            """
            if not query:
                return []

            url = "https://api.openverse.org/v1/images/"
            params = {
                "q": query,
                "page_size": min(max(limit, 1), 20),
                # IMPORTANT: don't over-filter or you'll get 0 results often
                # (no aspect_ratio restriction, no license restriction)
            }

            headers = {
                "User-Agent": "TripMate/1.0 (educational project)",
                "Accept": "application/json",
            }

            r = safe_get(url, timeout=12, params=params, headers=headers)
            if not r or r.status_code != 200:
                return []

            try:
                data = r.json()
            except Exception:
                return []

            results = data.get("results") or []
            urls = []
            for it in results:
                u = it.get("thumbnail") or it.get("url") or it.get("foreign_landing_url")
                if u:
                    urls.append(u)

            # dedupe
            seen = set()
            deduped = []
            for u in urls:
                if u in seen:
                    continue
                seen.add(u)
                deduped.append(u)
                if len(deduped) >= limit:
                    break
            return deduped


        def ranked_wiki_titles(title_hint: str, geo_results: list[dict], max_n: int = 5):
            """
            Return up to N candidate titles ranked by similarity (and distance penalty).
            """
            if not geo_results:
                return []

            hint = (title_hint or "").strip().lower()

            scored = []
            for g in geo_results:
                t = (g.get("title") or "").strip()
                if not t:
                    continue
                sim = difflib.SequenceMatcher(None, hint, t.lower()).ratio() if hint else 0.0
                dist = float(g.get("dist") or 0.0)
                score = sim - (dist / 50000.0)  # 50km => -1 penalty
                scored.append((score, t))

            scored.sort(key=lambda x: x[0], reverse=True)

            out_titles = []
            seen = set()
            for _, t in scored:
                if t in seen:
                    continue
                seen.add(t)
                out_titles.append(t)
                if len(out_titles) >= max_n:
                    break
            return out_titles

        def make_openverse_queries(place_title: str, address: str | None, nearby_titles: list[str]):
            """
            Openverse works best with short, clean English queries.
            We'll try multiple queries from most specific to broader.
            """
            queries = []

            base = (place_title or "").strip()
            if base:
                queries.append(base)

            # Try nearby wiki titles (these are often the canonical names)
            for t in (nearby_titles or [])[:4]:
                tt = (t or "").strip()
                if tt and tt.lower() != base.lower():
                    queries.append(tt)

            # Add city-level hint (e.g., Tokyo) but NOT full street address
            city_hint = ""
            if address:
                # crude but effective: keep only ASCII words and pick common city tokens
                # e.g. "Tokyo Prefecture" -> "Tokyo"
                m = re.search(r"\b(Tokyo|Kyoto|Osaka|Singapore|Jakarta|Seoul|Bangkok|Paris|London|New York)\b", address, re.IGNORECASE)
                if m:
                    city_hint = m.group(1)

            if base and city_hint:
                queries.append(f"{base} {city_hint}")
            if city_hint:
                queries.append(f"{base} temple {city_hint}".strip())
                queries.append(f"{base} landmark {city_hint}".strip())

            # de-dupe preserve order
            seen = set()
            out_q = []
            for q in queries:
                q2 = " ".join(q.split()).strip()
                if not q2:
                    continue
                k = q2.lower()
                if k in seen:
                    continue
                seen.add(k)
                out_q.append(q2)

            return out_q[:8]


        # ----------------------------
        # Address helpers
        # ----------------------------
        def extract_city_hint(addr: str | None) -> str | None:
            if not addr:
                return None
            parts = [p.strip() for p in addr.split(",") if p.strip()]
            if len(parts) >= 2:
                return parts[1]
            return None
        
        def extract_country_hint(addr: str | None) -> str | None:
            if not addr:
                return None
            parts = [p.strip() for p in addr.split(",") if p.strip()]
            if len(parts) >= 1:
                return parts[-1]
            return None


        # ----------------------------
        # Build response
        # ----------------------------
        out = {
            "item_id": item.id,
            "xid": None,
            "name": title or "Place",
            "description": None,
            "image_url": None,
            "images": [],
            "wikipedia": None,
            "kinds": None,
            "source": "none",
            "address": None,
            "website": None,
            "phone": None,
            "opening_hours": None,
            "opening_hours_source": None,
            "opening_hours_confidence": None,
            "nearby": [],
        }

        # 1a) Opening hours (OSM Overpass; cached in helper)
        try:
            if item.lat is not None and item.lon is not None:
                oh_info = _fetch_osm_opening_hours(float(item.lat), float(item.lon))
                if oh_info:
                    out["opening_hours"] = oh_info.get("opening_hours")
                    out["opening_hours_source"] = oh_info.get("source")
                    out["opening_hours_confidence"] = oh_info.get("confidence")
        except Exception:
            # Overpass may be down; keep the endpoint resilient
            pass

        # Fallback: reuse any stored hours on the item so we don't blank the UI if Overpass is empty
        if not out["opening_hours"]:
            try:
                existing = getattr(item, "opening_hours_json", None) or getattr(item, "opening_hours", None)
                if isinstance(existing, dict):
                    out["opening_hours"] = existing.get("opening_hours") or existing.get("text") or None
                    out["opening_hours_source"] = existing.get("source") or out["opening_hours_source"]
                    out["opening_hours_confidence"] = existing.get("confidence") or out["opening_hours_confidence"]
                elif isinstance(existing, str) and existing.strip():
                    out["opening_hours"] = existing.strip()
            except Exception:
                pass

        # 1b) POI-first (to get category/kinds)
        mb_poi = mapbox_reverse(item.lat, item.lon, types="poi", limit=1)
        if mb_poi:
            props = mb_poi.get("properties") or {}
            if props.get("category"):
                out["kinds"] = props.get("category")  # good when it's a POI

        # 1b) Address/label (for nice address even if not POI)
        mb_addr = mapbox_reverse(item.lat, item.lon, types="address,place,locality", limit=1)
        if mb_addr:
            out["address"] = mb_addr.get("place_name")
            if title.lower() in ["", "place", "selected place"]:
                out["name"] = mb_addr.get("text") or out["name"]


        # 2) Nearby list (Mapbox poi)
        geo = wiki_geosearch(item.lat, item.lon, radius_m=5000, limit=12)

        out["nearby"] = [
            {
                "xid": str(g.get("pageid")),
                "name": g.get("title"),
                "kinds": "wikipedia",
                "dist_m": g.get("dist"),
                "lat": g.get("lat"),
                "lon": g.get("lon"),
                "image_url": None,
                "wikipedia": f"https://en.wikipedia.org/?curid={g.get('pageid')}",
            }
            for g in geo
        ]


        # 3) Wikipedia → Commons → Openverse (images)
        # Allow caller to control gallery size:
        # /place-details/?include_images=0   => only hero (if any)
        # /place-details/?include_images=3   => small gallery
        # /place-details/?include_images=12  => bigger gallery
        try:
            include_images_n = int(request.query_params.get("include_images", "6"))
        except Exception:
            include_images_n = 3
        include_images_n = max(0, min(include_images_n, 20))

        cache_key = f"place_details:{item.id}:img={include_images_n}:v1"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached, status=status.HTTP_200_OK)

        geo = wiki_geosearch(item.lat, item.lon, radius_m=12000, limit=12)
        candidates = ranked_wiki_titles(title, geo, max_n=6)

        # ALSO include the closest geosearch titles (not just similarity-ranked),
        # because the correct page can have a very different name:
        # e.g. "Asakusa Kannon Temple" => "Sensō-ji"
        nearest_titles = []
        for g in sorted(geo, key=lambda x: float(x.get("dist") or 1e18))[:6]:
            t = (g.get("title") or "").strip()
            if t:
                nearest_titles.append(t)

        merged = []
        seen = set()
        for t in (candidates + nearest_titles):
            if not t or t in seen:
                continue
            seen.add(t)
            merged.append(t)

        candidates = merged[:12]



        # If geosearch returns nothing, fall back to itinerary title as a last attempt.
        if not candidates and title:
            candidates = [title]

        chosen_title = None
        wiki = None

        # Try multiple nearby wiki titles until one returns a usable summary
        for t in candidates:
            w = wiki_summary(t)
            if not w:
                continue

            extract = (w.get("extract") or "").strip()
            thumb = ((w.get("thumbnail") or {}).get("source") or "").strip()

            # treat it as usable if we got at least some text or a thumbnail
            if extract or thumb:
                chosen_title = t
                wiki = w
                break

        if wiki:
            out["description"] = (wiki.get("extract") or out["description"])
            thumb = (wiki.get("thumbnail") or {}).get("source")
            if thumb:
                out["image_url"] = thumb
            out["wikipedia"] = (
                (((wiki.get("content_urls") or {}).get("desktop") or {}).get("page"))
                or out["wikipedia"]
            )
            wiki_desc = (wiki.get("description") or "").strip()
            out["kinds"] = out["kinds"] or (wiki_desc if wiki_desc else None)
            out["source"] = "wikipedia"

        # 4) Gallery build (only if include_images_n > 0)
        gallery: list[str] = []

        if include_images_n > 0:
            # Prefer Wikipedia media list if we have a chosen title
            if chosen_title:
                gallery = wiki_media_images(chosen_title, limit=include_images_n)

            # If wiki media list is empty, try Commons category heuristics
            if not gallery:
                gallery = commons_scenic_images(chosen_title or title, limit=include_images_n)

            # If still empty, use Openverse fallback
            if not gallery:
                nearby_titles_for_ov = [n.get("name") for n in (out.get("nearby") or []) if n.get("name")]
                for q in make_openverse_queries(title, out.get("address"), nearby_titles_for_ov):
                    gallery = openverse_search(q, limit=include_images_n)
                    if gallery:
                        break


        # Ensure hero image exists: if still none, try Openverse for at least one
        if (not out["image_url"] or str(out["image_url"]).strip() == ""):
            # if gallery exists, pick first as hero
            if gallery:
                out["image_url"] = gallery[0]
            else:
                nearby_titles_for_ov = [n.get("name") for n in (out.get("nearby") or []) if n.get("name")]
                for q in make_openverse_queries(title, out.get("address"), nearby_titles_for_ov):
                    ov = openverse_search(q, limit=1)
                    if ov:
                        out["image_url"] = ov[0]
                        break
                    

        # Ensure hero is included first in images (if gallery is enabled)
        if include_images_n > 0:
            if out["image_url"] and out["image_url"] not in gallery:
                gallery = [out["image_url"]] + gallery

            # dedupe preserve order
            seen = set()
            deduped = []
            for u in gallery:
                if not u or u in seen:
                    continue
                seen.add(u)
                deduped.append(u)
                if len(deduped) >= include_images_n + (1 if out["image_url"] else 0):
                    break

            out["images"] = deduped
        else:
            out["images"] = []


        # ----------------------------
        # About payload 
        # ----------------------------
        def build_about_payload(
            name: str,
            kinds: str | None,
            address: str | None,
            description: str | None,
            opening_hours: str | None = None,
            website: str | None = None,
            nearby_titles: list[str] | None = None,
        ):
            """
            Dynamic about generator using signals from:
            - Mapbox category (kinds)           [mapbox]
            - Wikipedia extract (description)   [wikipedia]
            - address / city hint              [mapbox reverse]
            - opening_hours / website          [mapbox or your own]
            No LLM required; deterministic, fast, stable.
            """

            n = (name or "this place").strip()
            k = (kinds or "").lower()
            d = (description or "").strip()
            name_l = (name or "").lower()
            nearby_joined = " ".join((nearby_titles or [])).lower()

            # ---------- helpers ----------
            def extract_city_hint(addr: str | None) -> str | None:
                """
                Very light heuristic: picks a likely city token.
                Works with Mapbox-style place_name: "X, City, Region, Country"
                """
                if not addr:
                    return None
                parts = [p.strip() for p in addr.split(",") if p.strip()]
                if len(parts) >= 2:
                    # often: "Street, City, Prefecture, Country"
                    # so city is usually 2nd token from left
                    return parts[1]
                return None

            def is_alpine_outdoor() -> bool:
                text = f"{name_l} {d.lower()} {nearby_joined} {k}".lower()
                return any(w in text for w in [
                    "alps", "glacier", "saddle", "mountain", "peak", "summit", "ridge",
                    "metres", "meters", "elevation", "altitude", "observatory", "sphinx",
                    "railway station", "cogwheel", "cable car", "gondola", "top of europe"
                ])

            def is_museum_gallery() -> bool:
                # museum ONLY if it's clearly a museum, not just "exhibitions" inside a mountain complex
                text = f"{name_l} {d.lower()} {k}".lower()
                return (
                    any(w in text for w in ["museum", "art gallery", "exhibition hall"])
                    and not is_alpine_outdoor()
                )

            def is_park_nature() -> bool:
                text = f"{name_l} {d.lower()} {k}".lower()
                return any(w in text for w in ["park", "garden", "nature", "lake", "trail", "viewpoint", "scenic"])

            def is_food_market() -> bool:
                text = f"{name_l} {d.lower()} {k}".lower()
                return any(w in text for w in ["market", "food", "seafood", "vendors", "stalls", "street food", "food court"])

            def is_temple_shrine() -> bool:
                text = f"{name_l} {d.lower()} {nearby_joined} {k}".lower()
                return any(w in text for w in ["temple", "shrine", "buddhist", "pagoda", "place of worship", "kannon", "senso-ji", "sensō-ji"])

            def is_shopping_district() -> bool:
                text = f"{name_l} {d.lower()} {nearby_joined} {k}".lower()
                return any(w in text for w in ["shopping district", "electronics", "retail", "mall", "akihabara"])

            def is_station_transport() -> bool:
                text = f"{name_l} {d.lower()} {k}".lower()
                return any(w in text for w in ["station", "metro", "subway", "railway", "train", "transit"])

            place_type = "generic"
            if is_temple_shrine():
                place_type = "temple"
            elif is_alpine_outdoor():
                place_type = "alpine"
            elif is_shopping_district():
                place_type = "shopping"
            elif is_food_market():
                place_type = "market"
            elif is_park_nature():
                place_type = "nature"
            elif is_station_transport():
                place_type = "transport"
            elif is_museum_gallery():
                place_type = "museum"

            city = extract_city_hint(address)

            # ---------- dynamic generation ----------
            why_go: list[str] = []
            know: list[str] = []
            tips: list[str] = []
            best_time: str | None = None

            # Use description signal to create 1 "facty" why_go if we have it
            # Keep it short and not too specific (avoid hallucinating exact claims)
            if d:
                # take first sentence-ish
                first = d.split("\n")[0].strip()
                first = first.split(".")[0].strip()
                if first and len(first) > 25:
                    why_go.append(first if first.endswith(".") else first + ".")

            if place_type == "temple":
                why_go += [
                    "A peaceful cultural stop with strong local character.",
                    "Great for architecture details and street photography.",
                ]
                know += [
                    "Dress respectfully and keep noise low in worship areas.",
                    "Expect crowds during weekends and public holidays.",
                ]
                best_time = "Morning (quieter + best light)"
                tips += [
                    "Go early for clearer photos and fewer people.",
                    "Check if there are seasonal festivals or ceremonies.",
                ]

            elif place_type == "museum":
                why_go += [
                    "A solid indoor option to balance outdoor walking.",
                    "Good place to learn local context quickly.",
                ]
                know += [
                    "Some exhibits may have timed entry or last-admission rules.",
                    "Closed days can vary by season — check before going.",
                ]
                best_time = "Weekday morning (less crowded)"
                tips += [
                    "Arrive earlier for calmer galleries.",
                    "If you’re short on time, pick 1–2 key sections and do those well.",
                ]

            elif place_type == "market":
                why_go += [
                    "A high-energy stop for food, snacks, and local atmosphere.",
                    "Easy to explore in short bursts between other stops.",
                ]
                know += [
                    "Peak times get crowded — keep belongings secure.",
                    "Some stalls close earlier than you expect.",
                ]
                best_time = "Morning (freshest + most vendors)"
                tips += [
                    "Go hungry and try small portions across multiple stalls.",
                    "Bring cash as some stalls don’t take cards.",
                ]

            elif place_type == "nature":
                why_go += [
                    "A relaxing break from city streets and indoor stops.",
                    "Great for scenic photos and slower pacing.",
                ]
                know += [
                    "Weather can change the experience a lot (views vary).",
                    "Paths can be slippery after rain.",
                ]
                best_time = "Late afternoon (soft light)"
                tips += [
                    "Wear comfortable shoes with grip.",
                    "Check forecast if views are the main reason you’re going.",
                ]

            elif place_type == "alpine":
                why_go += [
                    "A high-altitude scenic highlight with dramatic mountain views.",
                    "Great for panoramic photos and a unique ‘top of the world’ experience.",
                ]
                know += [
                    "Weather can change fast at altitude—visibility and access can be affected.",
                    "Dress for cold conditions even in warmer months.",
                ]
                best_time = "Early morning (clearer views)"
                tips += [
                    "Check live webcams/forecast before committing to the trip up.",
                    "If you’re sensitive to altitude, take it slow and hydrate.",
                ]


            elif place_type == "shopping":
                why_go += [
                    "A fun area to browse, people-watch, and pick up souvenirs.",
                    "Great if you want a flexible, non-timed stop.",
                ]
                know += [
                    "Crowds usually peak late afternoon into evening.",
                    "Some shops may close earlier on weekdays.",
                ]
                best_time = "Late afternoon to evening"
                tips += [
                    "If you want quieter browsing, go earlier in the day.",
                    "Save heavier purchases for the end to avoid carrying them around.",
                ]

            elif place_type == "transport":
                why_go += [
                    "A practical landmark that often connects to multiple nearby highlights.",
                    "Good reference point for navigation and meeting up.",
                ]
                know += [
                    "Stations can be confusing — allow buffer time.",
                    "Rush hour crowds can be intense.",
                ]
                best_time = "Off-peak hours"
                tips += [
                    "Take a screenshot of the station name/exit you need.",
                    "Avoid rush hour if you’re carrying luggage.",
                ]

            else:
                why_go += [
                    f"Popular highlight around {n}.",
                    "Easy to add to most itineraries.",
                ]
                know += [
                    "Peak times can be crowded.",
                    "Weather may affect the experience.",
                ]
                best_time = "Morning or late afternoon"
                tips += [
                    "Go early for better light and fewer crowds.",
                    "Avoid peak hours if possible.",
                ]

            # Slightly personalize using city if available
            if city and city.lower() not in n.lower():
                why_go.append(f"A convenient stop to pair with other spots around {city}.")

            # Getting there should stay factual (address-based)
            getting_there = f"Navigate to: {address}" if address else None

            # Add hours/website hints if available (not hallucinated)
            if opening_hours:
                know.append("Opening hours can vary — double-check before you go.")
            if website:
                tips.append("If you’re unsure about details, check the official site for updates.")

            # De-dupe while preserving order
            def dedupe(xs: list[str]) -> list[str]:
                seen = set()
                out = []
                for x in xs:
                    x2 = (x or "").strip()
                    if not x2:
                        continue
                    if x2.lower() in seen:
                        continue
                    seen.add(x2.lower())
                    out.append(x2)
                return out

            return {
                "why_go": dedupe(why_go)[:4],
                "know_before_you_go": dedupe(know)[:4],
                "getting_there": getting_there,
                "best_time": best_time,
                "tips": dedupe(tips)[:4],
            }

        # -------- About payload (LLM first, fallback deterministic) --------
        ttl = int(os.getenv("SEALION_ABOUT_CACHE_TTL_SECONDS", "86400"))  # default 24h
        _maybe_reset_caches(request)

        # Build the exact payload we would send to SeaLion (used for cache key)
        nearby_titles = [n.get("name") for n in (out.get("nearby") or []) if n.get("name")]
        city_hint = extract_city_hint(out.get("address"))

        sealion_context = {
            "title": (title or out.get("name") or "").strip(),
            "address": out.get("address"),
            "city": city_hint,
            "country_or_region": trip.main_country or extract_country_hint(out.get("address")),
            "mapbox_category": out.get("kinds"),
            "wikipedia_extract": out.get("description"),
            "nearby_wikipedia_titles": nearby_titles[:8],
            "lat": float(item.lat),
            "lon": float(item.lon),
        }

        # Payload used to compute cache key (only include fields that matter)
        cache_payload = {
            "name": (out.get("name") or title or "Place").strip(),
            "kinds": out.get("kinds"),
            "description": out.get("description"),
            "address": out.get("address"),
            "opening_hours": out.get("opening_hours"),
            "website": out.get("website"),
            "context": {
                "title": sealion_context.get("title"),
                "city": sealion_context.get("city"),
                "country_or_region": sealion_context.get("country_or_region"),
                "mapbox_category": sealion_context.get("mapbox_category"),
                "nearby_wikipedia_titles": sealion_context.get("nearby_wikipedia_titles"),
            }
        }
        cache_key = _cache_key(cache_payload)
        cache_key_global = f"sealion_about:{item.id}:{cache_key}"

        # 1) Request-level cache (prevents double-call inside a single request)
        req_cache = getattr(request, "_sealion_about_req_cache", None)
        if req_cache is None:
            req_cache = {}
            setattr(request, "_sealion_about_req_cache", req_cache)

        about_llm = req_cache.get(cache_key)

        # 2) Cross-request shared cache (Django cache backend) so we persist across workers/restarts
        if about_llm is None:
            about_llm = cache.get(cache_key_global)

        # 3) Cross-request in-memory cache (prevents regen across requests)
        if about_llm is None:
            about_llm = _cache_get(_SEALION_ABOUT_CACHE, _SEALION_ABOUT_CACHE_LOCK, cache_key)

        # 4) If still not cached, call SeaLion once
        if about_llm is None:
            about_llm = self.sealion_generate_about(
                name=cache_payload["name"],
                kinds=cache_payload["kinds"],
                description=cache_payload["description"],
                address=cache_payload["address"],
                opening_hours=cache_payload["opening_hours"],
                website=cache_payload["website"],
                context=sealion_context,
            )

            # Only cache successful LLM results (so if SeaLion is down, we fall back properly)
            if isinstance(about_llm, dict) and about_llm:
                req_cache[cache_key] = about_llm
                _cache_set(_SEALION_ABOUT_CACHE, _SEALION_ABOUT_CACHE_LOCK, cache_key, about_llm, ttl)
                cache.set(cache_key_global, about_llm, ttl)

        # 5) Final: use LLM if available; otherwise deterministic fallback
        if about_llm:
            out["about"] = about_llm
        else:
            out["about"] = build_about_payload(
                out.get("name") or title or "Place",
                out.get("kinds"),
                out.get("address"),
                out.get("description"),
                out.get("opening_hours"),
                out.get("website"),
                nearby_titles,
            )

        # ----------------------------
        # Travel payload (SeaLion + caching)
        # ----------------------------
        trip_city = (getattr(trip, "main_city", None) or "").strip() or extract_city_hint(out.get("address"))
        trip_country = (getattr(trip, "main_country", None) or "").strip() or extract_country_hint(out.get("address"))

        trip_start = str(trip.start_date) if getattr(trip, "start_date", None) else None
        trip_end = str(trip.end_date) if getattr(trip, "end_date", None) else None

        travel_ttl = int(os.getenv("SEALION_TRAVEL_CACHE_TTL_SECONDS", "86400"))

        def build_travel_fallback(name: str | None, address: str | None):
            place_name = (name or "this place").strip() or "this place"
            loc = ", ".join([p for p in [trip_city, trip_country] if p]) or "the area"
            addr_hint = f"Navigate to: {address}" if address else None

            return {
                "transport_systems": [
                    f"Use local trains/buses/metro around {loc} when available; they are usually the fastest.",
                    "Keep a ride-hailing app ready for late or early connections.",
                    f"Check first/last service times if you need to return from {place_name} after dark.",
                ],
                "currency_exchange": [
                    "Carry a small amount of cash for small vendors; cards may not work everywhere.",
                    "Use a card with low FX fees and avoid dynamic currency conversion when offered.",
                ],
                "holidays_and_crowds": [
                    f"Weekends and public holidays in {loc} can mean longer queues; go earlier in the day.",
                    "Book key tickets or time slots ahead during peak seasons or festivals.",
                ],
                "attraction_info": [
                    f"Weather can affect visibility and access around {place_name} - check forecasts and conditions.",
                    addr_hint or "Confirm any required tickets or time slots before you go.",
                ],
            }

        travel_cache_payload = {
            "place_name": (out.get("name") or title or "Place").strip(),
            "address": out.get("address"),
            "city": trip_city,
            "country": trip_country,
            "trip_start": trip_start,
            "trip_end": trip_end,
            "opening_hours": out.get("opening_hours"),
            "website": out.get("website"),
            # include a tiny bit of signal so travel can be more relevant
            "kinds": out.get("kinds"),
            "nearby": [n.get("name") for n in (out.get("nearby") or []) if n.get("name")][:6],
        }
        travel_cache_key = _cache_key(travel_cache_payload)
        travel_cache_key_global = f"sealion_travel:{item.id}:{travel_cache_key}"

        # Request-level cache (prevents double-generation within same request)
        req_cache = getattr(request, "_sealion_travel_req_cache", None)
        if req_cache is None:
            req_cache = {}
            setattr(request, "_sealion_travel_req_cache", req_cache)

        travel_llm = req_cache.get(travel_cache_key)

        # Shared cache (Django cache backend)
        if travel_llm is None:
            travel_llm = cache.get(travel_cache_key_global)

        # Cross-request in-memory cache
        if travel_llm is None:
            travel_llm = _cache_get(_SEALION_TRAVEL_CACHE, _SEALION_TRAVEL_CACHE_LOCK, travel_cache_key)

        # Generate once via SeaLion
        if travel_llm is None:
            travel_llm = self.sealion_generate_travel(
                place_name=travel_cache_payload["place_name"],
                address=travel_cache_payload["address"],
                city=travel_cache_payload["city"],
                country=travel_cache_payload["country"],
                trip_start=travel_cache_payload["trip_start"],
                trip_end=travel_cache_payload["trip_end"],
                opening_hours=travel_cache_payload["opening_hours"],
                website=travel_cache_payload["website"],
            )
            if isinstance(travel_llm, dict) and travel_llm:
                req_cache[travel_cache_key] = travel_llm
                _cache_set(_SEALION_TRAVEL_CACHE, _SEALION_TRAVEL_CACHE_LOCK, travel_cache_key, travel_llm, travel_ttl)
                cache.set(travel_cache_key_global, travel_llm, travel_ttl)

        # Attach to response (ensure consistent shape)
        if isinstance(travel_llm, dict) and travel_llm:
            out["travel"] = travel_llm
        else:
            out["travel"] = build_travel_fallback(out.get("name") or title, out.get("address"))


        # Cache aggressively for images, but avoid caching missing hours for long
        if out.get("opening_hours") or include_images_n > 0:
            ttl = 3600 if include_images_n == 0 else 1200
            cache.set(cache_key, out, ttl)

        return Response(out, status=status.HTTP_200_OK)
    
    def sealion_generate_about(
        self,
        *,
        name: str,
        kinds: str | None,
        description: str | None,
        address: str | None,
        opening_hours: str | None,
        website: str | None,
        context: dict | None = None,
    ):

        """
        Calls SeaLion LLM to generate structured About payload.
        Returns dict or None on failure.
        """

        api_key = os.getenv("SEALION_API_KEY")
        base_url = os.getenv("SEALION_BASE_URL") or "https://api.sea-lion.ai/v1"
        enabled_env = os.getenv("SEALION_ENABLED")
        enabled = (enabled_env.lower() == "true") if enabled_env else bool(api_key)

        if not enabled or not api_key or not base_url:
            logger.warning(
                "Sealion about disabled or missing config (enabled=%s, has_key=%s, base_url=%s)",
                enabled, bool(api_key), bool(base_url)
            )
            return None

        system_prompt = (
            "You generate an 'About' section for a travel itinerary place.\n"
            "Return ONLY valid JSON with keys: why_go, know_before_you_go, best_time, getting_there, tips.\n"
            "Rules:\n"
            "- Do NOT hallucinate specific prices, events, or exact opening times.\n"
            "- You MAY infer general advice from place type (temple/shopping district/market/museum/park).\n"
            "- Use the provided 'nearby_wikipedia_titles' to identify the canonical place name if needed.\n"
            "- Bullets must be short (<= 1 sentence each).\n"
            "- why_go: 3-4 bullets\n"
            "- know_before_you_go: 2-4 bullets\n"
            "- tips: 2-4 bullets\n"
            "- best_time can be a short phrase or null.\n"
            "- getting_there should be based on address if provided; otherwise null.\n"
        )

        ctx = context or {}

        user_prompt = {
            "name": name,
            "kinds": kinds,
            "description": description,
            "address": address,
            "opening_hours": opening_hours,
            "website": website,
            "nearby_wikipedia_titles": ctx.get("nearby_wikipedia_titles") or [],
            "city": ctx.get("city"),
            "lat": ctx.get("lat"),
            "lon": ctx.get("lon"),
            "task": "Generate About bullets using name/address/nearby titles even if Wikipedia extract is missing."
        }

        about_model = (
            os.getenv("SEALION_ABOUT_MODEL")
            or os.getenv("SEALION_TRAVEL_MODEL")
            or os.getenv("SEA_LION_MODEL")
            or "aisingapore/Llama-SEA-LION-v3-70B-IT"
        )

        payload = {
            "model": about_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt)},
            ],
            # Use json_object to avoid schema errors on the service
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
            "max_tokens": 500,
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            r = requests.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=12,
            )
            if r.status_code != 200:
                logger.error("Sealion about failed: status=%s body=%s", r.status_code, r.text[:400])
                return None

            data = r.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content")
            )

            if not content:
                logger.error("Sealion about returned empty content")
                return None

            # robust JSON parse (Sealion sometimes wraps JSON in text)
            try:
                parsed = json.loads(content)
            except Exception as exc:
                logger.error("Sealion about JSON parse failed: %s", exc)
                m = re.search(r"\{.*\}", content, flags=re.DOTALL)
                if not m:
                    logger.error("Sealion about could not find JSON object in content preview=%s", content[:200])
                    return None
                try:
                    parsed = json.loads(m.group(0))
                except Exception as exc:
                    logger.error("Sealion about failed to parse extracted JSON: %s", exc)
                    return None

            # minimal validation
            if not isinstance(parsed, dict):
                logger.error("Sealion about parsed non-dict response")
                return None

            return parsed

        except Exception as exc:
            logger.error("Sealion about exception: %s", exc)
            return None
        
    def sealion_generate_travel(
        self,
        *,
        place_name: str,
        address: str | None,
        city: str | None,
        country: str | None,
        trip_start: str | None,
        trip_end: str | None,
        opening_hours: str | None,
        website: str | None,
    ):
        """
        Global Travel generator (no country map).
        Forces SeaLion to be specific for ANY country, but never invent exact opening hours.
        """
        api_key = os.getenv("SEALION_API_KEY")
        base_url = os.getenv("SEALION_BASE_URL") or "https://api.sea-lion.ai/v1"
        enabled_env = os.getenv("SEALION_ENABLED")
        enabled = (enabled_env.lower() == "true") if enabled_env else bool(api_key)
        if not enabled or not api_key or not base_url:
            logger.warning(
                "Sealion travel disabled or missing config (enabled=%s, has_key=%s, base_url=%s)",
                enabled, bool(api_key), bool(base_url)
            )
            return None

        system_prompt = (
            "You generate Travel Information & Localisation for a trip itinerary place.\n"
            "Return ONLY valid JSON with keys:\n"
            "transport_systems (array), currency_exchange (array), holidays_and_crowds (array), attraction_info (array).\n\n"
            "Rules (very important):\n"
            "1) Be SPECIFIC for the given country/city. Prefer naming real systems/apps/cards.\n"
            "   - Examples: metro/rail operator names, transit card names, common ride-hailing apps.\n"
            "2) Currency exchange MUST include: currency code + currency name + at least one practical tip.\n"
            "3) Holidays & crowds MUST name at least 2 real public holidays for that country.\n"
            "   - If trip dates are provided, prefer holidays near that window.\n"
            "4) Attraction info:\n"
            "   - If known_opening_hours is provided, you may restate it.\n"
            "   - If NOT provided, DO NOT invent exact opening times.\n"
            "   - You MAY give location-specific constraints (e.g., altitude, weather, reservations, last train patterns).\n"
            "5) If you are unsure about an exact proper noun, you MUST still provide a helpful near-equivalent.\n"
            "   - Example: say 'the national rail operator / city metro' instead of leaving it generic.\n"
            "6) Keep each bullet <= 2 sentences, practical, and traveler-focused.\n"
            "7) Output 3–6 bullets per section.\n"
        ) 

        # Give the model enough context to be concrete
        user_payload = {
            "place_name": place_name,
            "address": address,
            "city": city,
            "country": country,
            "trip_window": {"start": trip_start, "end": trip_end},
            "known_opening_hours": opening_hours,  # may be None
            "official_website": website,           # may be None
            "instruction": (
                "Infer transport systems/apps/currency/holidays for the given country/city. "
                "Do not invent exact opening hours if not provided. "
                "Prefer naming real apps/systems; if unsure, say to confirm locally rather than guessing."
            ),
        }

        expected_schema = {
            "transport_systems": ["string"],
            "currency_exchange": ["string"],
            "holidays_and_crowds": ["string"],
            "attraction_info": ["string"],
        }

        # Prefer a travel-specific model, otherwise fall back to the general SEA_LION_MODEL, then a safe default
        travel_model = (
            os.getenv("SEALION_TRAVEL_MODEL")
            or os.getenv("SEA_LION_MODEL")
            or "aisingapore/Llama-SEA-LION-v3-70B-IT"
        )

        payload = {
            "model": travel_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
            ],
            # LiteLLM expects 'json_object' / 'json_schema'. Keep simple object parsing here.
            "response_format": {"type": "json_object"},
            "temperature": 0.25,
            "max_tokens": 700,
        }

        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        try:
            r = requests.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=14)
            if r.status_code != 200:
                logger.error("Sealion travel failed: status=%s body=%s", r.status_code, r.text[:400])
                return None

            data = r.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            if not content:
                logger.error("Sealion travel returned empty content")
                return None

            try:
                parsed = json.loads(content)
            except Exception as exc:
                logger.error("Sealion travel JSON parse failed: %s", exc)
                m = re.search(r"\{.*\}", content, flags=re.DOTALL)
                if not m:
                    logger.error("Sealion travel could not find JSON object in content preview=%s", content[:200])
                    return None
                parsed = json.loads(m.group(0))

            if not isinstance(parsed, dict):
                logger.error("Sealion travel parsed non-dict response")
                return None

            # Ensure lists
            for k in ["transport_systems", "currency_exchange", "holidays_and_crowds", "attraction_info"]:
                v = parsed.get(k)
                if v is None:
                    parsed[k] = []
                elif not isinstance(v, list):
                    parsed[k] = []

            # Safety: if it "invented" exact hours while we provided none, remove them lightly
            if not opening_hours and parsed.get("attraction_info"):
                cleaned = []
                for line in parsed["attraction_info"]:
                    if isinstance(line, str) and re.search(r"\b\d{1,2}(:\d{2})?\s?(am|pm)\b", line, flags=re.I):
                        # replace with a safer variant
                        cleaned.append("Check the official listing for today’s opening hours and last entry time.")
                    else:
                        cleaned.append(line)
                parsed["attraction_info"] = cleaned

            return parsed
        except Exception as exc:
            logger.error("Sealion travel exception: %s", exc)
            return None