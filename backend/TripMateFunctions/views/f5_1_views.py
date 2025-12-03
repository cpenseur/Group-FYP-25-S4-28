from .base_views import BaseViewSet
from ..models import TripPhoto
from ..serializers.f5_1_serializers import F51TripPhotoSerializer


class F51TripPhotoViewSet(BaseViewSet):
    queryset = TripPhoto.objects.all()
    serializer_class = F51TripPhotoSerializer
