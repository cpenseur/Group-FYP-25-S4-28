from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from ..models import Trip
from ..serializers.f1_1_serializers import TripSerializer
from ..serializers.f7_1_serializers import F71DemoRequestSerializer


class F71DemoItinerariesView(APIView):
    """
    F7.1 - Serve demo itineraries for guests (is_demo=True).
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        demos = Trip.objects.filter(is_demo=True, visibility="public")
        data = TripSerializer(demos, many=True).data
        return Response(data, status=status.HTTP_200_OK)
