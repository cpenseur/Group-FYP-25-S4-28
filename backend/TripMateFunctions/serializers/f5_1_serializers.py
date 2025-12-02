from rest_framework import serializers
from ..models import TripPhoto


class F51TripPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripPhoto
        fields = [
            "id",
            "trip",
            "user",
            "itinerary_item",
            "file_url",
            "caption",
            "lat",
            "lon",
            "taken_at",
            "created_at",
        ]
