from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views.f2_1_views import F21RealTimeCoEditingSyncView
from ..views.f2_2_views import F22GroupTripGeneratorView, TripGroupPreferencesAPIView
from ..views.f2_3_views import F23CreateShareLinkView, F23ResolveShareLinkView
from ..views.f2_4_views import (
    F24CommunityTripListView,
    F24CommunityTripDetailView,
    F24SponsoredCountriesView,
    F24FlagTripView,
)
from ..views.f2_5_views import (
    F25CommunityQAListCreateView,
    F25QAUpvoteView,
)
from ..views.f2_6_views import F26ItineraryTemplateCopyView

router = DefaultRouter()
# (No viewsets yet for F2, everything is APIView / generic views)

urlpatterns = [
    # F2.1 - Real-Time Co-Editing sync endpoint
    path(
        "sync/",
        F21RealTimeCoEditingSyncView.as_view(),
        name="f2-sync",
    ),

    # F2.2 - Group Trip Generator
    path(
        "group-trip-generator/",
        F22GroupTripGeneratorView.as_view(),
        name="f2-group-trip-generator",
    ),
    # F2.2 - Group Preferences (Summary page)
    path(
        "trips/<int:trip_id>/preferences/",
        TripGroupPreferencesAPIView.as_view(),
        name="f2-trip-group-preferences",
    ),

    # F2.3 - Sharing Options to View
    path(
        "share/create/",
        F23CreateShareLinkView.as_view(),
        name="f2-share-create",
    ),
    path(
        "share/<str:token>/",
        F23ResolveShareLinkView.as_view(),
        name="f2-share-resolve",
    ),

    # F2.4 - Community Itinerary Discovery
    path(
        "community/",
        F24CommunityTripListView.as_view(),
        name="f2-community-list",
    ),

    # Sponsored Countries List
    path(
        "community/sponsored-countries/",
        F24SponsoredCountriesView.as_view(),
        name="f2-community-sponsored-countries",
    ),

    path(
        "community/<int:pk>/",
        F24CommunityTripDetailView.as_view(),
        name="f2-community-detail",
    ),

    # F2.5 - Community Q&A
    path(
        "community-qa/",
        F25CommunityQAListCreateView.as_view(),
        name="f2-community-qa",
    ),
    path(
        "community-qa/upvote/",
        F25QAUpvoteView.as_view(),
        name="f2-community-qa-upvote",
    ),

    # F2.6 - Itinerary Template Copying
    path(
        "copy-template/",
        F26ItineraryTemplateCopyView.as_view(),
        name="f2-copy-template",
    ),

    # Flag a community itinerary
    path(
        "community/<int:trip_id>/flag/",
        F24FlagTripView.as_view(),
        name="f2-community-flag-trip",
    ),
]

urlpatterns += router.urls
