from rest_framework import serializers
from ..models import Checklist, ChecklistItem

class F32ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = ["id", "checklist", "label", "is_completed", "sort_order", "due_date"]

class F32ChecklistSerializer(serializers.ModelSerializer):
    items = F32ChecklistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Checklist
        fields = [
            "id",
            "owner",
            "trip",
            "name",
            "description",
            "checklist_type",
            "created_at",
            "updated_at",
            "items",
        ]
        extra_kwargs = {
            "owner": {"read_only": True},  # Set in perform_create, not by client
        }
