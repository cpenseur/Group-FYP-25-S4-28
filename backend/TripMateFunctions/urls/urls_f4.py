from django.urls import path
from ..views.f4_views import F4LocalInfoView

urlpatterns = [
    path("local-info/", F4LocalInfoView.as_view(), name="f4-local-info"),
]
