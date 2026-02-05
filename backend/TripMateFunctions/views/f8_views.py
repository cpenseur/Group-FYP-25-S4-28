from .base_views import BaseViewSet
from ..models import AppUser, Trip, DestinationFAQ, DestinationQA, SupportTicket, CommunityFAQ, GeneralFAQ, Profile, UserSession
from ..serializers.f8_serializers import (
    F8AdminUserSerializer,
    F8AdminTripSerializer,
    F8AdminDestinationFAQSerializer,
    F8AdminDestinationQASerializer,
    F8SupportTicketSerializer,
    F8CommunityFAQSerializer,
    F8GeneralFAQSerializer,
)
from ..permissions import IsAppAdmin

from datetime import datetime, timedelta, time

from django.utils import timezone
from django.db.models import Count, Avg
from django.db.models.functions import TruncDate, Coalesce, NullIf, Trim
from django.db.models import Value
from django.db.models import TextField

from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.filters import SearchFilter, OrderingFilter


class F8AdminUserViewSet(BaseViewSet):
    queryset = AppUser.objects.all()
    serializer_class = F8AdminUserSerializer

    # Search & sort support
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["email", "full_name"]
    ordering_fields = ["created_at", "updated_at", "email"]
    ordering = ["-created_at"]


class F8AdminTripViewSet(BaseViewSet):
    queryset = Trip.objects.all()
    serializer_class = F8AdminTripSerializer

    @action(detail=True, methods=["patch"], permission_classes=[IsAppAdmin])
    def moderate(self, request, pk=None):
        """
        PATCH /api/f8/trips/{id}/moderate/
        Body: { "status": "APPROVED" | "REJECTED" }
        Moderate a flagged itinerary.
        """
        trip = self.get_object()

        status_val = request.data.get("status")
        if status_val not in ["APPROVED", "REJECTED"]:
            return Response({"detail": "status must be APPROVED or REJECTED"}, status=400)

        trip.moderation_status = status_val
        trip.moderated_at = timezone.now()
        trip.moderated_by_auth_user_id = getattr(request.user, "auth_user_id", None)

        if status_val == "APPROVED":
            trip.is_flagged = False

        if status_val == "REJECTED":
            trip.visibility = "private"  # change if you have "removed"

        trip.save(update_fields=[
            "moderation_status",
            "moderated_at",
            "moderated_by_auth_user_id",
            "is_flagged",
            "visibility",
        ])

        return Response(self.get_serializer(trip).data, status=200)

    @action(detail=True, methods=["patch"], permission_classes=[IsAppAdmin])
    def toggle_display(self, request, pk=None):
        """
        PATCH /api/f8/trips/{id}/toggle_display/
        Body: { "is_demo": true } or { "is_demo": false }
        Toggle whether this itinerary is displayed on the landing page.
        """
        trip = self.get_object()

        is_demo_val = request.data.get("is_demo")
        if is_demo_val is None:
            return Response({"detail": "is_demo field is required"}, status=400)

        trip.is_demo = bool(is_demo_val)
        trip.save(update_fields=["is_demo"])

        return Response(self.get_serializer(trip).data, status=200)

    @action(detail=True, methods=["patch"], permission_classes=[IsAppAdmin])
    def update_visibility(self, request, pk=None):
        """
        PATCH /api/f8/trips/{id}/update_visibility/
        Body: { "visibility": "private" | "shared" | "public" }
        Update the visibility of an itinerary.
        """
        trip = self.get_object()

        visibility_val = request.data.get("visibility")
        valid_visibilities = ["private", "shared", "public"]
        
        if visibility_val not in valid_visibilities:
            return Response(
                {"detail": f"visibility must be one of: {', '.join(valid_visibilities)}"},
                status=400
            )

        trip.visibility = visibility_val
        trip.save(update_fields=["visibility"])

        return Response(self.get_serializer(trip).data, status=200)


class F8AdminDestinationFAQViewSet(BaseViewSet):
    queryset = DestinationFAQ.objects.all()
    serializer_class = F8AdminDestinationFAQSerializer

    # Search & sort support
    filter_backends = [SearchFilter, OrderingFilter]
    # ✅ Search directly on model fields (not through relationships)
    search_fields = ["country", "category", "question", "answer"]
    ordering_fields = ["country", "category", "created_at", "updated_at"]
    ordering = ["-created_at"]  # Default to newest first

    # 📦 Bulk publish / unpublish
    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk_update(self, request):
        """
        POST /api/f8/destination-faqs/bulk/

        Body:
        {
          "ids": [1, 2, 3],
          "is_published": true
        }
        """
        ids = request.data.get("ids", [])
        is_published = request.data.get("is_published")

        if not isinstance(ids, list) or not ids:
            return Response(
                {"detail": "ids must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if is_published is None:
            return Response(
                {"detail": "is_published is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = DestinationFAQ.objects.filter(id__in=ids).update(
            is_published=bool(is_published)
        )

        return Response(
            {
                "ok": True,
                "updated": updated,
                "is_published": bool(is_published),
            },
            status=status.HTTP_200_OK,
        )


class F8AdminDestinationQAViewSet(BaseViewSet):
    queryset = DestinationQA.objects.all()
    serializer_class = F8AdminDestinationQASerializer


class F8SupportTicketViewSet(BaseViewSet):
    queryset = SupportTicket.objects.all()
    serializer_class = F8SupportTicketSerializer


class F8CommunityFAQViewSet(BaseViewSet):
    queryset = CommunityFAQ.objects.all()
    serializer_class = F8CommunityFAQSerializer


class F8GeneralFAQViewSet(BaseViewSet):
    queryset = GeneralFAQ.objects.all()
    serializer_class = F8GeneralFAQSerializer


def _parse_yyyy_mm_dd(s: str):
    return datetime.strptime(s, "%Y-%m-%d").date()


@api_view(["GET"])
@permission_classes([AllowAny])
def admin_analytics(request):
    from_str = request.GET.get("from")
    to_str = request.GET.get("to")

    if not from_str or not to_str:
        return Response({"detail": "Missing from/to"}, status=400)

    start_date = _parse_yyyy_mm_dd(from_str)
    end_date = _parse_yyyy_mm_dd(to_str)

    days = (end_date - start_date).days + 1
    if days <= 0:
        return Response({"detail": "to must be >= from"}, status=400)

    start_dt = timezone.make_aware(datetime.combine(start_date, time.min))
    end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min))

    prev_end_dt = start_dt
    prev_start_dt = prev_end_dt - timedelta(days=days)

    # ---------- User Demographics (public.profiles) ----------
    profile_total = Profile.objects.count()

    demo_qs = (
        Profile.objects
        .annotate(
            country_key=Coalesce(
                NullIf(Trim("nationality"), Value("", output_field=TextField())),
                NullIf(Trim("location"), Value("", output_field=TextField())),
                Value("Others", output_field=TextField()),
                output_field=TextField(),
            )
        )
        .values("country_key")
        .annotate(cnt=Count("id"))
        .order_by("-cnt")[:5]
    )

    country_stats = []
    for row in demo_qs:
        cnt = int(row["cnt"])
        percent = int(round((cnt * 100.0) / profile_total, 0)) if profile_total > 0 else 0
        country_stats.append({"country": row["country_key"], "percent": percent})

    # ---------- Popular Itineraries (public.trip) ----------
    # ✅ Relaxed: only exclude demo; DO NOT filter out flagged/pending (else it becomes empty)
    trip_base_qs = (
        Trip.objects
        .filter(created_at__gte=start_dt, created_at__lt=end_dt)
        .filter(is_demo=False)
    )
    trip_total = trip_base_qs.count()

    pop_qs = (
        trip_base_qs
        .annotate(
            place_key=Coalesce(
                NullIf(Trim("main_country"), Value("", output_field=TextField())),
                NullIf(Trim("main_city"), Value("", output_field=TextField())),
                Value("Others", output_field=TextField()),
                output_field=TextField(),
            )
        )
        .values("place_key")
        .annotate(cnt=Count("id"))
        .order_by("-cnt")[:5]
    )

    popular_itineraries = []
    for row in pop_qs:
        cnt = int(row["cnt"])
        percent = int(round((cnt * 100.0) / trip_total, 0)) if trip_total > 0 else 0
        popular_itineraries.append({"name": row["place_key"], "percent": percent})

    # ---------- Existing metrics ----------
    new_signups = AppUser.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()
    itineraries_created = Trip.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()

    total_users = AppUser.objects.count()
    total_itineraries = Trip.objects.count()

    active_users = AppUser.objects.filter(last_active_at__gte=start_dt, last_active_at__lt=end_dt).count()
    
    # Previous period total active users (for % change)
    active_users_prev_total = AppUser.objects.filter(
        last_active_at__gte=prev_start_dt,
        last_active_at__lt=prev_end_dt
    ).count()

    qs = (
        AppUser.objects
        .filter(last_active_at__gte=start_dt, last_active_at__lt=end_dt)
        .annotate(day=TruncDate("last_active_at"))
        .values("day")
        .annotate(cnt=Count("id"))
        .order_by("day")
    )
    by_day = {row["day"]: row["cnt"] for row in qs}
    active_users_series = [int(by_day.get(start_date + timedelta(days=i), 0)) for i in range(days)]

    avg_session_length_min = (
        UserSession.objects
        .filter(session_start__gte=start_dt, session_start__lt=end_dt)
        .exclude(duration_sec__isnull=True)
        .aggregate(avg=Avg("duration_sec"))
        .get("avg")
    )
    avg_session_length_min = round((avg_session_length_min or 0) / 60.0, 1)

    return Response({
        "active_users": active_users,
        "new_signups": new_signups,
        "avg_session_length_min": avg_session_length_min,
        "itineraries_created": itineraries_created,
        "total_users": total_users,
        "total_itineraries": total_itineraries,
        "active_users_series": active_users_series,
        "active_users_prev_total": active_users_prev_total,
        "country_stats": country_stats,
        "popular_itineraries": popular_itineraries,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def admin_report_preview(request):
    report_type = (request.GET.get("type") or "user_activity").strip().lower()
    from_str = request.GET.get("from")
    to_str = request.GET.get("to")

    if not from_str or not to_str:
        return Response({"detail": "Missing from/to"}, status=400)

    start_date = _parse_yyyy_mm_dd(from_str)
    end_date = _parse_yyyy_mm_dd(to_str)

    days = (end_date - start_date).days + 1
    if days <= 0:
        return Response({"detail": "to must be >= from"}, status=400)

    start_dt = timezone.make_aware(datetime.combine(start_date, time.min))
    end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min))

    # Base metrics
    new_signups = AppUser.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()
    active_users = AppUser.objects.filter(last_active_at__gte=start_dt, last_active_at__lt=end_dt).count()
    itineraries_created = Trip.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()
    total_users = AppUser.objects.count()
    total_itineraries = Trip.objects.count()
    demo_itineraries = Trip.objects.filter(is_demo=True).count()

    avg_session_length_min = (
        UserSession.objects
        .filter(session_start__gte=start_dt, session_start__lt=end_dt)
        .exclude(duration_sec__isnull=True)
        .aggregate(avg=Avg("duration_sec"))
        .get("avg")
    )
    avg_session_length_min = round((avg_session_length_min or 0) / 60.0, 1)

    # Moderation metrics (date-range scoped)
    approved = Trip.objects.filter(
        moderation_status="APPROVED",
        moderated_at__gte=start_dt,
        moderated_at__lt=end_dt,
    ).count()
    rejected = Trip.objects.filter(
        moderation_status="REJECTED",
        moderated_at__gte=start_dt,
        moderated_at__lt=end_dt,
    ).count()

    # There is no flagged_at field; use updated_at as a best-effort proxy.
    flagged = Trip.objects.filter(
        is_flagged=True,
        updated_at__gte=start_dt,
        updated_at__lt=end_dt,
    ).count()
    pending = Trip.objects.filter(
        is_flagged=True,
        moderation_status__isnull=True,
        updated_at__gte=start_dt,
        updated_at__lt=end_dt,
    ).count()

    # Top destination (simple)
    top_place = (
        Trip.objects
        .filter(created_at__gte=start_dt, created_at__lt=end_dt)
        .annotate(
            place_key=Coalesce(
                NullIf(Trim("main_country"), Value("", output_field=TextField())),
                NullIf(Trim("main_city"), Value("", output_field=TextField())),
                Value("Others", output_field=TextField()),
                output_field=TextField(),
            )
        )
        .values("place_key")
        .annotate(cnt=Count("id"))
        .order_by("-cnt")
        .first()
    )
    top_destination = top_place["place_key"] if top_place else "Others"

    def card(label: str, value: str, tone: str = "neutral"):
        return {"label": label, "value": value, "tone": tone}

    heading_map = {
        "user_activity": "User Activity Report",
        "itinerary_stats": "Itinerary Statistics",
        "content_moderation": "Content Moderation Report",
        "growth_analytics": "Growth Analytics",
    }

    if report_type == "itinerary_stats":
        cards = [
            card("Itineraries\nCreated", str(itineraries_created), "good" if itineraries_created > 0 else "neutral"),
            card("Total\nItineraries", str(total_itineraries), "neutral"),
            card("Top\nDestination", top_destination, "neutral"),
            card("Demo\nItineraries", str(demo_itineraries), "neutral"),
        ]
        note = "Highlights creation volume and destination trends for the selected window."
    elif report_type == "content_moderation":
        cards = [
            card("Flagged\nContent", str(flagged), "warn" if flagged > 0 else "neutral"),
            card("Approved", str(approved), "good" if approved > 0 else "neutral"),
            card("Rejected", str(rejected), "warn" if rejected > 0 else "neutral"),
            card("Pending", str(pending), "warn" if pending > 0 else "neutral"),
        ]
        note = "Tracks moderation actions and outstanding flagged content."
    elif report_type == "growth_analytics":
        cards = [
            card("Total\nUsers", str(total_users), "neutral"),
            card("New\nSignups", str(new_signups), "good" if new_signups > 0 else "neutral"),
            card("Active\nUsers", str(active_users), "good" if active_users > 0 else "neutral"),
            card("Itineraries\nCreated", str(itineraries_created), "good" if itineraries_created > 0 else "neutral"),
        ]
        note = "Snapshot of growth and engagement for the selected window."
    else:
        cards = [
            card("Active\nUsers", str(active_users), "good" if active_users > 0 else "neutral"),
            card("New\nSignups", str(new_signups), "good" if new_signups > 0 else "neutral"),
            card("Avg Session\nLength", f"{avg_session_length_min} min", "neutral"),
            card("Itineraries\nCreated", str(itineraries_created), "neutral"),
        ]
        note = "Summary of user activity and engagement for the selected window."

    return Response({
        "heading": heading_map.get(report_type, "User Activity Report"),
        "cards": cards,
        "note": note,
    })


class F8AdminCommunityFAQViewSet(BaseViewSet):
    """
    ViewSet for managing Community FAQs
    Endpoint: /api/f8/destination-faqs/
    """
    queryset = CommunityFAQ.objects.all()
    serializer_class = F8CommunityFAQSerializer

    # Enable search and ordering
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["country", "category", "question", "answer"]
    ordering_fields = ["country", "category", "created_at", "updated_at", "is_published"]
    ordering = ["-created_at"]  # Default: newest first

    def get_queryset(self):
        """
        Override to add any custom filtering
        """
        queryset = super().get_queryset()
        
        # Filter by published status if query param exists
        is_published = self.request.query_params.get('is_published', None)
        if is_published is not None:
            queryset = queryset.filter(is_published=is_published.lower() == 'true')
        
        # Filter by country if query param exists
        country = self.request.query_params.get('country', None)
        if country and country != 'all':
            queryset = queryset.filter(country=country)
        
        return queryset

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk_update(self, request):
        """
        Bulk publish or unpublish FAQs
        
        POST /api/f8/destination-faqs/bulk/
        
        Request body:
        {
          "ids": [1, 2, 3],
          "is_published": true
        }
        
        Response:
        {
          "ok": true,
          "updated": 3,
          "is_published": true
        }
        """
        ids = request.data.get("ids", [])
        is_published = request.data.get("is_published")

        # Validate input
        if not isinstance(ids, list) or not ids:
            return Response(
                {"detail": "ids must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if is_published is None:
            return Response(
                {"detail": "is_published is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Perform bulk update
        updated = CommunityFAQ.objects.filter(id__in=ids).update(
            is_published=bool(is_published)
        )

        return Response(
            {
                "ok": True,
                "updated": updated,
                "is_published": bool(is_published),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="stats")
    def get_stats(self, request):
        """
        Get FAQ statistics
        
        GET /api/f8/destination-faqs/stats/
        
        Response:
        {
          "total": 150,
          "published": 120,
          "draft": 30,
          "by_country": {...},
          "by_category": {...}
        }
        """
        from django.db.models import Count

        queryset = self.get_queryset()
        
        total = queryset.count()
        published = queryset.filter(is_published=True).count()
        draft = queryset.filter(is_published=False).count()
        
        # Count by country
        by_country = dict(
            queryset.values('country')
            .annotate(count=Count('id'))
            .values_list('country', 'count')
        )
        
        # Count by category
        by_category = dict(
            queryset.values('category')
            .annotate(count=Count('id'))
            .values_list('category', 'count')
        )

        return Response({
            "total": total,
            "published": published,
            "draft": draft,
            "by_country": by_country,
            "by_category": by_category,
        })
