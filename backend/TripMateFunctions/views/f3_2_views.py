
from rest_framework import exceptions
from .base_views import BaseViewSet
from ..models import Checklist, ChecklistItem, AppUser
from ..serializers.f3_2_serializers import (
    F32ChecklistSerializer,
    F32ChecklistItemSerializer,
)


class F32ChecklistViewSet(BaseViewSet):
    """
    Endpoints:
      GET  /api/f3/checklists/?trip=<tripId>
      POST /api/f3/checklists/   (expects { trip, name, ... })
    """
    queryset = Checklist.objects.all()
    serializer_class = F32ChecklistSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        trip_id = self.request.query_params.get("trip")

        # filter by trip if provided
        if trip_id:
            qs = qs.filter(trip_id=trip_id)

        # filter by logged-in user if available
        user = getattr(self.request, "user", None)
        if isinstance(user, AppUser):
            qs = qs.filter(owner=user)

        return qs.order_by("-updated_at", "-created_at")

    def perform_create(self, serializer):
        user = getattr(self.request, "user", None)
        if not isinstance(user, AppUser):
            raise exceptions.NotAuthenticated("Login required to create checklist.")
        serializer.save(owner=user)


class F32ChecklistItemViewSet(BaseViewSet):
    """
    Endpoints:
      GET  /api/f3/checklist-items/?checklist=<checklistId>
      POST /api/f3/checklist-items/ (expects { checklist, label, ... })
    """
    queryset = ChecklistItem.objects.all()
    serializer_class = F32ChecklistItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        checklist_id = self.request.query_params.get("checklist")

        if checklist_id:
            qs = qs.filter(checklist_id=checklist_id)

        # Optional: only allow items for user's checklists
        user = getattr(self.request, "user", None)
        if isinstance(user, AppUser):
            qs = qs.filter(checklist__owner=user)

        return qs.order_by("sort_order", "id")
