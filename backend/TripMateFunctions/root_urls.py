# backend/TripMateFunctions/root_urls.py
from django.urls import path, include
from .views.auth_views import WhoAmIView

urlpatterns = [
    # Function 1 - Trip planning and smart routing
    path("f1/", include("TripMateFunctions.urls.urls_f1")),

    # Function 2 - Collaboration and Sharing
    path("f2/", include("TripMateFunctions.urls.urls_f2")),

    # Function 3 - Budgeting, Checklists & Notes
    path("f3/", include("TripMateFunctions.urls.urls_f3")),

    # Function 4 - Travel Information & Localisation
    path("f4/", include("TripMateFunctions.urls.urls_f4")),

    # Function 5 - Media & Memories
    path("f5/", include("TripMateFunctions.urls.urls_f5")),

    # Function 6 - Export
    path("f6/", include("TripMateFunctions.urls.urls_f6")),

    # Function 7 - User Access & Onboarding
    path("f7/", include("TripMateFunctions.urls.urls_f7")),

    # Function 8 - Admin Dashboard
    path("f8/", include("TripMateFunctions.urls.urls_f8")),

    # 🔐 Test Supabase-authenticated current user
    path("auth/whoami/", WhoAmIView.as_view(), name="auth-whoami"),
]
