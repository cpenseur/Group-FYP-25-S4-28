'''from rest_framework import serializers
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
            "owner": {"read_only": True},   # ✅ IMPORTANT
        }'''
from rest_framework import serializers
from ..models import Checklist, ChecklistItem


class F32ChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChecklistItem
        fields = [
            "id",
            "checklist",
            "label",
            "is_completed",
            "sort_order",
            "due_date",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "checklist": {"required": True},
            "label": {"required": True},
        }


class F32ChecklistSerializer(serializers.ModelSerializer):
    # owner is set from request.user in perform_create()
    owner = serializers.PrimaryKeyRelatedField(read_only=True)

    # items are returned as nested read-only
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
            "trip": {"required": False, "allow_null": True},
            "name": {"required": True},
        }

