from rest_framework.routers import DefaultRouter

from ..views.f8_views import (
    F8AdminUserViewSet,
    F8AdminTripViewSet,
    F8AdminDestinationFAQViewSet,
    F8AdminDestinationQAViewSet,
    F8SupportTicketViewSet,
)

router = DefaultRouter()

router.register(r"users", F8AdminUserViewSet, basename="f8-user")
router.register(r"trips", F8AdminTripViewSet, basename="f8-trip")
router.register(r"destination-faqs", F8AdminDestinationFAQViewSet, basename="f8-destination-faq")
router.register(r"destination-qas", F8AdminDestinationQAViewSet, basename="f8-destination-qa")
router.register(r"support-tickets", F8SupportTicketViewSet, basename="f8-support-ticket")

urlpatterns = router.urls
