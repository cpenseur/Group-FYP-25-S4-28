from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..serializers.f1_5_serializers import (
    F15SidebarContextSerializer,
    F15SidebarResponseSerializer,
)


class F15AIRecommendationsSidebarView(APIView):
    """
    F1.5 - AI Recommendations Sidebar

    POST:
      - Called whenever user edits itinerary
      - Sends context to SEA-LION
      - Returns suggestion cards
    """

    def post(self, request, *args, **kwargs):
        ctx_serializer = F15SidebarContextSerializer(data=request.data)
        ctx_serializer.is_valid(raise_exception=True)
        data = ctx_serializer.validated_data

        # TODO: call SEA-LION with current trip context
        stub_suggestions = [
            {
                "suggestion_id": "stub-1",
                "category": "Food",
                "title": "Try a nearby lunch spot",
                "description": "Add a lunch break between Stop 2 and 3.",
                "destination_id": None,
                "lat": None,
                "lon": None,
                "action_type": "add",
            }
        ]

        res = {"suggestions": stub_suggestions, "cached": False}
        res_serializer = F15SidebarResponseSerializer(res)
        return Response(res_serializer.data, status=status.HTTP_200_OK)
