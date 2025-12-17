'''from rest_framework import serializers
from ..models import ItineraryItemNote, ItineraryItemTag, TravelDocument


class F33ItineraryItemNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItineraryItemNote
        fields = ["id", "item", "user", "content", "created_at", "updated_at"]


class F33ItineraryItemTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItineraryItemTag
        fields = ["id", "item", "tag", "created_at"]


class F33TravelDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelDocument
        fields = [
            "id",
            "trip",
            "user",
            "document_type",
            "file_url",
            "filename",
            "mime_type",
            "uploaded_at",
            "notes",
        ]'''
from rest_framework import serializers
from ..models import ItineraryItemNote, ItineraryItemTag, TravelDocument


class F33ItineraryItemNoteSerializer(serializers.ModelSerializer):
    # user is set from request.user in perform_create()
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ItineraryItemNote
        fields = ["id", "item", "user", "content", "created_at", "updated_at"]
        extra_kwargs = {
            "item": {"required": True},
            "content": {"required": True},
        }


class F33ItineraryItemTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItineraryItemTag
        fields = ["id", "item", "tag", "created_at"]
        extra_kwargs = {
            "item": {"required": True},
            "tag": {"required": True},
        }


class F33TravelDocumentSerializer(serializers.ModelSerializer):
    # user is set from request.user in perform_create()
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = TravelDocument
        fields = [
            "id",
            "trip",
            "user",
            "document_type",
            "file_url",
            "filename",
            "mime_type",
            "uploaded_at",
            "notes",
        ]
        extra_kwargs = {
            "trip": {"required": True},
            "document_type": {"required": True},
            "file_url": {"required": True},
        }

