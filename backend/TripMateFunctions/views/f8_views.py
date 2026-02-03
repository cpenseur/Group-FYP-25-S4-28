from .base_views import BaseViewSet
from ..models import AppUser, Trip, DestinationFAQ, DestinationQA, SupportTicket, CommunityFAQ, GeneralFAQ
from ..serializers.f8_serializers import (
    F8AdminUserSerializer,
    F8AdminTripSerializer,
    F8AdminDestinationFAQSerializer,
    F8AdminDestinationQASerializer,
    F8SupportTicketSerializer,
    F8CommunityFAQSerializer,
    F8GeneralFAQSerializer,
)

from datetime import datetime, timedelta, time

from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate, Coalesce, NullIf, Trim
from django.db.models import Value
from django.db.models import TextField

from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny
from TripMateFunctions.permissions import IsAppAdmin
from rest_framework.response import Response


class F8AdminUserViewSet(BaseViewSet):
    queryset = AppUser.objects.all()
    serializer_class = F8AdminUserSerializer


class F8AdminTripViewSet(BaseViewSet):
    queryset = Trip.objects.all()
    serializer_class = F8AdminTripSerializer

    @action(detail=True, methods=["patch"], permission_classes=[IsAppAdmin])
    def moderate(self, request, pk=None):
        """
        PATCH /api/admin/trips/{id}/moderate/
        Body: { "status": "APPROVED" } or { "status": "REJECTED" }
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
    active_users_prev_total = AppUser.objects.filter(
        last_active_at__gte=prev_start_dt,
        last_active_at__lt=prev_end_dt,
    ).count()

    qs = (
        AppUser.objects
        .filter(updated_at__gte=start_dt, updated_at__lt=end_dt)
        .annotate(day=TruncDate("updated_at"))
        .values("day")
        .annotate(cnt=Count("id"))
        .order_by("day")
    )
    by_day = {row["day"]: row["cnt"] for row in qs}
    active_users_series = [int(by_day.get(start_date + timedelta(days=i), 0)) for i in range(days)]

    return Response({
        "active_users": active_users,
        "new_signups": new_signups,
        "avg_session_length_min": 7.4,
        "itineraries_created": itineraries_created,
        "total_users": total_users,
        "total_itineraries": total_itineraries,
        "active_users_series": active_users_series,
        "active_users_prev_total": active_users_prev_total,
        "country_stats": country_stats,
        "popular_itineraries": popular_itineraries,
    })

@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_report_preview(request):
    rtype = request.GET.get("type")
    from_str = request.GET.get("from")
    to_str = request.GET.get("to")

    if not rtype or not from_str or not to_str:
        return Response({"detail": "Missing type/from/to"}, status=400)

    start_date = _parse_yyyy_mm_dd(from_str)
    end_date = _parse_yyyy_mm_dd(to_str)

    start_dt = timezone.make_aware(datetime.combine(start_date, time.min))
    end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min))

    if rtype == "user_activity":
        active_users = AppUser.objects.filter(last_active_at__gte=start_dt, last_active_at__lt=end_dt).count()
        new_signups = AppUser.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()
        itineraries_created = Trip.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()
        pending_verifications = AppUser.objects.filter(status=AppUser.Status.PENDING, created_at__gte=start_dt, created_at__lt=end_dt).count()

        return Response({
            "heading": "User Activity\nReport",
            "cards": [
                {"label": "Active\nUsers", "value": str(active_users), "tone": "neutral"},
                {"label": "New\nSignups", "value": str(new_signups), "tone": "neutral"},
                {"label": "Itineraries\nCreated", "value": str(itineraries_created), "tone": "neutral"},
                {"label": "Pending\nVerifications", "value": str(pending_verifications), "tone": "warn" if pending_verifications > 0 else "neutral"},
            ],
            "note": "Active users, signups,\nand engagement metrics",
        })

    if rtype == "itinerary_stats":
        itineraries_created = Trip.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()

        top = (
            Trip.objects
            .filter(created_at__gte=start_dt, created_at__lt=end_dt)
            .exclude(main_country__isnull=True)
            .exclude(main_country__exact="")
            .values("main_country")
            .annotate(cnt=Count("id"))
            .order_by("-cnt")
            .first()
        )
        top_country = top["main_country"] if top else "-"

        return Response({
            "heading": "Itinerary\nStatistics",
            "cards": [
                {"label": "Itineraries\nCreated", "value": str(itineraries_created), "tone": "neutral"},
                {"label": "Top\nCountry", "value": str(top_country), "tone": "neutral"},
            ],
            "note": "Created itineraries,\npopular destinations,\nand trends",
        })

    if rtype == "content_moderation":
        flagged = Trip.objects.filter(is_flagged=True, created_at__gte=start_dt, created_at__lt=end_dt).count()
        approved = Trip.objects.filter(moderation_status="APPROVED", moderated_at__gte=start_dt, moderated_at__lt=end_dt).count()

        return Response({
            "heading": "Content\nModeration\nReport",
            "cards": [
                {"label": "Flagged", "value": str(flagged), "tone": "warn"},
                {"label": "Approved", "value": str(approved), "tone": "good"},
            ],
            "note": "Flagged content,\napprovals,\nand rejections",
        })

    if rtype == "growth_analytics":
        new_signups = AppUser.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()
        itineraries_created = Trip.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()

        return Response({
            "heading": "Growth\nAnalytics",
            "cards": [
                {"label": "New\nUsers", "value": str(new_signups), "tone": "good"},
                {"label": "New\nItineraries", "value": str(itineraries_created), "tone": "good"},
            ],
            "note": "Growth across key metrics",
        })

    return Response({"detail": f"Unknown type: {rtype}"}, status=400)
