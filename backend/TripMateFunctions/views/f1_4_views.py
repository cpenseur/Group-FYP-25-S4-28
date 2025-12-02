from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Trip
from ..serializers.f1_4_serializers import (
    F14AdaptivePlanRequestSerializer,
    F14AdaptivePlanResponseSerializer,
)


class F14AdaptivePlanningView(APIView):
    """
    F1.4 - Adaptive AI Planning (weather + attraction status)

    POST:
      - Fetch weather (Open-Meteo) + attraction hours
      - Generate rearranged plan
      - If apply_changes=True, persist to DB
    """

    def post(self, request, *args, **kwargs):
        req_serializer = F14AdaptivePlanRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)
        data = req_serializer.validated_data

        # TODO: integrate weather + OpenTripMap + DB updates
        stub_changes = []

        res = {
            "summary": "[stub] No changes applied yet.",
            "changes": stub_changes,
        }
        res_serializer = F14AdaptivePlanResponseSerializer(res)
        return Response(res_serializer.data, status=status.HTTP_200_OK)
