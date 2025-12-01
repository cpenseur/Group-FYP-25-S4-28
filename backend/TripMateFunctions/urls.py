from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AppUserViewSet,
    TripViewSet,
    TripDayViewSet,
    ItineraryItemViewSet,
    TripBudgetViewSet,
    TripExpenseViewSet,
    ChecklistViewSet,
    ChecklistItemViewSet,
    TravelDocumentViewSet,
    TripPhotoViewSet,
    DestinationViewSet,
    DestinationFAQViewSet,
    DestinationQAViewSet,
    CountryInfoViewSet,
)

router = DefaultRouter()
router.register(r"users", AppUserViewSet)
router.register(r"trips", TripViewSet)
router.register(r"trip-days", TripDayViewSet)
router.register(r"items", ItineraryItemViewSet)
router.register(r"trip-budgets", TripBudgetViewSet)
router.register(r"expenses", TripExpenseViewSet)
router.register(r"checklists", ChecklistViewSet)
router.register(r"checklist-items", ChecklistItemViewSet)
router.register(r"documents", TravelDocumentViewSet)
router.register(r"photos", TripPhotoViewSet)
router.register(r"destinations", DestinationViewSet)
router.register(r"destination-faqs", DestinationFAQViewSet)
router.register(r"destination-qa", DestinationQAViewSet)
router.register(r"countries", CountryInfoViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
