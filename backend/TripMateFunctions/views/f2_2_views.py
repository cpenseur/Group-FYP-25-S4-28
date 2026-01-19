# backend/TripMateFunctions/views/f2_2_views.py
import json
import logging
from collections import Counter
from datetime import timedelta, datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from TripMateFunctions.models import (
    Trip, 
    GroupPreference, 
    TripDay, 
    ItineraryItem,
    TripBudget,
    TripCollaborator,
)

from .f1_3_views import _generate_with_fallback

logger = logging.getLogger(__name__)


class TripGroupPreferencesAPIView(APIView):
    """
    GET /api/f2/trips/{trip_id}/preferences/
    Returns all group preferences for a trip
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, trip_id):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response(
                {"error": "Trip not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        prefs = GroupPreference.objects.filter(trip=trip).select_related('user')

        data = []
        for p in prefs:
            data.append({
                "username": p.user.full_name or p.user.email,
                "preferences": p.preferences,
                "is_owner": p.user.id == trip.owner.id,
            })

        return Response(data, status=status.HTTP_200_OK)


class F22GroupTripGeneratorView(APIView):
    """
    POST /api/f2/trips/{trip_id}/generate-group-itinerary/
    NOW SUPPORTS MULTI-CITY ITINERARIES (e.g., London + Edinburgh)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, trip_id, *args, **kwargs):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response(
                {"error": "Trip not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        current_user = request.user
        
        is_collaborator = TripCollaborator.objects.filter(
            trip=trip,
            user=current_user,
            status=TripCollaborator.Status.ACTIVE
        ).exists()

        if not is_collaborator:
            return Response(
                {"error": "Only trip collaborators can regenerate itinerary"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Set intermediate status for regeneration
        trip.travel_type = "group_generating"
        trip.save()
        logger.info(f"✅ Trip {trip_id} status: group_generating")

        preferences = GroupPreference.objects.filter(trip=trip).select_related('user')
        
        if preferences.count() == 0:
            return Response(
                {"error": "No preferences found. Please save preferences first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ========== MERGE GROUP PREFERENCES ==========
        
        all_activities = []
        all_destinations = []
        all_countries = []
        all_additional_info = []
        budget_min_vals = []
        budget_max_vals = []
        start_dates = []
        end_dates = []
        duration_days_list = []
        
        logger.info(f"📊 Processing {preferences.count()} preferences for trip {trip_id}")
        
        for pref in preferences:
            prefs_data = pref.preferences or {}
            
            logger.info(f"👤 User: {pref.user.email}")
            logger.info(f"📝 Raw preferences: {json.dumps(prefs_data, indent=2)}")
            
            if isinstance(prefs_data, dict):
                activities = prefs_data.get("activities", [])
                destinations = prefs_data.get("destination_types", [])
                country = prefs_data.get("country", "")
                additional = prefs_data.get("additional_info", "")
                budget_min = prefs_data.get("budget_min")
                budget_max = prefs_data.get("budget_max")
                
                # Read dates AND duration from preferences
                start_date_str = prefs_data.get("start_date")
                end_date_str = prefs_data.get("end_date")
                duration_days = prefs_data.get("duration_days")
                
                logger.info(f"📅 User dates: start={start_date_str}, end={end_date_str}, duration={duration_days}")
                
                if activities:
                    all_activities.extend(activities)
                if destinations:
                    all_destinations.extend(destinations)
                if country:
                    all_countries.append(country)
                if additional:
                    all_additional_info.append(additional)
                if budget_min:
                    try:
                        budget_min_vals.append(float(budget_min))
                    except (ValueError, TypeError):
                        pass
                if budget_max:
                    try:
                        budget_max_vals.append(float(budget_max))
                    except (ValueError, TypeError):
                        pass
                
                # Parse start date
                if start_date_str:
                    try:
                        if isinstance(start_date_str, str):
                            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                            start_dates.append(start_date)
                            logger.info(f"Parsed start_date: {start_date}")
                        else:
                            start_dates.append(start_date_str)
                    except (ValueError, TypeError) as e:
                        logger.error(f"Failed to parse start_date: {start_date_str}, error: {e}")
                
                # Parse end date
                if end_date_str:
                    try:
                        if isinstance(end_date_str, str):
                            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                            end_dates.append(end_date)
                            logger.info(f"Parsed end_date: {end_date}")
                        else:
                            end_dates.append(end_date_str)
                    except (ValueError, TypeError) as e:
                        logger.error(f"Failed to parse end_date: {end_date_str}, error: {e}")
                
                # Collect duration_days
                if duration_days:
                    try:
                        duration_days_list.append(int(duration_days))
                        logger.info(f"Parsed duration_days: {duration_days}")
                    except (ValueError, TypeError) as e:
                        logger.error(f"Failed to parse duration_days: {duration_days}, error: {e}")

        logger.info(f"📅 Collected data:")
        logger.info(f"  Start dates: {start_dates}")
        logger.info(f"  End dates: {end_dates}")
        logger.info(f"  Duration days: {duration_days_list}")
        logger.info(f"  All destinations: {all_countries}")

        # Use duration_days from preferences instead of calculating from dates
        if duration_days_list:
            duration = min(duration_days_list)
            logger.info(f"Using user-selected duration: {duration} days")
        else:
            if start_dates and end_dates:
                if len(start_dates) > 1:
                    overlap_start = max(start_dates)
                    overlap_end = min(end_dates)
                    if overlap_start <= overlap_end:
                        duration = (overlap_end - overlap_start).days + 1
                    else:
                        duration = 5
                else:
                    duration = (end_dates[0] - start_dates[0]).days + 1
                logger.info(f"Calculated duration from dates: {duration} days")
            else:
                duration = 5
                logger.warning(f"⚠️ No duration or dates found, using default: {duration} days")

        # Set trip start_date
        if start_dates:
            trip.start_date = min(start_dates)
            logger.info(f"Set trip start_date: {trip.start_date}")
        else:
            trip.start_date = datetime.now().date()
            logger.warning(f"⚠️ No start date found, using today: {trip.start_date}")

        # Calculate end_date based on duration
        trip.end_date = trip.start_date + timedelta(days=duration - 1)
        logger.info(f"Calculated end_date: {trip.end_date}")

        # Enforce maximum duration limit
        max_duration = 10
        if duration > max_duration:
            logger.warning(f"⚠️ Duration {duration} days exceeds limit, capping at {max_duration}")
            duration = max_duration
            trip.end_date = trip.start_date + timedelta(days=max_duration - 1)
        
        if duration < 1:
            duration = 3
            trip.end_date = trip.start_date + timedelta(days=2)
        
        logger.info(f"🎯 Final trip configuration:")
        logger.info(f"  Start: {trip.start_date}")
        logger.info(f"  End: {trip.end_date}")
        logger.info(f"  Duration: {duration} days")
        
        top_activities = [act for act, _ in Counter(all_activities).most_common(5)] if all_activities else ["Sightseeing", "Food"]
        top_destinations = [dest for dest, _ in Counter(all_destinations).most_common(3)] if all_destinations else ["Urban", "Cultural"]
        
        # ========== NEW: MULTI-CITY DETECTION ==========
        
        # Parse cities from "City, Country" format
        parsed_cities = []
        for location in all_countries:
            # Split by comma and take first part (city name)
            parts = [p.strip() for p in location.split(',')]
            if parts:
                city_name = parts[0]
                parsed_cities.append(city_name)
        
        # Get unique cities while preserving order
        unique_cities = []
        seen = set()
        for city in parsed_cities:
            if city not in seen:
                unique_cities.append(city)
                seen.add(city)
        
        logger.info(f"📍 Unique cities detected: {unique_cities}")
        
        # Determine if multi-city trip
        is_multi_city = len(unique_cities) > 1
        
        if is_multi_city:
            # Multi-city trip
            primary_city = unique_cities[0]
            secondary_cities = unique_cities[1:]
            
            destination_str = f"{primary_city} and {', '.join(secondary_cities)}"
            main_city_for_db = primary_city
            
            logger.info(f"Multi-city trip detected: {destination_str}")
            
        else:
            # Single city trip
            if all_countries:
                destination_str = Counter(all_countries).most_common(1)[0][0]
                # Extract city name from "City, Country"
                main_city_for_db = destination_str.split(',')[0].strip()
            else:
                destination_str = "Singapore"
                main_city_for_db = "Singapore"
            
            logger.info(f"Single city trip: {destination_str}")
        
        combined_additional_info = " ".join(all_additional_info) if all_additional_info else "No special requirements"
        
        avg_budget_min = sum(budget_min_vals) / len(budget_min_vals) if budget_min_vals else 1000
        avg_budget_max = sum(budget_max_vals) / len(budget_max_vals) if budget_max_vals else 5000
        
        # ========== BUILD AI PROMPT ==========
        
        user_emails = [pref.user.email for pref in preferences[:5]]
        user_list = ", ".join(user_emails)
        
        import random
        generation_seed = random.randint(1000, 9999)
        current_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        system_prompt = (
            "You are a travel planning AI. "
            "Return ONLY valid JSON. No markdown. No commentary. "
            "CRITICAL: Each generation MUST be COMPLETELY DIFFERENT from previous ones. "
            "Use DIFFERENT restaurants, DIFFERENT attractions, DIFFERENT neighborhoods. "
            "NEVER repeat the same places. Be creative and explore variety. "
            "CAREFULLY READ and STRICTLY FOLLOW all special requirements from users."
        )
        
        # EW: Different prompt for multi-city vs single-city
        if is_multi_city:
            # Multi-city prompt
            cities_list = " → ".join(unique_cities)
            
            # Calculate days per city (rough distribution)
            days_per_city = duration // len(unique_cities)
            remaining_days = duration % len(unique_cities)
            
            city_allocation = []
            for i, city in enumerate(unique_cities):
                days_in_city = days_per_city + (1 if i < remaining_days else 0)
                city_allocation.append(f"{city} ({days_in_city} days)")
            
            allocation_str = ", ".join(city_allocation)
            
            user_prompt = f"""
Create DETAILED {duration}-day MULTI-CITY trip: {cities_list}

⚠️ GENERATION #{generation_seed} at {current_timestamp}
⚠️ This MUST be COMPLETELY DIFFERENT from any previous generation!

DESTINATIONS: {destination_str}
CITY ALLOCATION: {allocation_str}

Group: {user_list}
Activities: {", ".join(top_activities[:2])}
Budget: ${int(avg_budget_max)}
Trip Duration: {duration} days

SPECIAL REQUIREMENTS FROM USERS (MUST FOLLOW STRICTLY):
{combined_additional_info}

JSON format:
{{
  "title": "Multi-City Adventure: {cities_list} (Generation #{generation_seed})",
  "main_city": "{primary_city}",
  "main_country": "United Kingdom",
  "days": {duration},
  "stops": [
    {{
      "day_index": 1,
      "title": "Place name",
      "description": "Short description",
      "item_type": "meal|transport|activity|sightseeing",
      "start_time": "08:00",
      "end_time": "09:00",
      "address": "City, Area",
      "lat": 51.5074,
      "lon": -0.1278
    }}
  ]
}}

MULTI-CITY REQUIREMENTS:
- Visit ALL cities: {', '.join(unique_cities)}
- Distribute days according to allocation: {allocation_str}
- Include TRAVEL days between cities (train/flight)
- Example structure for {duration} days:
  * Days 1-{days_per_city}: Activities in {unique_cities[0]}
  * Day {days_per_city + 1}: Travel from {unique_cities[0]} to {unique_cities[1 if len(unique_cities) > 1 else 0]} (train/flight)
  * Days {days_per_city + 2}-{duration}: Activities in {unique_cities[1 if len(unique_cities) > 1 else 0]}

GENERAL REQUIREMENTS:
- Generate EXACTLY {duration} days of itinerary
- 5-6 stops per day (breakfast, lunch, dinner, activities)
- Use REAL places in each city
- Coordinates must be accurate for each city
- Each regeneration must use DIFFERENT places
- Follow special requirements strictly

VARIETY RULES:
1. NEVER use same restaurants/attractions as previous generations
2. Explore DIFFERENT neighborhoods in each city
3. Try DIFFERENT cuisines and dining styles
4. Visit DIFFERENT types of attractions in each city
5. Show the unique character of each city

⚠️⚠️⚠️ CRITICAL TIME CONSTRAINTS (MUST FOLLOW) ⚠️⚠️⚠️
ALL times MUST be between 07:00 and 23:00 (7 AM - 11 PM)
ABSOLUTELY NO activities before 07:00 or after 23:00
Use 24-hour format (HH:MM)

REALISTIC DAILY SCHEDULE (5-6 stops per day):
- 07:00-09:00: Breakfast (meal) - morning dining
- 09:30-11:30: Morning activity (sightseeing/museums)
- 12:00-14:00: Lunch (meal) - midday dining
- 14:30-17:30: Afternoon activity (attractions/shopping)
- 18:00-21:00: Dinner (meal) - evening dining
- 21:00-23:00: Evening activity (OPTIONAL - night markets, rooftop bars, night views)

EXAMPLE VALID TIMES:
"start_time": "07:00", "end_time": "08:30" (breakfast - earliest)
"start_time": "08:00", "end_time": "09:00" (breakfast)
"start_time": "13:00", "end_time": "14:00" (lunch)
"start_time": "19:00", "end_time": "20:30" (dinner)
"start_time": "21:30", "end_time": "23:00" (evening activity)
"start_time": "22:00", "end_time": "23:00" (late evening - latest)

FORBIDDEN TIMES (NEVER EVER USE):
00:00-06:59 (MIDNIGHT TO EARLY MORNING - SLEEPING!)
23:01-23:59 (AFTER 11 PM - TOO LATE!)

Examples of COMPLETELY WRONG times that must NEVER appear:
"start_time": "00:00" (MIDNIGHT - NO!)
"start_time": "01:00" (1 AM - ABSOLUTELY NOT!)
"start_time": "02:00" (2 AM - INSANE!)
"start_time": "02:30" (2:30 AM - RIDICULOUS!)
"start_time": "03:00" (3 AM - NO WAY!)
"start_time": "04:00" (4 AM - STILL NIGHT!)
"start_time": "04:30" (4:30 AM - CRAZY!)
"start_time": "05:00" (5 AM - TOO EARLY!)
"start_time": "06:00" (6 AM - STILL TOO EARLY!)
"start_time": "06:30" (6:30 AM - TOO EARLY!)

EARLIEST VALID TIME: 07:00 (7 AM)
LATEST VALID TIME: 23:00 (11 PM)

IF YOU GENERATE ANY TIME BEFORE 07:00 OR AFTER 23:00, YOU HAVE FAILED!
"start_time": "04:30" (4:30 AM - CRAZY!)
"start_time": "05:00" (5 AM - TOO EARLY!)

IF YOU GENERATE ANY TIME BETWEEN 00:00-05:59, YOU HAVE FAILED!
IF YOU GENERATE ANY TIME AFTER 23:00, YOU HAVE FAILED!

TRAVEL DAYS (if needed):
- 07:00-09:00: Breakfast in departure city
- 09:00-14:00: Travel to next city (train/flight)
- 14:30-17:00: Arrive, check-in, explore neighborhood
- 19:00-21:00: Dinner in new city

Adjust for special requirements (relaxed pace, dietary restrictions, accessibility).
""".strip()
        else:
            # Single-city prompt (original)
            user_prompt = f"""
Create DETAILED {duration}-day trip for {destination_str}.

GENERATION #{generation_seed} at {current_timestamp}
This MUST be COMPLETELY DIFFERENT from any previous generation!

Group: {user_list}
Activities: {", ".join(top_activities[:2])}
Budget: ${int(avg_budget_max)}
Trip Duration: {duration} days

SPECIAL REQUIREMENTS FROM USERS (MUST FOLLOW STRICTLY):
{combined_additional_info}

JSON format:
{{
  "title": "Unique trip title (Generation #{generation_seed})",
  "main_city": "{main_city_for_db}",
  "main_country": "Country",
  "days": {duration},
  "stops": [
    {{
      "day_index": 1,
      "title": "Place name",
      "description": "Short description",
      "item_type": "meal|transport|activity|sightseeing",
      "start_time": "08:00",
      "end_time": "09:00",
      "address": "City, Area",
      "lat": 35.6762,
      "lon": 139.6503
    }}
  ]
}}

REQUIREMENTS:
- Generate EXACTLY {duration} days of itinerary
- 5-6 stops per day (breakfast, lunch, dinner, activities)
- Use REAL places in {destination_str}
- Coordinates must be accurate
- Each regeneration must use DIFFERENT places
- Follow special requirements strictly

⚠️⚠️⚠️ CRITICAL TIME CONSTRAINTS (MUST FOLLOW) ⚠️⚠️⚠️
ALL times MUST be between 07:00 and 23:00 (7 AM - 11 PM)
ABSOLUTELY NO activities before 07:00 or after 23:00
Use 24-hour format (HH:MM)

VARIETY RULES:
1. NEVER use same restaurants/attractions as previous generations
2. Explore DIFFERENT neighborhoods each time
3. Try DIFFERENT cuisines and dining styles
4. Visit DIFFERENT types of attractions
5. Change daily themes and flow

REALISTIC DAILY SCHEDULE (5-6 stops per day):
- 07:00-09:00: Breakfast (meal) - morning dining
- 09:30-11:30: Morning activity (sightseeing/museums)
- 12:00-14:00: Lunch (meal) - midday dining
- 14:30-17:30: Afternoon activity (attractions/shopping)
- 18:00-21:00: Dinner (meal) - evening dining
- 21:00-23:00: Evening activity (OPTIONAL - night markets, rooftop bars, night views)

EXAMPLE VALID TIMES:
"start_time": "07:00", "end_time": "08:30" (breakfast - earliest)
"start_time": "08:00", "end_time": "09:00" (breakfast)
"start_time": "13:00", "end_time": "14:00" (lunch)
"start_time": "19:00", "end_time": "20:30" (dinner)
"start_time": "22:00", "end_time": "23:00" (late evening - latest)

FORBIDDEN TIMES (NEVER USE):
00:00-06:59 (midnight to early morning - sleeping!)
23:01-23:59 (after 11 PM - too late!)
Examples of WRONG times to AVOID:
"start_time": "02:30" (2:30 AM - NO!)
"start_time": "04:00" (4 AM - NO!)
"start_time": "06:00" (6 AM - TOO EARLY!)

EARLIEST VALID TIME: 07:00 (7 AM)
LATEST VALID TIME: 23:00 (11 PM)
"start_time": "04:00" (4 AM - NO!)
"start_time": "01:00" (1 AM - NO!)

Adjust for special requirements (relaxed pace, dietary restrictions, accessibility).
""".strip()

        # ========== CALL AI ==========
        
        logger.info(f"🤖 Calling AI to generate {duration}-day itinerary (Generation #{generation_seed})...")
        logger.info(f"🌍 Type: {'Multi-city' if is_multi_city else 'Single-city'}")
        
        ai_content, provider, primary_error, fallback_error = _generate_with_fallback(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.95,
            max_tokens=8000,
            timeout=180,
        )

        if not ai_content:
            logger.error(f"Both AI providers failed: sealion={primary_error}, gemini={fallback_error}")
            trip.travel_type = "draft"
            trip.save()
            return Response(
                {"detail": "AI service unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        logger.info(f"AI response received from {provider}, length: {len(ai_content)}")

        # ========== CLEAN AND PARSE ==========
        
        cleaned_ai_content = ai_content.strip()
        
        if cleaned_ai_content.startswith("```"):
            lines = cleaned_ai_content.split('\n')
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned_ai_content = '\n'.join(lines).strip()
        
        cleaned_ai_content = cleaned_ai_content.strip('`').strip()
        
        is_truncated = not cleaned_ai_content.endswith('}')
        
        if is_truncated:
            logger.warning("AI response truncated, repairing...")
            last_complete_item = cleaned_ai_content.rfind('},')
            if last_complete_item > 0:
                cleaned_ai_content = cleaned_ai_content[:last_complete_item + 1]
                cleaned_ai_content += '\n  ]\n}'
                logger.info("Repaired by removing incomplete items")
            else:
                logger.error("Cannot repair truncated response")
                trip.travel_type = "draft"
                trip.save()
                return Response(
                    {"detail": "AI response was truncated. Please try again."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
        
        if not cleaned_ai_content.startswith('{'):
            start_idx = cleaned_ai_content.find('{')
            end_idx = cleaned_ai_content.rfind('}')
            if start_idx != -1 and end_idx != -1:
                cleaned_ai_content = cleaned_ai_content[start_idx:end_idx+1]

        try:
            itinerary = json.loads(cleaned_ai_content)
            logger.info("JSON parsed successfully")
        except Exception as e:
            logger.error(f"JSON parse failed: {str(e)}")
            trip.travel_type = "draft"
            trip.save()
            return Response(
                {"detail": f"AI returned invalid JSON: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        stops = itinerary.get("stops", [])
        if not stops:
            trip.travel_type = "draft"
            trip.save()
            return Response(
                {"detail": "AI returned no activities. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        logger.info(f"Successfully parsed {len(stops)} stops")

        # ========== UPDATE DATABASE ==========
        
        logger.info(f"Creating itinerary in database...")
        
        with transaction.atomic():
            trip.title = itinerary.get("title", f"Group Trip to {destination_str}")
            trip.main_city = itinerary.get("main_city", main_city_for_db)
            trip.main_country = itinerary.get("main_country", "United Kingdom")
            trip.travel_type = "group_ai"
            trip.save()
            
            logger.info(f"Updated trip: {trip.title}")
            logger.info(f"  Dates: {trip.start_date} to {trip.end_date}")
            
            # Delete old itinerary for clean regeneration
            TripDay.objects.filter(trip=trip).delete()
            ItineraryItem.objects.filter(trip=trip).delete()
            logger.info(f"Deleted old itinerary data")
            
            # Create days with correct dates
            trip_days = []
            for i in range(duration):
                day_date = trip.start_date + timedelta(days=i)
                logger.info(f"Creating Day {i+1}: {day_date}")
                
                trip_days.append(
                    TripDay(trip=trip, day_index=i + 1, date=day_date)
                )
            
            TripDay.objects.bulk_create(trip_days)
            logger.info(f"Created {len(trip_days)} days")
            
            day_map = {d.day_index: d for d in TripDay.objects.filter(trip=trip)}
            
            items = []
            sort_order = 1

            for stop in stops:
                day_index = int(stop.get("day_index", 1) or 1)
                if day_index < 1:
                    day_index = 1
                if day_index > duration:
                    day_index = duration
                
                day = day_map.get(day_index)
                
                start_time_str = stop.get("start_time", "09:00")
                end_time_str = stop.get("end_time", "10:00")
                
                start_datetime = None
                end_datetime = None
                
                if day and day.date and start_time_str:
                    try:
                        start_datetime = datetime.combine(
                            day.date, 
                            datetime.strptime(start_time_str, "%H:%M").time()
                        )
                    except (ValueError, AttributeError):
                        pass
                
                if day and day.date and end_time_str:
                    try:
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
                logger.info(f"✅ Created {len(items)} items")

            if avg_budget_max:
                TripBudget.objects.update_or_create(
                    trip=trip,
                    defaults={
                        "currency": "USD",
                        "planned_total": avg_budget_max,
                    },
                )

        logger.info(f"🎉 Successfully generated {duration}-day {'multi-city' if is_multi_city else 'single-city'} itinerary for trip {trip_id} using {provider}")

        return Response(
            {
                "message": "Group itinerary generated",
                "trip_id": trip_id,
                "title": trip.title,
                "destination": destination_str,
                "cities": unique_cities if is_multi_city else [main_city_for_db],
                "is_multi_city": is_multi_city,
                "days": duration,
                "start_date": str(trip.start_date),
                "end_date": str(trip.end_date),
                "items_created": len(items),
                "provider": provider,
            },
            status=status.HTTP_200_OK
        )