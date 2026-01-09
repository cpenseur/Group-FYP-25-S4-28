# backend/TripMateFunctions/views/f1_3_views.py
import json
import logging
import os

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


logger = logging.getLogger(__name__)


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
    api_key = getattr(settings, "GEMINI_API_KEY", None) or os.environ.get(
        "GEMINI_API_KEY"
    )
    model = getattr(settings, "GEMINI_MODEL", None) or "gemini-1.5-flash"

    if not api_key:
        return None, "missing_api_key"

    system_prompt = ""
    contents = []
    for msg in messages:
        role = msg.get("role")
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        if role == "system":
            system_prompt = content
            continue

        gemini_role = "user" if role == "user" else "model"
        contents.append({"role": gemini_role, "parts": [{"text": content}]})

    payload = {
        "contents": contents
        or [{"role": "user", "parts": [{"text": "Respond concisely."}]}],
        "generationConfig": {"temperature": temperature},
    }
    if max_tokens is not None:
        payload["generationConfig"]["maxOutputTokens"] = max_tokens
    if system_prompt:
        payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
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
            "Return ONLY valid JSON. No markdown. No commentary."
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
      "lat": optional,
      "lon": optional
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
            max_tokens=800,
            timeout=60,
        )

        if not ai_content:
            return Response(
                {"detail": "AI service unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        cleaned_ai_content = ai_content.strip()
        if cleaned_ai_content.startswith("```"):
            cleaned_ai_content = cleaned_ai_content.strip("`")
            cleaned_ai_content = cleaned_ai_content.replace("json", "", 1).strip()

        try:
            itinerary = json.loads(cleaned_ai_content)
        except Exception:
            return Response(
                {"detail": "AI returned invalid JSON"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ---------- create DB objects ----------
        with transaction.atomic():
            # keep availability window stored on trip (fine)
            trip = Trip.objects.create(
                owner=user,
                title=itinerary.get("title", "AI Trip"),
                main_city=itinerary.get("main_city"),
                main_country=itinerary.get("main_country"),
                start_date=start_date,
                end_date=end_date,
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

            # IMPORTANT: TripDay.date should NOT be derived from availability window
            TripDay.objects.bulk_create(
                [TripDay(trip=trip, day_index=i + 1, date=None) for i in range(duration)]
            )

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


class F13GenerateGroupItineraryView(APIView):
    """
    POST /api/f1/trips/{trip_id}/generate-group-itinerary/
    Generates AI itinerary based on all collaborators' preferences
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, trip_id, *args, **kwargs):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({"error": "Trip not found"}, status=404)
        
        # Get current authenticated user
        current_user = request.user
        
        # Check if user is authenticated
        if not current_user or not current_user.is_authenticated:
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if user is the trip owner
        if str(trip.owner_id) != str(current_user.id):
            return Response(
                {"error": "Only trip owner can generate itinerary"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get all group preferences for this trip
        preferences = GroupPreference.objects.filter(trip=trip).select_related('user')
        
        if preferences.count() == 0:
            return Response(
                {"error": "No preferences found. Please save preferences first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ========== MERGE GROUP PREFERENCES ==========
        
        # Collect all preferences from all users
        all_activities = []
        all_destinations = []
        budget_min_vals = []
        budget_max_vals = []
        
        for pref in preferences:
            prefs_data = pref.preferences or []
            
            # Extract data from each user's preferences
            for item in prefs_data:
                if isinstance(item, dict):
                    item_type = item.get("type", "")
                    item_value = item.get("value", "")
                    
                    if item_type == "activity" and item_value:
                        all_activities.append(item_value)
                    elif item_type == "destination" and item_value:
                        all_destinations.append(item_value)
                    elif item_type == "budget_min":
                        try:
                            budget_min_vals.append(float(item_value))
                        except (ValueError, TypeError):
                            pass
                    elif item_type == "budget_max":
                        try:
                            budget_max_vals.append(float(item_value))
                        except (ValueError, TypeError):
                            pass
        
        # Get most common preferences using Counter
        from collections import Counter
        
        top_activities = [act for act, _ in Counter(all_activities).most_common(5)] if all_activities else ["Sightseeing", "Food"]
        top_destinations = [dest for dest, _ in Counter(all_destinations).most_common(3)] if all_destinations else ["Urban", "Cultural"]
        
        avg_budget_min = sum(budget_min_vals) / len(budget_min_vals) if budget_min_vals else 1000
        avg_budget_max = sum(budget_max_vals) / len(budget_max_vals) if budget_max_vals else 5000
        
        # Calculate trip duration from dates
        if trip.start_date and trip.end_date:
            duration = (trip.end_date - trip.start_date).days + 1
            if duration < 1:
                duration = 3
        else:
            duration = 3
        
        # ========== BUILD AI PROMPT ==========
        
        user_emails = [pref.user.email for pref in preferences[:5]]
        user_list = ", ".join(user_emails)
        
        system_prompt = (
            "You are a travel planning AI. "
            "Return ONLY valid JSON. No markdown. No commentary."
        )
        
        user_prompt = f"""
Create a GROUP travel itinerary for {preferences.count()} travelers.

Group members: {user_list}

Trip duration: {duration} days
Preferred activities (from group): {", ".join(top_activities)}
Preferred destination types: {", ".join(top_destinations)}
Average budget range: ${int(avg_budget_min)} - ${int(avg_budget_max)}

Requirements:
- Plan 3-4 activities per day
- Include a mix of all group preferences
- Suggest real places and attractions
- Include morning (09:00-12:00), afternoon (14:00-17:00), and evening (19:00-22:00) activities

Return JSON in this exact format:
{{
  "title": "Descriptive trip title",
  "main_city": "City name",
  "main_country": "Country name",
  "days": {duration},
  "stops": [
    {{
      "day_index": 1,
      "title": "Activity name",
      "description": "Brief description",
      "item_type": "activity",
      "start_time": "09:00",
      "end_time": "11:00",
      "address": "Full address",
      "lat": 1.23456,
      "lon": 103.12345
    }},
    {{
      "day_index": 1,
      "title": "Lunch spot",
      "description": "Brief description",
      "item_type": "food",
      "start_time": "12:00",
      "end_time": "13:30",
      "address": "Full address",
      "lat": 1.23456,
      "lon": 103.12345
    }}
  ]
}}
""".strip()

        # ========== CALL AI ==========
        
        print(f"Calling AI with prompt for trip {trip_id}...")
        
        ai_content, provider, primary_error, fallback_error = _generate_with_fallback(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=1500,
            timeout=60,
        )

        if not ai_content:
            print(f"AI generation failed: primary={primary_error}, fallback={fallback_error}")
            return Response(
                {"detail": "AI service unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        print(f"AI response received from {provider}")

        # Clean AI response
        cleaned_ai_content = ai_content.strip()
        if cleaned_ai_content.startswith("```"):
            cleaned_ai_content = cleaned_ai_content.strip("`")
            if cleaned_ai_content.startswith("json"):
                cleaned_ai_content = cleaned_ai_content[4:].strip()

        try:
            itinerary = json.loads(cleaned_ai_content)
        except Exception as e:
            print(f"Failed to parse AI JSON: {str(e)}")
            print(f"Raw AI response: {cleaned_ai_content[:500]}")
            return Response(
                {"detail": f"AI returned invalid JSON: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ========== UPDATE DATABASE ==========
        
        print(f"Creating itinerary in database...")
        
        with transaction.atomic():
            # Update trip metadata
            trip.title = itinerary.get("title", f"Group Trip - {trip.id}")
            trip.main_city = itinerary.get("main_city", "Unspecified")
            trip.main_country = itinerary.get("main_country", "")
            trip.travel_type = "group_ai"  # Update status from group_ai_pending
            trip.save()
            
            print(f"Updated trip: {trip.title}")
            
            # Delete existing days/items if any
            TripDay.objects.filter(trip=trip).delete()
            ItineraryItem.objects.filter(trip=trip).delete()
            
            # Create TripDays
            trip_days = []
            for i in range(duration):
                day_date = None
                if trip.start_date:
                    from datetime import timedelta
                    day_date = trip.start_date + timedelta(days=i)
                
                trip_days.append(
                    TripDay(trip=trip, day_index=i + 1, date=day_date)
                )
            
            TripDay.objects.bulk_create(trip_days)
            print(f"Created {len(trip_days)} trip days")
            
            # Create day map
            day_map = {d.day_index: d for d in TripDay.objects.filter(trip=trip)}
            
            # Create ItineraryItems
            items = []
            sort_order = 1
            
            for stop in itinerary.get("stops", []):
                day_index = int(stop.get("day_index", 1) or 1)
                if day_index < 1:
                    day_index = 1
                if day_index > duration:
                    day_index = duration
                
                day = day_map.get(day_index)
                
                # Parse times and convert to datetime objects
                start_time_str = stop.get("start_time", "09:00")
                end_time_str = stop.get("end_time", "10:00")
                
                start_datetime = None
                end_datetime = None
                
                if day and day.date and start_time_str:
                    try:
                        from datetime import datetime
                        start_datetime = datetime.combine(
                            day.date, 
                            datetime.strptime(start_time_str, "%H:%M").time()
                        )
                    except (ValueError, AttributeError):
                        pass
                
                if day and day.date and end_time_str:
                    try:
                        from datetime import datetime
                        end_datetime = datetime.combine(
                            day.date, 
                            datetime.strptime(end_time_str, "%H:%M").time()
                        )
                    except (ValueError, AttributeError):
                        pass
                
                items.append(
                    ItineraryItem(
                        trip=trip,
                        day=day,
                        title=stop.get("title") or "Untitled Activity",
                        item_type=stop.get("item_type", "activity"),
                        notes_summary=stop.get("description", ""),
                        address=stop.get("address", ""),
                        lat=stop.get("lat"),
                        lon=stop.get("lon"),
                        start_time=start_datetime,
                        end_time=end_datetime,
                        sort_order=sort_order,
                    )
                )
                sort_order += 1
            
            if items:
                ItineraryItem.objects.bulk_create(items)
                print(f"Created {len(items)} itinerary items")
            
            # Update budget
            if avg_budget_max:
                TripBudget.objects.update_or_create(
                    trip=trip,
                    defaults={
                        "currency": "USD",
                        "planned_total": avg_budget_max,
                    },
                )
                print(f"Updated budget: ${avg_budget_max}")

        print(f"✅ Successfully generated group itinerary for trip {trip_id}")

        return Response(
            {
                "message": "Group itinerary generated successfully",
                "trip_id": trip_id,
                "title": trip.title,
                "days": duration,
                "items_created": len(items),
            },
            status=status.HTTP_200_OK
        )