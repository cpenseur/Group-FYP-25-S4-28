from django.urls import path
from TripMateFunctions.views.sealion_views import SealionTestAPIView

urlpatterns = [
    path("test/", SealionTestAPIView.as_view(), name="test_sealion_api"),
]
