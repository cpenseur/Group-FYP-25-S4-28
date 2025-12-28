from rest_framework import serializers
from ..models import ItineraryItemNote, ItineraryItemTag, TravelDocument


class F33ItineraryItemNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItineraryItemNote
        fields = ["id", "item", "user", "content", "created_at", "updated_at"]
        extra_kwargs = {
            "user": {"read_only": True},  # Set in perform_create, not by client
        }


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
        ]
        extra_kwargs = {
            "user": {"read_only": True},  # Set in perform_create, not by client
        }
