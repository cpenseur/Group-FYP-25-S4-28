from rest_framework.routers import DefaultRouter
from ..views.f5_1_views import F51TripPhotoViewSet
from ..views.f5_2_views import (
    F52TripMediaHighlightViewSet,
    F52TripHistoryEntryViewSet,
)

router = DefaultRouter()

# F5.1
router.register(r"photos", F51TripPhotoViewSet, basename="f5-photo")

# F5.2
router.register(r"highlights", F52TripMediaHighlightViewSet, basename="f5-highlight")
router.register(r"history", F52TripHistoryEntryViewSet, basename="f5-history")

urlpatterns = router.urls
