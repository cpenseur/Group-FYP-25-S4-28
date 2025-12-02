from .base_views import BaseViewSet
from ..models import Checklist, ChecklistItem
from ..serializers.f3_2_serializers import (
    F32ChecklistSerializer,
    F32ChecklistItemSerializer,
)


class F32ChecklistViewSet(BaseViewSet):
    queryset = Checklist.objects.all()
    serializer_class = F32ChecklistSerializer


class F32ChecklistItemViewSet(BaseViewSet):
    queryset = ChecklistItem.objects.all()
    serializer_class = F32ChecklistItemSerializer
