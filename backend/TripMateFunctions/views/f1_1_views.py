# backend/TripMateFunctions/views/f1_1_views.py
import os
import difflib
import requests
import logging
import re
import json
from urllib.parse import quote
from django.db.models import F
from django.db import models
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import exceptions
from rest_framework.permissions import IsAuthenticated
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.utils.dateparse import parse_date
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.conf import settings

from ..models import AppUser, Trip, TripDay, ItineraryItem, TripCollaborator
from ..serializers.f1_1_serializers import (
    TripSerializer,
    TripDaySerializer,
    ItineraryItemSerializer,
    TripOverviewSerializer,
    TripCollaboratorInviteSerializer,
)
from .base_views import BaseViewSet

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
        # Optional but recommended
        if self.action == "list":
            return TripOverviewSerializer
        return TripSerializer

    def perform_create(self, serializer):
        user = getattr(self.request, "user", None)

        if not isinstance(user, AppUser):
            raise exceptions.NotAuthenticated("You must be logged in to create a trip.")

        # Save trip and keep instance
        trip = serializer.save(owner=user)

        # Ensure owner exists as a TripCollaborator row
        TripCollaborator.objects.get_or_create(
            trip=trip,
            user=user,
            defaults={
                "role": TripCollaborator.Role.OWNER,
                "status": TripCollaborator.Status.ACTIVE,
                "accepted_at": timezone.now(),
            },
        )


        # Auto-create TripDay rows so itinerary shows empty days immediately
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

        # basic access control: only owner can invite (simple + safe)
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
        send_mail(
            subject="You're invited to a Trip on TripMate ✈️",
            message=(
                f"You've been invited to join a trip.\n\n"
                f"Click the link below to accept the invite:\n"
                f"{invite_url}\n\n"
                f"If you didn’t expect this, you can ignore this email."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

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

        # Let DRF update the Trip first
        response = super().partial_update(request, *args, **kwargs)
        trip.refresh_from_db()

        # Only sync if dates exist (and at least start_date exists)
        if trip.start_date and trip.end_date:
            desired_days = (trip.end_date - trip.start_date).days + 1
            if desired_days < 1:
                desired_days = 1

            qs = TripDay.objects.filter(trip=trip).order_by("day_index")
            existing = qs.count()

            # create missing days
            if desired_days > existing:
                for i in range(existing + 1, desired_days + 1):
                    TripDay.objects.create(
                        trip=trip,
                        day_index=i,
                        date=trip.start_date + timedelta(days=i - 1),
                    )

            # delete extra days (highest day_index first)
            elif desired_days < existing:
                extra = qs.filter(day_index__gt=desired_days)
                extra.delete()  # your FK is SET_NULL, so items become unscheduled

            # now set all dates consistently
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
    """
    Supports:
      - GET /f1/trip-days/?trip=<trip_id>
      - POST /f1/trip-days/     (auto-add next day)
    """
    queryset = TripDay.objects.all().order_by("trip", "day_index")
    serializer_class = TripDaySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            qs = qs.filter(trip_id=trip_id)
        return qs

    def perform_create(self, serializer):
        """
        Auto-append a new day at the end of the trip.
        Rules:
        - day_index = (max existing) + 1
        - date = trip.start_date + (day_index - 1)
        """
        from django.db.models import Max
        from datetime import timedelta
        from django.shortcuts import get_object_or_404

        request = self.request
        trip_id = request.data.get("trip")

        if not trip_id:
            raise ValueError("trip field is required to create a new day")

        trip = get_object_or_404(Trip, pk=trip_id)

        # Determine next day index
        max_index = (
            TripDay.objects.filter(trip=trip)
            .aggregate(Max("day_index"))
            .get("day_index__max") or 0
        )
        next_index = max_index + 1

        # Auto-compute date if trip has a start_date
        date = request.data.get("date")
        if not date and trip.start_date:
            date = trip.start_date + timedelta(days=next_index - 1)

        serializer.save(
            trip=trip,
            day_index=next_index,
            date=date,
        )

    def destroy(self, request, *args, **kwargs):
        """
        DELETE /trip-days/<id>/

        - Deletes the TripDay
        - Re-indexes remaining days for that trip so day_index stays 1..N
        - ItineraryItem.day is already SET_NULL via FK (items become unscheduled)
        """
        instance: TripDay = self.get_object()
        trip = instance.trip
        removed_index = instance.day_index

        # delete this day
        self.perform_destroy(instance)

        # shift all later days up by 1
        TripDay.objects.filter(
            trip=trip,
            day_index__gt=removed_index,
        ).update(day_index=F("day_index") - 1)

        return Response(status=status.HTTP_204_NO_CONTENT)

logger = logging.getLogger(__name__)

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
            "nearby": [],
        }

        # 1a) POI-first (to get category/kinds)
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

            def is_food_market() -> bool:
                return any(w in k for w in ["market", "food", "restaurant", "seafood", "cafe", "bakery"]) or \
                    any(w in d.lower() for w in ["market", "seafood", "stalls", "restaurants", "vendors"])

            def is_temple_shrine() -> bool:
                return (
                    any(w in k for w in ["temple", "shrine", "buddhist", "religion", "place of worship"])
                    or any(w in d.lower() for w in ["temple", "shrine", "buddhist", "senso-ji", "pagoda", "worship"])
                    or any(w in name_l for w in ["temple", "shrine", "kannon"])
                    or any(w in nearby_joined for w in ["sensō-ji", "senso-ji", "kaminarimon", "asakusa shrine"])
                )

            def is_museum_gallery() -> bool:
                return any(w in k for w in ["museum", "gallery", "exhibit"]) or \
                    any(w in d.lower() for w in ["museum", "gallery", "exhibition", "collections"])

            def is_park_nature() -> bool:
                return any(w in k for w in ["park", "garden", "nature", "lake", "mountain", "trail"]) or \
                    any(w in d.lower() for w in ["park", "garden", "lake", "mountain", "trail", "viewpoint"])

            def is_shopping_district() -> bool:
                return (
                    any(w in k for w in ["shopping", "mall", "store", "retail", "commercial"])
                    or any(w in d.lower() for w in ["shopping", "district", "electronics", "stores", "retail"])
                    or any(w in name_l for w in ["district", "shopping", "akihabara"])
                    or "akihabara" in nearby_joined
                )

            def is_station_transport() -> bool:
                return any(w in k for w in ["station", "transit", "metro", "train", "subway"]) or \
                    any(w in d.lower() for w in ["station", "railway", "metro", "subway", "line"])

            place_type = "generic"
            if is_temple_shrine():
                place_type = "temple"
            elif is_museum_gallery():
                place_type = "museum"
            elif is_food_market():
                place_type = "market"
            elif is_park_nature():
                place_type = "nature"
            elif is_shopping_district():
                place_type = "shopping"
            elif is_station_transport():
                place_type = "transport"

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

        # Build richer context for SeaLion even if Wikipedia fails
        nearby_titles = [n.get("name") for n in (out.get("nearby") or []) if n.get("name")]
        city_hint = extract_city_hint(out.get("address"))

        sealion_context = {
            "title": (title or out.get("name") or "").strip(),
            "address": out.get("address"),
            "city": city_hint,
            "country_or_region": "Tokyo Prefecture" if (out.get("address") and "Tokyo" in out.get("address")) else None,
            "mapbox_category": out.get("kinds"),
            "wikipedia_extract": out.get("description"),
            "nearby_wikipedia_titles": nearby_titles[:8],
            "lat": float(item.lat),
            "lon": float(item.lon),
        }

        # -------- About payload (LLM first, fallback deterministic) --------
        about_llm = self.sealion_generate_about(
            name=out.get("name") or title or "Place",
            kinds=out.get("kinds"),
            description=out.get("description"),
            address=out.get("address"),
            opening_hours=out.get("opening_hours"),
            website=out.get("website"),
            context=sealion_context,
        )

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
        base_url = os.getenv("SEALION_BASE_URL")
        enabled = os.getenv("SEALION_ENABLED", "false").lower() == "true"

        if not enabled or not api_key or not base_url:
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

        expected_schema = {
            "why_go": ["string"],
            "know_before_you_go": ["string"],
            "best_time": "string or null",
            "getting_there": "string or null",
            "tips": ["string"]
        }

        payload = {
            "model": "sealion-travel",  # use your actual model name
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_prompt)},
            ],
            "response_format": {
                "type": "json",
                "schema": expected_schema,
            },
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
                return None

            data = r.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content")
            )

            if not content:
                return None

            # robust JSON parse (Sealion sometimes wraps JSON in text)
            try:
                parsed = json.loads(content)
            except Exception:
                m = re.search(r"\{.*\}", content, flags=re.DOTALL)
                if not m:
                    return None
                try:
                    parsed = json.loads(m.group(0))
                except Exception:
                    return None

            # minimal validation
            if not isinstance(parsed, dict):
                return None

            return parsed

        except Exception:
            return None
