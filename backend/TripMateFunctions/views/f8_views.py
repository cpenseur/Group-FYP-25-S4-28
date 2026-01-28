from .base_views import BaseViewSet
from ..models import AppUser, Trip, DestinationFAQ, DestinationQA, SupportTicket
from ..serializers.f8_serializers import (
    F8AdminUserSerializer,
    F8AdminTripSerializer,
    F8AdminDestinationFAQSerializer,
    F8AdminDestinationQASerializer,
    F8SupportTicketSerializer,
)
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate
from datetime import datetime, timedelta, time
from rest_framework.decorators import api_view,  permission_classes, action
from rest_framework.permissions import AllowAny
from TripMateFunctions.permissions import IsAppAdmin
from rest_framework.response import Response
from ..models import AppUser, Trip


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
            return Response(
                {"detail": "status must be APPROVED or REJECTED"},
                status=400
            )

        trip.moderation_status = status_val
        trip.moderated_at = timezone.now()
        trip.moderated_by_auth_user_id = getattr(request.user, "auth_user_id", None)

        if status_val == "APPROVED":
            # resolve the flag
            trip.is_flagged = False

        if status_val == "REJECTED":
            trip.visibility = "private"  # change to your app’s “removed” if you have one

        trip.save(update_fields=[
            "moderation_status",
            "moderated_at",
            "moderated_by_auth_user_id",
            "is_flagged",
            "visibility",
        ])

        # Return updated trip (serializer) OR just fields
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

    # current period [start_dt, end_dt)
    start_dt = timezone.make_aware(datetime.combine(start_date, time.min))
    end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min))

    days = (end_date - start_date).days + 1
    if days <= 0:
        return Response({"detail": "to must be >= from"}, status=400)

    # previous period with same number of days
    prev_end_dt = start_dt
    prev_start_dt = prev_end_dt - timedelta(days=days)

    new_signups = AppUser.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()
    itineraries_created = Trip.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()

    total_users = AppUser.objects.count()
    total_itineraries = Trip.objects.count()

    # Total active users for current period (same definition you used)
    active_users = AppUser.objects.filter(last_active_at__gte=start_dt, last_active_at__lt=end_dt).count()

    # Previous period total active users (for % change)
    active_users_prev_total = AppUser.objects.filter(
        last_active_at__gte=prev_start_dt,
        last_active_at__lt=prev_end_dt,
    ).count()

    # ---- Daily series (bucket by day) ----
    qs = (
        AppUser.objects
        .filter(updated_at__gte=start_dt, updated_at__lt=end_dt)
        .annotate(day=TruncDate("updated_at"))
        .values("day")
        .annotate(cnt=Count("id"))
        .order_by("day")
    )
    by_day = {row["day"]: row["cnt"] for row in qs}

    active_users_series = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        active_users_series.append(int(by_day.get(d, 0)))

    return Response({
        "active_users": active_users,
        "new_signups": new_signups,
        "avg_session_length_min": 7.4,
        "itineraries_created": itineraries_created,
        "total_users": total_users,
        "total_itineraries": total_itineraries,
        "active_users_series": active_users_series,
        "active_users_prev_total": active_users_prev_total,
    })

@api_view(["GET"])
@permission_classes([IsAppAdmin])
def admin_report_preview(request):
    print("USER CLASS", type(request.user))
    print("USER DICT", getattr(request.user, "__dict__", None))
    rtype = request.GET.get("type")
    from_str = request.GET.get("from")
    to_str = request.GET.get("to")

    if not rtype or not from_str or not to_str:
        return Response({"detail": "Missing type/from/to"}, status=400)

    start_date = _parse_yyyy_mm_dd(from_str)
    end_date = _parse_yyyy_mm_dd(to_str)

    start_dt = timezone.make_aware(datetime.combine(start_date, time.min))
    end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min))

    # ---- build preview payload based on rtype ----
    if rtype == "user_activity":
        active_users = AppUser.objects.filter(last_active_at__gte=start_dt, last_active_at__lt=end_dt).count()
        new_signups = AppUser.objects.filter(created_at__gte=start_dt, created_at__lt=end_dt).count()

        return Response({
            "heading": "User Activity\nReport",
            "cards": [
                {"label": "Active\nUsers", "value": str(active_users), "tone": "neutral"},
                {"label": "New\nSignups", "value": str(new_signups), "tone": "neutral"},
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
        # simple example: new signups + itineraries
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
