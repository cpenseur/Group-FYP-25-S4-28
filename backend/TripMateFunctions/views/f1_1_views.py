# backend/TripMateFunctions/views/f1_1_views.py
import os
import difflib
import requests
import logging
import re
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
            t = quote(place_title.replace(" ", "_"))
            url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{t}"
            r = safe_get(url, timeout=10, headers=WIKI_HEADERS)
            if not r or r.status_code != 200:
                return None
            try:
                return r.json()
            except Exception:
                return None

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


        # 3) Wikipedia via GEOSEARCH (fixes wrong page selection)
        include_images = True

        geo = wiki_geosearch(item.lat, item.lon, radius_m=12000, limit=10)
        best_title = pick_best_wiki_title(title, geo)

        if include_images:
            # Build a strong query: use Wikipedia title if available, else itinerary title
            commons_query = None
            if best_title:
                commons_query = best_title
            elif title:
                commons_query = title

            gallery = commons_scenic_images(best_title or title, limit=12)

            # ensure primary image is first
            if out["image_url"] and out["image_url"] not in gallery:
                gallery = [out["image_url"]] + gallery

            out["images"] = gallery

        # fallback if geosearch returns nothing
        if not best_title and title:
            best_title = title

        if best_title:
            wiki = wiki_summary(best_title)
            if wiki:
                out["description"] = wiki.get("extract") or out["description"]
                out["image_url"] = (wiki.get("thumbnail") or {}).get("source") or out["image_url"]
                out["wikipedia"] = (((wiki.get("content_urls") or {}).get("desktop") or {}).get("page")) or out["wikipedia"]
                wiki_desc = (wiki.get("description") or "").strip()
                out["kinds"] = out["kinds"] or (wiki_desc if wiki_desc else None)
                out["source"] = "wikipedia"

        # ----------------------------
        # About payload 
        # ----------------------------
        def build_about_payload(name: str, kinds: str | None, address: str | None):
            k = (kinds or "").lower()
            n = (name or "this place").strip()

            why_go = []
            know = []
            tips = []

            # light categorization based on keywords
            if any(x in k for x in ["mountain", "peak", "alp", "glacier", "viewpoint", "ridge"]):
                why_go = ["Iconic alpine views", "Great for photos and panoramas", "Memorable high-altitude experience"]
                know = ["Weather changes fast — bring layers", "Visibility can vary (clouds)", "Higher altitude may feel tiring"]
                tips = ["Go early for clearer skies", "Check forecast before you go", "Pack a warm layer even in summer"]
                best_time = "Morning (best visibility)"
            elif any(x in k for x in ["lake", "river", "waterfall", "gorge"]):
                why_go = ["Scenic waterside views", "Relaxing stop to slow down", "Great spot for photos"]
                know = ["Paths can be slippery when wet", "Crowds peak midday in summer", "Some viewpoints are seasonal"]
                tips = ["Wear shoes with grip", "Visit off-peak hours", "Bring a light rain layer"]
                best_time = "Late afternoon (soft light)"
            elif any(x in k for x in ["museum", "gallery", "historic", "monument", "castle", "church"]):
                why_go = ["Good cultural/heritage stop", "Nice indoor break option", "Easy add-on near town centers"]
                know = ["Check opening hours (vary by season)", "Some sites use timed entry", "Quietest on weekday mornings"]
                tips = ["Buy tickets online if available", "Arrive early to avoid queues", "Check for closures/renovations"]
                best_time = "Weekday morning"
            else:
                why_go = [f"Popular highlight around {n}", "Great for photos and views", "Easy to add to most itineraries"]
                know = ["Peak times can be crowded", "Weather may affect the experience", "Wear comfortable shoes"]
                tips = ["Go early for the best light", "Check weather (views vary)", "Avoid peak hours if possible"]
                best_time = "Morning or late afternoon"

            getting_there = f"Navigate to: {address}" if address else None

            return {
                "why_go": why_go[:4],
                "know_before_you_go": know[:4],
                "getting_there": getting_there,
                "best_time": best_time,
                "tips": tips[:4],
            }

        # Attach to response
        out["about"] = build_about_payload(
            out.get("name") or title or "Place",
            out.get("kinds"),
            out.get("address"),
        )


        return Response(out, status=status.HTTP_200_OK)
