from rest_framework import serializers
from ..models import DestinationQA


class F25CommunityQASerializer(serializers.ModelSerializer):
    class Meta:
        model = DestinationQA
        fields = [
            "id",
            "destination",
            "author",
            "question",
            "answer",
            "upvotes",
            "is_public",
            "created_at",
        ]
        read_only_fields = ["author", "upvotes", "created_at"]


class F25QAUpvoteSerializer(serializers.Serializer):
    qa_id = serializers.IntegerField()
