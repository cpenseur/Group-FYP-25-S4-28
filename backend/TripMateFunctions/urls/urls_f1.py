from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views.f1_1_views import TripViewSet, TripDayViewSet, ItineraryItemViewSet
from ..views.f1_2_views import F12RouteOptimizationView, F12FullTripRouteOptimizationView
from ..views.f1_3_views import (
    F13AITripGeneratorView, 
    F13AIChatbotView, 
    F13SaveTripPreferenceView, 
    F13SoloAITripGenerateCreateView,
    F13GroupPreferencesListView,
)
# Import the real view from f2_2_views
from ..views.f2_2_views import F22GroupTripGeneratorView

from ..views.f1_4_views import F14AdaptivePlanningView
from ..views.f1_5_views import F15AIRecommendationsSidebarView
from ..views.f1_6_views import F16DestinationFAQView
from ..views.email_invitation_views import SendTripInvitationView 
from ..views.accept_invitation_views import AcceptTripInvitationView

# Import Recommendations Page views
from ..views.recommendations_views import (
    DestinationInfoView,
    FeaturedGuidesView,
    PopularDestinationsView,
    SaveGuideView,
    UnsaveGuideView,
    SaveDestinationView,
    UnsaveDestinationView,
)


router = DefaultRouter()

# F1.1 - Interactive Itinerary Planner
router.register(r"trips", TripViewSet, basename="trip")
router.register(r"trip-days", TripDayViewSet, basename="trip-day")
router.register(r"itinerary-items", ItineraryItemViewSet, basename="itinerary-item")

urlpatterns = [
    # F1.2 - Route Optimization
    path(
        "route-optimize/",
        F12RouteOptimizationView.as_view(),
        name="f1-route-optimize",
    ),
    path(
        "route-optimize-full/",
        F12FullTripRouteOptimizationView.as_view(),
        name="f1-route-optimize-full",
    ),

    # F1.3 - AI Trip Generator & Chatbot
    path(
        "ai-trip-generator/",
        F13AITripGeneratorView.as_view(),
        name="f1-ai-trip-generator",
    ),
    path(
        "ai-chatbot/",
        F13AIChatbotView.as_view(),
        name="f1-ai-chatbot",
    ),
    path(
        "trips/<int:trip_id>/preferences/",
        F13SaveTripPreferenceView.as_view(),
        name="f13-save-trip-preferences",
    ),
    path(
        "trips/<int:trip_id>/group-preferences/",     
        F13GroupPreferencesListView.as_view(),       
        name="f13-group-preferences-list",         
    ),
    # Use F22GroupTripGeneratorView instead of F13GenerateGroupItineraryView
    path(
        "trips/<int:trip_id>/generate-group-itinerary/",  
        F22GroupTripGeneratorView.as_view(),        # ← Changed here!
        name="f13-generate-group-itinerary",           
    ),
    path(   
        "ai-solo-trip/",
        F13SoloAITripGenerateCreateView.as_view(),
        name="f1-ai-solo-trip",
    ),
    path(
        "trips/<int:trip_id>/invite/",
        SendTripInvitationView.as_view(),
        name="send-trip-invitation",
    ),
    path(
        "trip-invitation/<str:token>/accept/", 
        AcceptTripInvitationView.as_view(),
        name="accept-trip-invitation",
    ),

    # F1.4 - Adaptive AI Planning
    path(
        "adaptive-plan/",
        F14AdaptivePlanningView.as_view(),
        name="f1-adaptive-plan",
    ),

    # ================================================================
    # F1.5 - AI Recommendations Sidebar & Recommendations Page
    # ================================================================
    
    # F1.5a - AI Recommendations Sidebar (Real-time context-aware suggestions)
    path(
        "sidebar-suggestions/",
        F15AIRecommendationsSidebarView.as_view(),
        name="f15-sidebar-suggestions",
    ),
    
    # F1.5b - Recommendations Page (Featured guides & destinations)
    path(
        "recommendations/destination-info/",
        DestinationInfoView.as_view(),
        name="f15-destination-info",
    ),
    path(
        "recommendations/featured-guides/",
        FeaturedGuidesView.as_view(),
        name="f15-featured-guides",
    ),
    path(
        "recommendations/popular-destinations/",
        PopularDestinationsView.as_view(),
        name="f15-popular-destinations",
    ),
    path(
        "recommendations/save-guide/",
        SaveGuideView.as_view(),
        name="f15-save-guide",
    ),
    path(
        "recommendations/unsave-guide/",
        UnsaveGuideView.as_view(),
        name="f15-unsave-guide",
    ),
    path(
        "recommendations/save-destination/",
        SaveDestinationView.as_view(),
        name="f15-save-destination",
    ),
    path(
        "recommendations/unsave-destination/",
        UnsaveDestinationView.as_view(),
        name="f15-unsave-destination",
    ),

    # F1.6 - Destination FAQ
    path(
        "destination-faq/",
        F16DestinationFAQView.as_view(),
        name="f1-destination-faq",
    ),
]

# Include router-generated URLs
urlpatterns += router.urls