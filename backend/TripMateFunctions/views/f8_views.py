from .base_views import BaseViewSet
from ..models import AppUser, Trip, DestinationFAQ, DestinationQA, SupportTicket, CommunityFAQ
from ..serializers.f8_serializers import (
    F8AdminUserSerializer,
    F8AdminTripSerializer,
    F8AdminDestinationFAQSerializer,
    F8AdminDestinationQASerializer,
    F8SupportTicketSerializer,
    F8AdminCommunityFAQSerializer,
)
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.db.models import Count
from django.db.models.functions import TruncDate
from datetime import datetime, timedelta, time
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework import status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


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
    active_users = AppUser.objects.filter(updated_at__gte=start_dt, updated_at__lt=end_dt).count()

    # Previous period total active users (for % change)
    active_users_prev_total = AppUser.objects.filter(
        updated_at__gte=prev_start_dt,
        updated_at__lt=prev_end_dt
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

class F8AdminCommunityFAQViewSet(BaseViewSet):
    """
    ViewSet for managing Community FAQs
    Endpoint: /api/f8/destination-faqs/
    """
    queryset = CommunityFAQ.objects.all()
    serializer_class = F8AdminCommunityFAQSerializer

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
