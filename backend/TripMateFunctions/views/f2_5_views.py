from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response

from ..models import DestinationQA
from ..serializers.f2_5_serializers import (
    F25CommunityQASerializer,
    F25QAUpvoteSerializer,
)


class F25CommunityQAListCreateView(generics.ListCreateAPIView):
    """
    F2.5 - List & create Q&A entries.
    """
    queryset = DestinationQA.objects.filter(is_public=True)
    serializer_class = F25CommunityQASerializer

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(author=user)


class F25QAUpvoteView(APIView):
    """
    F2.5 - Upvote a Q&A entry.
    """

    def post(self, request, *args, **kwargs):
        serializer = F25QAUpvoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        qa_id = serializer.validated_data["qa_id"]

        try:
            qa = DestinationQA.objects.get(id=qa_id)
        except DestinationQA.DoesNotExist:
            return Response(
                {"detail": "QA entry not found"}, status=status.HTTP_404_NOT_FOUND
            )

        qa.upvotes += 1
        qa.save(update_fields=["upvotes"])
        return Response({"upvotes": qa.upvotes}, status=status.HTTP_200_OK)
