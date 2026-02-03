# config/urls.py

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

# ✅ Only import the Supabase-backed "who am I" endpoint
from TripMateFunctions.views.auth_views import WhoAmIView
from TripMateFunctions.views.f8_views import admin_analytics
from TripMateFunctions.views.f1_1_views import ViewTripView, GenerateShareLinkView


urlpatterns = [
    # Django Admin
    path("admin/", admin.site.urls),  
    path('api/trip/<str:trip_id>/view/', ViewTripView.as_view(), name='view-trip'),
    path('api/trip/<str:trip_id>/generate-share-link/', GenerateShareLinkView.as_view(), name='generate-share-link'),
    path("api/admin/analytics/", admin_analytics, name="admin-analytics"),

    # All feature-based API routes
    path("api/", include("TripMateFunctions.root_urls")),

    # Supabase-auth-backed "current user" endpoint
    path("api/auth/whoami/", WhoAmIView.as_view(), name="auth-whoami"),

    # (Optional) Browsable API login/logout (not Supabase auth)
    path("api-auth/", include("rest_framework.urls")),

    # Simple HTML index that lists your API endpoints
    path(
        "",
        TemplateView.as_view(template_name="api_index.html"),
        name="api-index",
    ),

    # SeaLion endpoint (legacy path kept) and AI alias
    path("api/sealion/", include("TripMateFunctions.urls.urls_ai")),
    path("api/ai/", include("TripMateFunctions.urls.urls_ai")),

]

# Serve static/media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)