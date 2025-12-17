# backend/TripMateFunctions/urls/urls_f1.py
from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views.f1_1_views import TripViewSet, TripDayViewSet, ItineraryItemViewSet
from ..views.f1_2_views import F12RouteOptimizationView, F12FullTripRouteOptimizationView
from ..views.f1_3_views import F13AITripGeneratorView, F13AIChatbotView, F13SoloAITripGenerateCreateView
from ..views.f1_4_views import F14AdaptivePlanningView
from ..views.f1_5_views import F15AIRecommendationsSidebarView
from ..views.f1_6_views import F16DestinationFAQView

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
        "ai-solo-trip/",
        F13SoloAITripGenerateCreateView.as_view(),
        name="f1-ai-solo-trip",
    ),

    # F1.4 - Adaptive AI Planning
    path(
        "adaptive-plan/",
        F14AdaptivePlanningView.as_view(),
        name="f1-adaptive-plan",
    ),

    # F1.5 - AI Recommendations Sidebar
    path(
        "sidebar-suggestions/",
        F15AIRecommendationsSidebarView.as_view(),
        name="f1-sidebar-suggestions",
    ),

    # F1.6 - Destination FAQ
    path(
        "destination-faq/",
        F16DestinationFAQView.as_view(),
        name="f1-destination-faq",
    ),
]

# Include router-generated URLs (includes /trips/, /trips/<id>/overview/, etc.)
urlpatterns += router.urls
