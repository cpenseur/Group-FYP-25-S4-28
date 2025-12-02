from django.urls import path

from ..views.f7_1_views import F71DemoItinerariesView
from ..views.f7_2_views import F72LandingContentView
from ..views.f7_3_views import F73HelpCenterListView

urlpatterns = [
    # F7.1 - Guest & Demo itineraries
    path("demo-itineraries/", F71DemoItinerariesView.as_view(), name="f7-demo-itineraries"),

    # F7.2 - Landing content (optional)
    path("landing-content/", F72LandingContentView.as_view(), name="f7-landing-content"),

    # F7.3 - Help Center / FAQ
    path("help-center/", F73HelpCenterListView.as_view(), name="f7-help-center"),
]
