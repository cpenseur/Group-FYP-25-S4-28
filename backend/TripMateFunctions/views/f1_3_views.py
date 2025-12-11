# backend/TripMateFunctions/views/f1_3_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Trip
from ..serializers.f1_3_serializers import (
    F13AITripPromptSerializer,
    F13GeneratedItinerarySerializer,
    F13AIChatMessageSerializer,
)


class F13AITripGeneratorView(APIView):
    """
    F1.3 - AI Trip Generator

    POST /api/f1/ai-trip-generator/
      body: F13AITripPromptSerializer
      behaviour:
        - Call SEA-LION / LLM with prompt
        - Parse response into structured itinerary
        - Create Trip + TripDay + ItineraryItems
        - Return F13GeneratedItinerarySerializer
    """

    def post(self, request, *args, **kwargs):
        serializer = F13AITripPromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # TODO: call SEA-LION, create Trip & items.
        # Stub response:
        fake_itinerary = {
            "trip_id": None,
            "title": data.get("prompt")[:100],
            "main_city": data.get("city") or "",
            "main_country": "",
            "days": data.get("days") or 3,
            "stops": [],
        }

        res_serializer = F13GeneratedItinerarySerializer(fake_itinerary)
        return Response(res_serializer.data, status=status.HTTP_200_OK)


class F13AIChatbotView(APIView):
    """
    F1.3 - AI Context Chatbot

    POST /api/f1/ai-chat/
      body: F13AIChatMessageSerializer
      behaviour:
        - Include trip context (stops, dates) when calling SEA-LION
        - Return answer text
    """

    def post(self, request, *args, **kwargs):
        serializer = F13AIChatMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # TODO: call SEA-LION with trip context.
        reply = f"[stub] You asked: {data['message']}"
        return Response({"reply": reply}, status=status.HTTP_200_OK)
