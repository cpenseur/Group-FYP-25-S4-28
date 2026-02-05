from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views.f8_views import (
    F8AdminUserViewSet,
    F8AdminTripViewSet,
    F8AdminDestinationFAQViewSet,
    F8AdminDestinationQAViewSet,
    F8SupportTicketViewSet,
    F8CommunityFAQViewSet,
    F8GeneralFAQViewSet,
    admin_analytics,
    admin_report_preview,
    F8AdminCommunityFAQViewSet
)

router = DefaultRouter()
router.register(r"users", F8AdminUserViewSet, basename="f8-user")
router.register(r"trips", F8AdminTripViewSet, basename="f8-trip")
router.register(r"destination-faqs", F8AdminCommunityFAQViewSet, basename="f8-community-faqs")
router.register(r"destination-qas", F8AdminDestinationQAViewSet, basename="f8-destination-qa")
router.register(r"support-tickets", F8SupportTicketViewSet, basename="f8-support-ticket")
router.register(r"community-faqs", F8CommunityFAQViewSet, basename="f8-community-faq")
router.register(r"general-faqs", F8GeneralFAQViewSet, basename="f8-general-faq")

urlpatterns = [
    *router.urls,
    path("analytics/", admin_analytics, name="admin-analytics"),
    path("reports/preview/", admin_report_preview, name="admin-report-preview"),
]
