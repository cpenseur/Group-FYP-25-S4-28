# backend/TripMateFunctions/views/f1_3_views.py
import json
import logging
import os
from datetime import timedelta

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from ..models import (
    Trip,
    TripDay,
    ItineraryItem,
    TripCollaborator,
    TripBudget,
    GroupPreference,
    AppUser,
)
from ..serializers.f1_3_serializers import (
    F13AITripPromptSerializer,
    F13GeneratedItinerarySerializer,
    F13AIChatMessageSerializer,
    F13SoloTripGenerateRequestSerializer,
    F13SoloTripGenerateResponseSerializer,
)

# from ..views.f2_2_views import F22GroupTripGeneratorView

logger = logging.getLogger(__name__)


def _clean_ai_json_text(ai_text: str) -> str:
    """
    Strip common markdown fences and leading language tags so we can parse JSON safely.
    """
    cleaned = (ai_text or "").strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()

    # Drop a leading "json" or "JSON" language tag if present
    if cleaned.lower().startswith("json"):
        cleaned = cleaned[4:].lstrip()

    return cleaned


def _slice_first_json_block(text: str) -> str | None:
    """
    Best-effort extraction of the first JSON-looking block (object or array) from free text.
    """
    if not text:
        return None

    brace = text.find("{")
    bracket = text.find("[")
    candidates = [i for i in [brace, bracket] if i != -1]
    if not candidates:
        return None

    start = min(candidates)
    start_char = text[start]
    end_char = "}" if start_char == "{" else "]"
    end = text.rfind(end_char)
    if end == -1 or end <= start:
        return None

    return text[start : end + 1]


def _call_sea_lion(messages, temperature=0.4, max_tokens=None, timeout=40):
    api_key = getattr(settings, "SEA_LION_API_KEY", None) or os.environ.get(
        "SEA_LION_API_KEY"
    )
    model = getattr(settings, "SEA_LION_MODEL", None) or "aisingapore/Llama-SEA-LION-v3-70B-IT"

    if not api_key:
        return None, "missing_api_key"

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens is not None:
        payload["max_completion_tokens"] = max_tokens

    try:
        resp = requests.post(
            "https://api.sea-lion.ai/v1/chat/completions",
            headers={
                "accept": "application/json",
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        logger.warning("Sea-Lion request failed: %s", exc)
        return None, "network_error"

    if not resp.ok:
        logger.warning("Sea-Lion returned %s: %s", resp.status_code, resp.text[:200])
        return None, f"bad_status_{resp.status_code}"

    try:
        data_json = resp.json()
        answer = (
            data_json.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
    except Exception as exc:
        logger.warning("Sea-Lion response parse failed: %s", exc)
        return None, "invalid_json"

    if not answer:
        return None, "empty_response"

    return answer, None


def _call_gemini(messages, temperature=0.4, max_tokens=None, timeout=40):
    """
    Removed systemInstruction parameter that caused 400 error
    Now injects system prompt as first user message instead
    """
    api_key = getattr(settings, "GEMINI_API_KEY", None) or os.environ.get(
        "GEMINI_API_KEY"
    )
    model = getattr(settings, "GEMINI_MODEL", None) or "gemini-1.5-flash-latest"

    if not api_key:
        return None, "missing_api_key"

    # Build contents array with system prompt injected as first message
    contents = []
    system_prompt_found = False
    
    for msg in messages:
        role = msg.get("role")
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        
        if role == "system":
            # Inject system prompt as first user message + model acknowledgment
            contents.append({
                "role": "user",
                "parts": [{"text": content}]
            })
            contents.append({
                "role": "model",
                "parts": [{"text": "I understand. I will follow these instructions carefully."}]
            })
            system_prompt_found = True
            continue

        # Convert role to Gemini format
        gemini_role = "user" if role == "user" else "model"
        contents.append({"role": gemini_role, "parts": [{"text": content}]})

    # Ensure we have at least one message
    if not contents:
        contents = [{"role": "user", "parts": [{"text": "Respond concisely."}]}]

    payload = {
        "contents": contents,
        "generationConfig": {"temperature": temperature},
    }
    
    if max_tokens is not None:
        payload["generationConfig"]["maxOutputTokens"] = max_tokens

   
    endpoint = (
        f"https://generativelanguage.googleapis.com/v1/models/{model}:generateContent"
        f"?key={api_key}"
    )

    try:
        resp = requests.post(endpoint, json=payload, timeout=timeout)
    except requests.RequestException as exc:
        logger.warning("Gemini request failed: %s", exc)
        return None, "network_error"

    if not resp.ok:
        logger.warning("Gemini returned %s: %s", resp.status_code, resp.text[:200])
        return None, f"bad_status_{resp.status_code}"

    try:
        data_json = resp.json()
        candidates = data_json.get("candidates") or []
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            text_parts = [p.get("text", "") for p in parts if isinstance(p, dict)]
            answer = "\n".join([t for t in text_parts if t]).strip()
        else:
            answer = ""
    except Exception as exc:
        logger.warning("Gemini response parse failed: %s", exc)
        return None, "invalid_json"

    if not answer:
        return None, "empty_response"

    return answer, None


def _generate_with_fallback(messages, temperature=0.4, max_tokens=None, timeout=40):
    """
    This function is used by both f1_3_views and f2_2_views
    It must stay in f1_3_views to avoid circular imports
    """
    answer, primary_error = _call_sea_lion(
        messages, temperature=temperature, max_tokens=max_tokens, timeout=timeout
    )
    if answer:
        return answer, "sea-lion", primary_error, None

    fallback_answer, fallback_error = _call_gemini(
        messages, temperature=temperature, max_tokens=max_tokens, timeout=timeout
    )
    if fallback_answer:
        logger.warning("Sea-Lion unavailable (%s); used Gemini fallback", primary_error)
        return fallback_answer, "gemini", primary_error, fallback_error

    logger.warning(
        "Both AI providers failed (sea-lion=%s, gemini=%s)", primary_error, fallback_error
    )
    return None, None, primary_error, fallback_error


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

        # ---- Prepare AI request ----------------------------------------------------
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
        answer, _, _, _ = _generate_with_fallback(
            messages, temperature=0.4, max_tokens=300, timeout=40
        )

        if not answer:
            return Response(
                {
                    "reply": (
                        "Planbot couldn't reach the AI service right now. "
                        "Please refine your question or try again later."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
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

       
        preferences_data = {
            "country": data.get("country"),
            "activities": data.get("activities", []),
            "destination_types": data.get("destination_types", []),
            "duration_days": data.get("duration_days"),
            "budget_min": data.get("budget_min"),
            "budget_max": data.get("budget_max"),
            "additional_info": data.get("additional_info", ""),
            "start_date": data.get("start_date"),  
            "end_date": data.get("end_date"),      
        }

        # Update trip dates
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        if start_date:
            trip.start_date = start_date
        if end_date:
            trip.end_date = end_date
        trip.save()

        # Save preferences
        GroupPreference.objects.update_or_create(
            trip=trip,
            user=user,
            defaults={"preferences": preferences_data},
        )

        # Update budget
        budget_max = data.get("budget_max")
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
    

class F13SoloAITripGenerateCreateView(APIView):
    """
    POST /api/f1/ai-solo-trip/
    Generates itinerary via SEA-LION and creates Trip + Days + Items

    IMPORTANT:
    - duration comes ONLY from duration_days (slider)
    - start_date/end_date are ONLY availability window
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = F13SoloTripGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user

        # ---------- duration must come from slider ----------
        duration = data["duration_days"]

        # availability window (NOT used to compute duration)
        start_date = data.get("start_date")
        end_date = data.get("end_date")

        # ---------- build AI prompt ----------

        system_prompt = (
            "You are a travel planning AI. "
            "Return ONLY a single valid JSON object. No markdown. No commentary. "
            "Do not wrap in code fences. Do not add prose before or after the JSON. "
            "Ensure the JSON is syntactically valid (no trailing commas, proper quotes)."
        )

        availability_line = ""
        if start_date and end_date:
            availability_line = f"User availability window (NOT trip duration): {start_date} to {end_date}"
        elif start_date:
            availability_line = f"User availability window (NOT trip duration): starting {start_date}"
        elif end_date:
            availability_line = f"User availability window (NOT trip duration): until {end_date}"

        user_prompt = f"""
Create a SOLO travel itinerary.

{availability_line}

Trip duration (must follow this exactly): {duration} days

Activities: {", ".join(data["activities"])}
Destination types: {", ".join(data["destination_types"])}
Budget: {data.get("budget_min")} - {data.get("budget_max")}
Additional info: {data.get("additional_info", "")}

Constraints to keep JSON short and valid:
- Every stop title must be a real POI name that can appear in Mapbox/Wikipedia/Wikimedia search results (e.g., \"Ubud Palace\", \"Tegalalang Rice Terrace\", \"Tanah Lot Temple\", \"La Favela\", \"IKEA Tampines\"). No adjectives or marketing fluff in titles.
- Titles should follow map-friendly naming (like Google Maps place names); no descriptive phrases.
- Cover EVERY day index 1..{duration}. Each day should have 2-3 stops (max {duration * 3} stops total).
- Keep descriptions <= 140 characters.
- Use 24h times in HH:MM.
- Every stop MUST include both lat and lon as real float coordinates (non-null). If you cannot supply coordinates for a stop, omit that stop.
- No trailing commas anywhere.
- Do not include any text outside the JSON object.

Return JSON in this format:
{{
  "title": "...",
  "main_city": "...",
  "main_country": "...",
  "days": {duration},
  "stops": [
    {{
      "day_index": 1,
      "title": "...",
      "description": "...",
      "item_type": "activity|food|sightseeing",
      "start_time": "09:00",
      "end_time": "11:00",
      "address": "optional",
      "lat": 1.23456,
      "lon": 103.12345
    }}
  ]
}}
""".strip()

        ai_content, _, _, _ = _generate_with_fallback(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            # Allow more room so responses don't truncate mid-JSON
            max_tokens=min(1600, 400 + duration * 150),
            timeout=60,
        )

        if not ai_content:
            return Response(
                {"detail": "AI service unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        cleaned_ai_content = _clean_ai_json_text(ai_content)

        itinerary = None
        parse_errors = []

        candidates = [cleaned_ai_content]
        sliced = _slice_first_json_block(cleaned_ai_content)
        if sliced and sliced != cleaned_ai_content:
            candidates.append(sliced)

        for candidate in candidates:
            if not candidate:
                continue
            try:
                itinerary = json.loads(candidate)
                break
            except Exception as exc:
                parse_errors.append(str(exc))

        # Retry once with a stricter, shorter format if parsing failed
        if not itinerary:
            retry_prompt = f"""
Return ONLY valid JSON. One object. No prose, no code fences.
Keep descriptions <= 90 chars. 2-3 stops per day and EVERY day index 1..{duration} must appear (max {duration * 3} stops).
Fields: title (string), main_city (string), main_country (string), days (int), stops (array of objects with day_index:int, title:string, description:string, item_type:string, start_time:"HH:MM", end_time:"HH:MM", address:string|null, lat:float, lon:float). Every stop MUST have lat and lon; omit stops without coordinates.
JSON only, nothing else.
""".strip()

            retry_content, _, _, _ = _generate_with_fallback(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": retry_prompt},
                ],
                temperature=0.25,
                max_tokens=min(1200, 300 + duration * 120),
                timeout=45,
            )

            if retry_content:
                retry_clean = _clean_ai_json_text(retry_content)
                retry_candidates = [retry_clean]
                retry_slice = _slice_first_json_block(retry_clean)
                if retry_slice and retry_slice != retry_clean:
                    retry_candidates.append(retry_slice)
                for candidate in retry_candidates:
                    if not candidate:
                        continue
                    try:
                        itinerary = json.loads(candidate)
                        break
                    except Exception as exc:
                        parse_errors.append(str(exc))

        if not itinerary:
            logger.warning(
                "AI JSON parse failed for ai-solo-trip after retry. errors=%s raw_preview=%s",
                parse_errors or ["unknown_error"],
                (ai_content or "")[:400],
            )
            return Response(
                {"detail": "AI service returned an invalid itinerary. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # ---------- create DB objects ----------
        with transaction.atomic():
            # Calculate actual trip dates based on duration_days (slider value).
            # Use the availability window start as trip start, then add duration.
            # e.g. availability Feb 13 - Mar 24, duration 5 days → trip is Feb 13 - Feb 17
            actual_start = start_date  # from availability window
            actual_end = None
            if actual_start:
                actual_end = actual_start + timedelta(days=duration - 1)
            
            trip = Trip.objects.create(
                owner=user,
                title=itinerary.get("title", "AI Trip"),
                main_city=itinerary.get("main_city"),
                main_country=itinerary.get("main_country"),
                start_date=actual_start,
                end_date=actual_end,
                visibility=Trip.Visibility.PRIVATE,
                travel_type="solo_ai",
            )

            TripCollaborator.objects.create(
                trip=trip,
                user=user,
                role=TripCollaborator.Role.OWNER,
                status=TripCollaborator.Status.ACTIVE,
                accepted_at=timezone.now(),
            )

            # Create TripDay objects with actual dates based on trip start_date
            trip_days = []
            for i in range(duration):
                day_date = actual_start + timedelta(days=i) if actual_start else None
                trip_days.append(TripDay(trip=trip, day_index=i + 1, date=day_date))
            TripDay.objects.bulk_create(trip_days)

            day_map = {d.day_index: d for d in TripDay.objects.filter(trip=trip)}

            items = []
            sort_order = 1
            for stop in itinerary.get("stops", []):
                day_index = int(stop.get("day_index", 1) or 1)
                if day_index < 1:
                    day_index = 1
                if day_index > duration:
                    day_index = duration

                day = day_map.get(day_index)
                items.append(
                    ItineraryItem(
                        trip=trip,
                        day=day,
                        title=stop.get("title") or "Untitled",
                        item_type=stop.get("item_type"),
                        notes_summary=stop.get("description"),
                        address=stop.get("address"),
                        lat=stop.get("lat"),
                        lon=stop.get("lon"),
                        sort_order=sort_order,  # keeps stable ordering
                    )
                )
                sort_order += 1

            if items:
                ItineraryItem.objects.bulk_create(items)

            if data.get("budget_max") is not None:
                TripBudget.objects.create(
                    trip=trip,
                    currency="USD",
                    planned_total=data["budget_max"],
                )

        return Response(
            F13SoloTripGenerateResponseSerializer({"trip_id": trip.id}).data,
            status=status.HTTP_201_CREATED,
        )
    
class F13GroupPreferencesListView(APIView):
    """
    GET /api/f1/trips/{trip_id}/group-preferences/
    Returns all group preferences for a trip
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, trip_id, *args, **kwargs):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found"}, status=404)

        # Get all group preferences for this trip
        preferences = GroupPreference.objects.filter(trip=trip).select_related('user')
        
        # Format response
        result = []
        for pref in preferences:
            result.append({
                "user_id": str(pref.user.id),
                "email": pref.user.email,
                "preferences": pref.preferences,
                "created_at": pref.created_at.isoformat(),
            })

        return Response(result, status=status.HTTP_200_OK)

