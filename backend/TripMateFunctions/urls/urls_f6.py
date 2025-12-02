from django.urls import path
from ..views.f6_views import F6ExportPDFView

urlpatterns = [
    path("export-pdf/", F6ExportPDFView.as_view(), name="f6-export-pdf"),
]
