# backend/TripMateFunctions/views/f1_3_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

import os
import requests

from ..models import(
    Trip,
    AppUser,
    TripBudget,
    GroupPreference,
)  
from ..serializers.f1_3_serializers import (
    F13AITripPromptSerializer,
    F13GeneratedItinerarySerializer,
    F13AIChatMessageSerializer,
)


class F13AITripGeneratorView(APIView):
    """
    F1.3 - AI Trip Generator
    (unchanged)
    """

    def post(self, request, *args, **kwargs):
        serializer = F13AITripPromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

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


@method_decorator(csrf_exempt, name="dispatch")
class F13AIChatbotView(APIView):
    """
    F1.3 - AI Context Chatbot

    POST /api/f1/ai-chatbot/
      body: F13AIChatMessageSerializer
      behaviour:
        - Include trip context (stops, dates) when calling SEA-LION
        - Return answer text
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = F13AIChatMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_message = data["message"]
        trip_context_payload = data.get("trip_context") or {}

        # ---- Build trip context text (frontend supplies Supabase data) ---------------
        trip_context_text = "No active trip context was provided."

        title = trip_context_payload.get("title") or ""
        main_city = trip_context_payload.get("main_city") or ""
        main_country = trip_context_payload.get("main_country") or ""
        start_date = trip_context_payload.get("start_date")
        end_date = trip_context_payload.get("end_date")
        days_payload = trip_context_payload.get("days") or []

        if any([title, main_city, main_country, days_payload]):
            if start_date and end_date:
                date_range = f"{start_date} to {end_date}"
            elif start_date:
                date_range = f"starting {start_date}"
            else:
                date_range = "dates not specified"

            lines = [
                f"Trip title: {title or '(untitled)'}",
                f"Destination: {main_city}, {main_country}".strip(", "),
                f"Date range: {date_range}",
                "",
                "Planned stops by day:",
            ]

            for day in days_payload:
                day_index = day.get("day_index") or day.get("day") or "?"
                day_label = f"Day {day_index}"
                day_date = day.get("date")
                if day_date:
                    day_label += f" ({day_date})"
                lines.append(f"- {day_label}:")

                items = day.get("items") or []
                if not items:
                    lines.append("    (no stops yet)")
                else:
                    for item in items:
                        stop_title = item.get("title") or "Untitled stop"
                        address = item.get("address") or item.get("location") or ""
                        lines.append(f"    • {stop_title}" + (f" — {address}" if address else ""))

            trip_context_text = "\n".join(lines)

        # ---- Prepare Sea-Lion request -----------------------------------------------
        api_key = getattr(settings, "SEA_LION_API_KEY", None) or os.environ.get(
            "SEA_LION_API_KEY"
        )
        if not api_key:
            return Response(
                {
                    "reply": (
                        "Planbot is currently unavailable because the AI key "
                        "is not configured. Please try again later."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        system_prompt = f"""
You are "Planbot", a friendly, safety-aware travel assistant embedded inside a trip-planning app.

Your job:
- Answer practical, local travel questions for the user's current trip.
- Topics include: transport options (MRT, subway, trains, buses, walking), estimated prices in SGD or local currency, approximate travel time, opening hours patterns, payment options (cash / card / GrabPay etc.), local customs, safety tips, weather-related advice, and simple itinerary tweaks.
- Use the trip context below (destination city, dates, stops) as the main reference. If the user asks about a place that is already one of the stops, treat it as part of their real plan.
- If you are not certain about a specific detail (exact timetable, live prices, live availability), be honest. Say it's an estimate, and suggest how the user can double-check (e.g. official website, Google Maps, local transit app).
- Keep answers short and actionable: 3-7 short bullet points or short paragraphs, focusing on what the user should actually do, how long it might take, and rough costs.
- If the question is unclear or too broad, ask a clarifying follow-up question.
- If the user's question is not about travel at all, gently redirect them back to travel topics.
- Always keep a friendly but neutral tone. No role-playing, no excessive emojis.

TRIP CONTEXT (do not show this block verbatim to the user):
{trip_context_text}
""".strip()

        history = data.get("history") or []

        history_msgs = []
        for m in history[-10:]:
            role = m.get("role")
            content = (m.get("content") or "").strip()
            if role in ("user", "assistant") and content:
                history_msgs.append({"role": role, "content": content})

        messages = [
            {"role": "system", "content": system_prompt},
            *history_msgs,
            {"role": "user", "content": user_message},
        ]

        try:
            resp = requests.post(
                "https://api.sea-lion.ai/v1/chat/completions",
                headers={
                    "accept": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "aisingapore/Llama-SEA-LION-v3-70B-IT",
                    "messages": messages,
                    "temperature": 0.4,
                    "max_completion_tokens": 300,
                },
                timeout=40,
            )
        except requests.RequestException:
            return Response(
                {
                    "reply": (
                        "Chat is currently unavailable (network error reaching the AI service). "
                        "Please try again in a moment."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not resp.ok:
            return Response(
                {
                    "reply": (
                        "Planbot couldn't reach the AI service right now. "
                        "Please refine your question or try again later."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            data_json = resp.json()
            answer = (
                data_json.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
        except Exception:
            answer = ""

        if not answer:
            answer = (
                "I couldn't generate a detailed answer just now. "
                "Try asking in a slightly different way, for example: "
                '"How do I get from Shinjuku to Asakusa by train, roughly how long and '
                'how much does it cost?"'
            )

        return Response({"reply": answer}, status=status.HTTP_200_OK)
    
class F13SaveTripPreferenceView(APIView):
    """
    F1.3 - Save Trip Preferences (on Done)

    POST /api/f1/trips/{trip_id}/preferences/
    """

    def post(self, request, trip_id, *args, **kwargs):
        data = request.data

        user_id = data.get("user_id")
        preferences = data.get("preferences", [])
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        budget_max = data.get("budget_max")

        if not user_id:
            return Response(
                {"error": "Missing user_id"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            trip = Trip.objects.get(id=trip_id)
            user = AppUser.objects.get(id=user_id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found"}, status=404)
        except AppUser.DoesNotExist:
            return Response({"error": "User not found"}, status=404)

        if start_date:
            trip.start_date = start_date
        if end_date:
            trip.end_date = end_date
        trip.save()

        GroupPreference.objects.update_or_create(
            trip=trip,
            user=user,
            defaults={"preferences": preferences},
        )

        if budget_max is not None:
            TripBudget.objects.update_or_create(
                trip=trip,
                defaults={
                    "currency": "USD",
                    "planned_total": budget_max,
                },
            )

        return Response(
            {"message": "Trip preferences saved"},
            status=status.HTTP_200_OK,
        )

