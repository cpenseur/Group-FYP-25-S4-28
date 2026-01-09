# backend/TripMateFunctions/views/f2_2_views.py
import json
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from collections import Counter

from TripMateFunctions.models import (
    Trip, 
    GroupPreference, 
    TripDay, 
    ItineraryItem,
    TripBudget,
    TripCollaborator
)

# Import AI generation functions from f1_3_views
from .f1_3_views import _generate_with_fallback

logger = logging.getLogger(__name__)


class TripGroupPreferencesAPIView(APIView):
    """
    F2.2 - Get group preferences for a trip (Group Preferences Summary)

    GET /api/f2/trips/{trip_id}/preferences/
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
                "user_id": str(p.user.id),
                "username": p.user.full_name or p.user.email,
                "email": p.user.email,
                "preferences": p.preferences,
                "is_owner": p.user.id == trip.owner.id,
            })

        return Response(data, status=status.HTTP_200_OK)


class F22GroupTripGeneratorView(APIView):
    """
    F2.2 - Group Trip Generator with SeaLion AI

    POST /api/f2/trips/{trip_id}/generate-group-itinerary/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, trip_id):
        logger.info(f"🚀 Starting group itinerary generation for trip {trip_id}")
        
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            logger.error(f"❌ Trip {trip_id} not found")
            return Response(
                {"error": "Trip not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get current authenticated user
        current_user = request.user
        
        # Check if user is authenticated
        if not current_user or not current_user.is_authenticated:
            logger.error("❌ User not authenticated")
            return Response(
                {"error": "Authentication required"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if user is the trip owner
        if str(trip.owner_id) != str(current_user.id):
            logger.error(f"❌ User {current_user.id} is not owner of trip {trip_id}")
            return Response(
                {"error": "Only trip owner can generate itinerary"},
                status=status.HTTP_403_FORBIDDEN
            )

        # Get all group preferences for this trip
        preferences = GroupPreference.objects.filter(trip=trip).select_related('user')
        
        if preferences.count() == 0:
            logger.error(f"❌ No preferences found for trip {trip_id}")
            return Response(
                {"error": "No preferences found. Please save preferences first."},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f"📋 Found {preferences.count()} user preferences")

        # ========== SET STATUS TO GENERATING ==========
        trip.travel_type = "group_generating"
        trip.save(update_fields=['travel_type'])
        logger.info(f"✅ Set trip {trip_id} status to 'group_generating'")

        # ========== MERGE GROUP PREFERENCES ==========
        
        all_activities = []
        all_destinations = []
        budget_min_vals = []
        budget_max_vals = []
        
        for pref in preferences:
            prefs_data = pref.preferences or []
            
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
        
        # Get top preferences
        top_activities = [act for act, _ in Counter(all_activities).most_common(5)] if all_activities else ["Sightseeing", "Food"]
        top_destinations = [dest for dest, _ in Counter(all_destinations).most_common(3)] if all_destinations else ["Urban", "Cultural"]
        
        avg_budget_min = sum(budget_min_vals) / len(budget_min_vals) if budget_min_vals else 1000
        avg_budget_max = sum(budget_max_vals) / len(budget_max_vals) if budget_max_vals else 5000
        
        logger.info(f"📊 Merged preferences: activities={top_activities}, destinations={top_destinations}")
        logger.info(f"🌍 AI will generate itinerary for: {', '.join(top_destinations)}")
        
        # Calculate trip duration
        if trip.start_date and trip.end_date:
            duration = (trip.end_date - trip.start_date).days + 1
            if duration < 1:
                duration = 3
        else:
            duration = 3
        
        logger.info(f"📅 Trip duration: {duration} days")
        
        # ========== BUILD AI PROMPT ==========
        
        user_emails = [pref.user.email for pref in preferences[:5]]
        user_list = ", ".join(user_emails)
        
        system_prompt = (
            "You are a travel planning AI. "
            "CRITICAL: You MUST create itineraries ONLY for the destinations specified by the user. "
            "NEVER generate itineraries for locations not requested by the user. "
            "The main_city and main_country in your JSON output MUST match the user's requested destinations. "
            "Return ONLY valid JSON. No markdown. No commentary."
        )
        
        user_prompt = f"""
Create a GROUP travel itinerary for {preferences.count()} travelers.

Group members: {user_list}

Trip duration: {duration} days
Preferred activities (from group): {", ".join(top_activities)}
DESTINATION: You MUST create an itinerary for these destinations: {", ".join(top_destinations)}
Average budget range: ${int(avg_budget_min)} - ${int(avg_budget_max)}

Requirements:
- Plan 3-4 activities per day in the specified destinations: {", ".join(top_destinations)}
- The main_city and main_country in JSON MUST match one of these destinations
- Include a mix of all group preferences
- Suggest real places and attractions in the specified destinations
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
        
        logger.info(f"🤖 Calling AI API...")
        
        ai_content, provider, primary_error, fallback_error = _generate_with_fallback(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=5000,  # Increased from 1500 to 5000 to avoid JSON truncation for longer trips
            timeout=90,  # Increased timeout to 90s for longer responses
        )

        if not ai_content:
            logger.error(f"❌ AI generation failed: primary={primary_error}, fallback={fallback_error}")
            # Revert status
            trip.travel_type = "group"
            trip.save(update_fields=['travel_type'])
            return Response(
                {"detail": "AI service unavailable. Please try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        logger.info(f"✅ AI response received from {provider}")

        # Clean AI response
        cleaned_ai_content = ai_content.strip()
        if cleaned_ai_content.startswith("```"):
            cleaned_ai_content = cleaned_ai_content.strip("`")
            if cleaned_ai_content.startswith("json"):
                cleaned_ai_content = cleaned_ai_content[4:].strip()

        try:
            itinerary = json.loads(cleaned_ai_content)
        except Exception as e:
            logger.error(f"❌ Failed to parse AI JSON: {str(e)}")
            logger.error(f"Raw response: {cleaned_ai_content[:500]}")
            # Revert status
            trip.travel_type = "group"
            trip.save(update_fields=['travel_type'])
            return Response(
                {"detail": f"AI returned invalid JSON: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        
        # ========== VALIDATE AI OUTPUT MATCHES USER PREFERENCES ==========
        
        ai_city = itinerary.get("main_city", "").lower()
        ai_country = itinerary.get("main_country", "").lower()
        ai_location = f"{ai_city}, {ai_country}"
        
        logger.info(f"🏙️ AI generated city: {itinerary.get('main_city')}")
        logger.info(f"🌍 AI generated country: {itinerary.get('main_country')}")
        
        # Check if AI's location matches any of the user's preferred destinations
        user_destinations_lower = [dest.lower() for dest in top_destinations]
        
        location_matches = False
        for user_dest in user_destinations_lower:
            # Check if user destination contains AI location or vice versa
            if (user_dest in ai_location or 
                ai_location in user_dest or 
                ai_city in user_dest or 
                ai_country in user_dest):
                location_matches = True
                logger.info(f"✅ AI location matches user preference: {user_dest}")
                break
        
        if not location_matches:
            logger.error(f"❌ AI IGNORED USER DESTINATION!")
            logger.error(f"   User wanted: {top_destinations}")
            logger.error(f"   AI generated: {ai_location}")
            logger.error(f"   This is a critical error - AI must respect user preferences!")
            
            # Revert status and return error
            trip.travel_type = "group"
            trip.save(update_fields=['travel_type'])
            
            return Response(
                {
                    "detail": f"AI generated wrong destination. You requested {', '.join(top_destinations)} but AI generated {itinerary.get('main_city', 'Unknown')}, {itinerary.get('main_country', 'Unknown')}. Please try again.",
                    "user_destinations": top_destinations,
                    "ai_generated": f"{itinerary.get('main_city')}, {itinerary.get('main_country')}"
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ========== UPDATE DATABASE ==========
        
        logger.info(f"💾 Saving itinerary to database...")
        
        try:
            with transaction.atomic():
                # Update trip metadata
                trip.title = itinerary.get("title", f"Group Trip - {trip.id}")
                trip.main_city = itinerary.get("main_city", "Unspecified")
                trip.main_country = itinerary.get("main_country", "")
                trip.travel_type = "group_ai"  # Mark as completed
                trip.save()
                
                logger.info(f"✅ Updated trip: {trip.title}")
                
                # Delete existing days/items
                TripDay.objects.filter(trip=trip).delete()
                ItineraryItem.objects.filter(trip=trip).delete()
                
                # Create TripDays
                trip_days = []
                for i in range(duration):
                    day_date = None
                    if trip.start_date:
                        day_date = trip.start_date + timedelta(days=i)
                    
                    trip_days.append(
                        TripDay(trip=trip, day_index=i + 1, date=day_date)
                    )
                
                TripDay.objects.bulk_create(trip_days)
                logger.info(f"✅ Created {len(trip_days)} trip days")
                
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
                    
                    # Parse times
                    start_time_str = stop.get("start_time", "09:00")
                    end_time_str = stop.get("end_time", "10:00")
                    
                    start_datetime = None
                    end_datetime = None
                    
                    if day and day.date and start_time_str:
                        try:
                            from datetime import datetime
                            start_datetime = timezone.make_aware(
                                datetime.combine(
                                    day.date, 
                                    datetime.strptime(start_time_str, "%H:%M").time()
                                )
                            )
                        except (ValueError, AttributeError):
                            pass
                    
                    if day and day.date and end_time_str:
                        try:
                            from datetime import datetime
                            end_datetime = timezone.make_aware(
                                datetime.combine(
                                    day.date, 
                                    datetime.strptime(end_time_str, "%H:%M").time()
                                )
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
                    logger.info(f"✅ Created {len(items)} itinerary items")
                
                # Update budget
                if avg_budget_max:
                    TripBudget.objects.update_or_create(
                        trip=trip,
                        defaults={
                            "currency": "USD",
                            "planned_total": avg_budget_max,
                        },
                    )
                    logger.info(f"✅ Updated budget: ${avg_budget_max}")

            logger.info(f"🎉 Successfully generated group itinerary for trip {trip_id}")

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
            
        except Exception as e:
            logger.error(f"❌ Database error: {str(e)}")
            # Revert status on error
            trip.travel_type = "group"
            trip.save(update_fields=['travel_type'])
            return Response(
                {"detail": f"Failed to save itinerary: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )