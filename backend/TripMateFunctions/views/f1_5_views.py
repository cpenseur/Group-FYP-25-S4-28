"""
F1.5 - AI-Powered Recommendations (Real-time AI, No Database)

UPDATED: Now includes user profile preferences for personalized recommendations
- User-specific preferences from Profile model
- Each user gets personalized recommendations (not shared with collaborators)
- Better day-specific location detection and city filtering
- Allows both trip owners AND collaborators to access recommendations
"""

import os
import json
import logging
import requests
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from math import radians, sin, cos, sqrt, atan2
import re

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.db.models import Q, Max

from ..models import Trip, TripDay, ItineraryItem, AppUser, Profile

logger = logging.getLogger(__name__)


# ============================================================================
# Helper: SeaLion AI Client
# ============================================================================

def call_sealion_ai(prompt: str, temperature: float = 0.7, max_tokens: int = 2000) -> str:
    """Call SeaLion AI and return response."""
    api_key = getattr(settings, "SEA_LION_API_KEY", None) or os.environ.get("SEA_LION_API_KEY")
    if not api_key:
        raise Exception("SEA_LION_API_KEY not configured")
    
    messages = [{"role": "user", "content": prompt}]
    
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
                "temperature": temperature,
                "max_completion_tokens": max_tokens,
            },
            timeout=40,
        )
    except requests.RequestException as exc:
        logger.error(f"SeaLion API network error: {exc}")
        raise Exception(f"Network error: {exc}")
    
    if not resp.ok:
        logger.error(f"SeaLion API returned status {resp.status_code}: {resp.text}")
        raise Exception(f"SeaLion API error: {resp.status_code}")
    
    try:
        data_json = resp.json()
        content = (
            data_json.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        return content
    except Exception as e:
        logger.error(f"Failed to parse SeaLion response: {e}")
        raise Exception(f"Failed to parse response: {e}")


# ============================================================================
# F1.5 - AI Recommendations View (WITH USER PROFILE PREFERENCES)
# ============================================================================

class AIRecommendationsView(APIView):
    """
    GET/POST /f1/recommendations/ai/?trip_id=367&day_index=1&location=Sydney
    
    UPDATED VERSION:
    - ✅ Uses current user's profile preferences (NOT collaborators)
    - ✅ Personalized recommendations per user
    - Better location detection from addresses
    - More comprehensive city filtering
    - Day-specific recommendations
    - Allows both owners AND collaborators
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        """Handle GET requests"""
        return self._handle_request(request)
    
    def post(self, request, *args, **kwargs):
        """Handle POST requests"""
        return self._handle_request(request)
    
    def _handle_request(self, request):
        """Main request handler"""
        
        trip_id = request.query_params.get('trip_id') or request.data.get('trip_id')
        day_index_param = request.query_params.get('day_index') or request.data.get('day_index')
        location_override = request.query_params.get('location') or request.data.get('location')
        
        if not trip_id:
            return Response(
                {"success": False, "error": "trip_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get AppUser
        user = request.user
        try:
            if hasattr(user, 'email'):
                app_user = AppUser.objects.get(email=user.email)
            else:
                app_user = user
        except AppUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Fetch CURRENT USER'S profile preferences (NOT collaborators)
        user_preferences = self._get_user_preferences(app_user)
        logger.info(f"✅ Loaded preferences for {app_user.email}: {user_preferences}")
        
        # Verify trip access
        try:
            trip = Trip.objects.filter(
                Q(id=trip_id) & (Q(owner=app_user) | Q(collaborators__user=app_user))
            ).distinct().first()
            
            if not trip:
                return Response(
                    {"success": False, "error": "Trip not found or you don't have permission"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            all_items = ItineraryItem.objects.filter(trip=trip).order_by('day__day_index', 'sort_order')
            
            # Determine target day
            target_day_index = None
            day_items = list(all_items)
            destination = location_override or trip.main_city or trip.main_country or "Unknown"
            trip_country = trip.main_country or "Unknown"
            
            if day_index_param is not None:
                try:
                    day_index_query = int(day_index_param) + 1
                    target_day_index = int(day_index_param)
                    
                    logger.info(f"🔍 Looking for day_index={day_index_query}")
                    
                    target_day = TripDay.objects.filter(
                        trip=trip, 
                        day_index=day_index_query
                    ).first()
                    
                    if target_day:
                        day_items = list(ItineraryItem.objects.filter(
                            trip=trip, 
                            day=target_day
                        ).order_by('sort_order'))
                        
                        if not location_override and day_items:
                            detected_location = self._detect_location_from_items(day_items)
                            if detected_location:
                                destination = detected_location
                                logger.info(f"✅ Detected location: {destination}")
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid day_index: {e}")
            
            logger.info(f"🎯 Final destination: {destination}")
            logger.info(f"🌍 Trip country: {trip_country}")
            
            itinerary_hash = self._compute_itinerary_hash(day_items)
            
            # ====================================================================
            # GENERATE PERSONALIZED RECOMMENDATIONS (WITH USER PREFERENCES)
            # ====================================================================
            categories = self._generate_categorized_recommendations(
                destination=destination,
                trip=trip,
                items=day_items,
                day_index=target_day_index,
                user_preferences=user_preferences  # NEW: Pass user preferences
            )
            
            return Response({
                "success": True,
                "destination": destination,
                "day_index": target_day_index,
                "itinerary_hash": itinerary_hash,
                "categories": categories,
                "personalized": True,
            })
            
        except Exception as e:
            logger.error(f"AI recommendations failed: {e}", exc_info=True)
            return Response({
                "success": True,
                "destination": "Unknown",
                "day_index": None,
                "itinerary_hash": "",
                "categories": self._fallback_categories(),
                "personalized": False,
            })
    
    def _get_user_preferences(self, app_user: AppUser) -> Dict[str, Any]:
        """
        Fetch the current user's profile preferences.
        Returns preferences for THIS user only (not collaborators).
        """
        try:
            profile = Profile.objects.get(id=app_user.id)
            return {
                'interests': profile.interests or [],
                'travel_pace': profile.travel_pace,
                'budget_level': profile.budget_level,
                'diet_preference': profile.diet_preference,
                'mobility_needs': profile.mobility_needs,
                'name': profile.name or app_user.full_name or 'Traveler',
            }
        except Profile.DoesNotExist:
            logger.warning(f"No profile found for {app_user.email}, using defaults")
            return {
                'interests': [],
                'travel_pace': None,
                'budget_level': None,
                'diet_preference': None,
                'mobility_needs': None,
                'name': app_user.full_name or 'Traveler',
            }
    
    def _detect_location_from_items(self, items: List[ItineraryItem]) -> str:
        """
        IMPROVED: Detect the primary location from a list of itinerary items.
        Extracts city names more accurately from addresses.
        """
        if not items:
            return ""
        
        cities = []
        countries = []
        
        logger.info("🔍 Starting location detection from addresses...")
        
        # Method 1: Extract from addresses (most reliable)
        for item in items:
            if not item.address:
                logger.info(f"  ❌ {item.title}: No address")
                continue
                
            # Split address by commas
            parts = [p.strip() for p in item.address.split(',')]
            
            logger.info(f"  📍 {item.title}: {item.address}")
            logger.info(f"     Address parts: {parts}")
            
            # Try multiple strategies to extract city
            detected_city = None
            
            # Strategy 1: For Japan addresses (format: Place, District/Ward, City, Prefecture, Country)
            # Example: "Tsukiji Fish Market, Tsukiji, Chuo City, Tokyo, Japan"
            # City is usually at index -3 (third from end)
            if len(parts) >= 3:
                potential_city = parts[-3].strip()
                # Check if it looks like a city (not "Japan" or prefecture names)
                if potential_city.lower() not in ['japan', 'prefecture']:
                    # Clean up common suffixes
                    for suffix in [' City', ' Prefecture', ' Ward', ' District']:
                        if potential_city.endswith(suffix):
                            potential_city = potential_city[:-len(suffix)].strip()
                    
                    detected_city = potential_city
                    logger.info(f"     ✅ Strategy 1 (index -3): Detected '{detected_city}'")
            
            # Strategy 2: For simpler addresses (Place, City, Country)
            # Example: "Sapporo Clock Tower, Sapporo, Japan"
            if not detected_city and len(parts) >= 2:
                potential_city = parts[-2].strip()
                if potential_city.lower() != 'japan':
                    for suffix in [' City', ' Prefecture']:
                        if potential_city.endswith(suffix):
                            potential_city = potential_city[:-len(suffix)].strip()
                    
                    detected_city = potential_city
                    logger.info(f"     ✅ Strategy 2 (index -2): Detected '{detected_city}'")
            
            # Strategy 3: Check for major city names in any part of address
            if not detected_city:
                major_cities = [
                    'Tokyo', 'Osaka', 'Kyoto', 'Sapporo', 'Hokkaido', 'Fukuoka',
                    'Yokohama', 'Nagoya', 'Kobe', 'Hiroshima', 'Sendai', 'Nara',
                    'Singapore', 'Kuala Lumpur', 'Bangkok', 'Hanoi', 'Seoul'
                ]
                
                for part in parts:
                    for city in major_cities:
                        if city.lower() in part.lower():
                            detected_city = city
                            logger.info(f"     ✅ Strategy 3 (major cities): Detected '{detected_city}'")
                            break
                    if detected_city:
                        break
            
            if detected_city:
                cities.append(detected_city)
                logger.info(f"     ✅ Final detected city: '{detected_city}'")
            else:
                logger.info(f"     ❌ Could not detect city from address")
        
        # Method 2: Check item titles for city names (backup)
        if not cities:
            logger.info("📝 No cities found in addresses, checking titles...")
            
            for item in items:
                title_lower = item.title.lower() if item.title else ""
                
                # Check for common city names in title
                city_map = {
                    'sapporo': 'Sapporo',
                    'hokkaido': 'Hokkaido',
                    'tokyo': 'Tokyo',
                    'kyoto': 'Kyoto',
                    'osaka': 'Osaka',
                    'singapore': 'Singapore',
                    'bangkok': 'Bangkok',
                }
                
                for keyword, city_name in city_map.items():
                    if keyword in title_lower:
                        cities.append(city_name)
                        logger.info(f"  ✅ Found {city_name} in title: {item.title}")
                        break
        
        # Return most common city, or first one
        if cities:
            from collections import Counter
            city_counts = Counter(cities)
            most_common = city_counts.most_common(1)
            detected_city = most_common[0][0]
            
            logger.info(f"📊 City frequency: {dict(city_counts)}")
            logger.info(f"✅ FINAL DETECTED LOCATION: {detected_city} (appears {city_counts[detected_city]} times)")
            
            return detected_city
        
        logger.warning("❌ Could not detect any location from items")
        return ""
    
    def _compute_itinerary_hash(self, items) -> str:
        """Generate itinerary hash."""
        import hashlib
        items_str = ",".join([f"{item.id}:{item.sort_order}" for item in items])
        return hashlib.md5(items_str.encode()).hexdigest()[:8]
    
    def _generate_categorized_recommendations(
        self, 
        destination: str, 
        trip: Trip,
        items: List[ItineraryItem],
        day_index: int = None,
        user_preferences: Dict[str, Any] = None  # NEW: User preferences parameter
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Generate recommendations in 3 categories for specific day/location.
        NOW WITH USER PREFERENCES for personalization.
        """
        
        existing_places = [item.title for item in items if item.title]
        existing_places_str = ", ".join(existing_places[:8]) if existing_places else "none yet"
        
        if day_index is not None:
            trip_context = f"Day {day_index + 1} of trip in {destination}"
        else:
            trip_duration = len(set(item.day_id for item in items if item.day_id)) or 1
            trip_context = f"{trip_duration}-day trip to {destination}"
        
        if user_preferences is None:
            user_preferences = {
                'interests': [],
                'travel_pace': None,
                'budget_level': None,
                'diet_preference': None,
                'mobility_needs': None,
                'name': 'Traveler',
            }
        
        categories = {}
        
        # 1. NEARBY: Places near current itinerary (day-specific + personalized)
        categories["nearby"] = self._generate_nearby_recommendations(
            destination, existing_places_str, trip_context, user_preferences, trip_country
        )
        
        # 2. FOOD: Dining experiences (location-specific + personalized)
        categories["food"] = self._generate_food_recommendations(
            destination, trip_context, user_preferences, trip_country
        )
        
        # 3. CULTURE: Cultural attractions (location-specific + personalized)
        categories["culture"] = self._generate_culture_recommendations(
            destination, trip_context, user_preferences, trip_country
        )
        
        return categories
    
    def _build_preference_context(self, user_preferences: Dict[str, Any]) -> str:
        """Build a string describing user preferences for AI prompt."""
        
        parts = []
        
        if user_preferences.get('interests'):
            interests_str = ", ".join(user_preferences['interests'])
            parts.append(f"Interests: {interests_str}")
        
        if user_preferences.get('travel_pace'):
            parts.append(f"Pace: {user_preferences['travel_pace']}")
        
        if user_preferences.get('budget_level'):
            parts.append(f"Budget: {user_preferences['budget_level']}")
        
        if user_preferences.get('diet_preference'):
            parts.append(f"Diet: {user_preferences['diet_preference']}")
        
        if user_preferences.get('mobility_needs'):
            parts.append(f"Mobility: {user_preferences['mobility_needs']}")
        
        if parts:
            return "USER PREFERENCES: " + " | ".join(parts)
        else:
            return ""
    
    def _generate_nearby_recommendations(
        self, 
        destination: str, 
        existing_places: str, 
        trip_context: str,
        user_preferences: Dict[str, Any],
        trip_country: str,
    ) -> List[Dict[str, Any]]:
        """Generate nearby recommendations with STRICT distance and country requirements."""
        
        pref_context = self._build_preference_context(user_preferences)
        
        personalization = ""
        if user_preferences.get('interests'):
            interests = ", ".join(user_preferences['interests'])
            personalization += f"\n- Focus on places related to: {interests}"
        
        if user_preferences.get('budget_level'):
            if user_preferences['budget_level'].lower() in ['budget', 'low']:
                personalization += f"\n- Prioritize FREE or low-cost options"
            elif user_preferences['budget_level'].lower() in ['luxury', 'high']:
                personalization += f"\n- Include premium experiences"
        
        if user_preferences.get('mobility_needs') and user_preferences['mobility_needs'].lower() != 'none':
            personalization += f"\n- Ensure accessibility for: {user_preferences['mobility_needs']}"
        
        if user_preferences.get('travel_pace'):
            if user_preferences['travel_pace'].lower() in ['relaxed', 'slow']:
                personalization += f"\n- Suggest leisurely activities, avoid rushed itineraries"
            elif user_preferences['travel_pace'].lower() in ['fast', 'packed']:
                personalization += f"\n- Include activities that can be done efficiently"
        
        prompt = f"""You are a local travel expert in {destination}. The user is planning a {trip_context}.

{pref_context}

Current itinerary includes: {existing_places}

Suggest 3-4 NEARBY places they should add to their {destination} itinerary.

⚠️ CRITICAL LOCATION REQUIREMENTS:
1. ALL suggestions MUST be in {destination}, {trip_country}
2. DO NOT suggest places in other countries (e.g., if {trip_country} is Australia, DO NOT suggest places in USA, UK, etc.)
3. ALL suggestions MUST be within {destination} CITY CENTER (not surrounding suburbs or other cities!)
4. Maximum distance: 10-15 km from {destination} city center
5. Must be reachable within 30-45 minutes by public transport from city center
6. DO NOT suggest places in distant suburbs, rural areas, or other cities in the same country

LOCATION VERIFICATION EXAMPLES:
✅ CORRECT for "Sydney, Australia": Bondi Beach, Darling Harbour, Circular Quay, Opera House
❌ WRONG for "Sydney, Australia": Blue Mountains (too far), Byron Bay (different city), Museum of Contemporary Art in Rock Hill South Carolina USA (WRONG COUNTRY!)

✅ CORRECT for "Melbourne, Australia": Federation Square, St Kilda Beach, Queen Victoria Market
❌ WRONG for "Melbourne, Australia": Great Ocean Road (200+ km), Phillip Island (140+ km)

✅ CORRECT for "Tokyo, Japan": Senso-ji Temple, Shibuya Crossing, Meiji Shrine
❌ WRONG for "Tokyo, Japan": Mount Fuji (100+ km), Osaka (500+ km)

PERSONALIZATION REQUIREMENTS:{personalization}

OTHER REQUIREMENTS:
- Must complement what they already have
- Must match user's interests and preferences
- Must be diverse (different types of attractions)
- Must be real, well-known places in {destination}

Format as JSON array:
[
  {{
    "name": "Place name (must be in {destination})",
    "description": "Why visit (explain how it matches user's preferences, max 100 chars)",
    "category": "nearby",
    "duration": "1-2 hours",
    "cost": "Free",
    "best_time": "Morning",
    "highlight": false,
    "nearby_to": "Name of existing stop it's near",
    "matched_preferences": ["Interest: culture", "Budget: free"]
  }}
]

IMPORTANT: The "matched_preferences" field should list which user preferences this recommendation matches.
Examples:
- If matches interest in "food": ["Interest: food"]
- If matches budget preference "budget": ["Budget-friendly"]
- If matches diet "vegetarian": ["Vegetarian options"]
- If accessible: ["Wheelchair accessible"]

VERIFY: Each suggestion is actually located in {destination} AND matches user preferences!

Mark the BEST recommendation (that best matches user preferences) with "highlight": true.
Keep descriptions under 100 characters.
Use realistic costs matching user's budget preference.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} personalized nearby recommendations for {destination}")
            return filtered
        except Exception as e:
            logger.warning(f"AI nearby recommendations failed: {e}")
            return self._fallback_nearby(destination)
    
    def _generate_food_recommendations(
        self, 
        destination: str, 
        trip_context: str,
        user_preferences: Dict[str, Any],
        trip_country: str,
    ) -> List[Dict[str, Any]]:
        """Generate food & dining recommendations using AI with user preferences."""
        
        pref_context = self._build_preference_context(user_preferences)
        
        diet_requirements = ""
        if user_preferences.get('diet_preference'):
            diet_pref = user_preferences['diet_preference']
            if diet_pref.lower() in ['vegetarian', 'vegan', 'halal', 'kosher']:
                diet_requirements = f"\n⚠️ CRITICAL: User is {diet_pref}. ONLY recommend restaurants with {diet_pref} options!"
            elif diet_pref.lower() != 'no restrictions':
                diet_requirements = f"\n⚠️ IMPORTANT: User has dietary preference: {diet_pref}. Consider this in recommendations."
        
        budget_guidance = ""
        if user_preferences.get('budget_level'):
            if user_preferences['budget_level'].lower() in ['budget', 'low']:
                budget_guidance = "\n💰 Focus on affordable local eateries and street food"
            elif user_preferences['budget_level'].lower() in ['luxury', 'high']:
                budget_guidance = "\n💎 Include fine dining and premium restaurants"
        
        prompt = f"""You are a local food expert in {destination}. Suggest 3-4 must-try food experiences specifically in {destination}.

{pref_context}
{diet_requirements}
{budget_guidance}

IMPORTANT: ALL suggestions MUST be:
- Actually located IN {destination} (not other cities)
- Real, existing restaurants or food areas in {destination}
- Popular with both locals and tourists in {destination}
- MATCH user's dietary preferences

Context: {trip_context}

Include:
- Local specialties unique to {destination}
- Authentic restaurants or food streets IN {destination}
- Unique dining experiences available IN {destination}

Format as JSON array:
[
  {{
    "name": "Restaurant/Food name (must be in {destination})",
    "description": "What makes it special + why it matches user preferences (max 100 chars)",
    "category": "food",
    "duration": "1-2 hours",
    "cost": "$20-40",
    "best_time": "Lunch",
    "highlight": false,
    "matched_preferences": ["Interest: food", "Diet: vegetarian"]
  }}
]

IMPORTANT: The "matched_preferences" field should list which user preferences this recommendation matches.
Examples:
- If vegetarian restaurant: ["Vegetarian-friendly"]
- If budget option: ["Budget-friendly"]
- If matches food interest: ["Interest: food"]
- If local specialty: ["Local cuisine"]

CRITICAL: Verify each suggestion:
1. Is actually in {destination} (not another city)
2. Matches user's dietary preference{' (' + user_preferences.get('diet_preference') + ')' if user_preferences.get('diet_preference') else ''}
3. Fits user's budget level{' (' + user_preferences.get('budget_level') + ')' if user_preferences.get('budget_level') else ''}

Mark the BEST recommendation (that best matches ALL preferences) with "highlight": true.
Keep descriptions under 100 characters.
Use realistic price ranges for {destination}.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} personalized food recommendations for {destination}")
            return filtered
        except Exception as e:
            logger.warning(f"AI food recommendations failed: {e}")
            return self._fallback_food(destination)
    
    def _generate_culture_recommendations(
        self, 
        destination: str, 
        trip_context: str,
        user_preferences: Dict[str, Any],
        trip_country: str,
    ) -> List[Dict[str, Any]]:
        """Generate cultural attraction recommendations using AI with user preferences."""
        
        pref_context = self._build_preference_context(user_preferences)
        
        interest_guidance = ""
        if user_preferences.get('interests'):
            interests = user_preferences['interests']
            if 'culture' in interests or 'history' in interests:
                interest_guidance += "\n- User loves culture/history - emphasize historical significance"
            if 'art' in interests or 'photography' in interests:
                interest_guidance += "\n- User interested in art/photography - suggest visually stunning sites"
            if 'nature' in interests:
                interest_guidance += "\n- User loves nature - include cultural sites with gardens/natural elements"
        
        accessibility_note = ""
        if user_preferences.get('mobility_needs') and user_preferences['mobility_needs'].lower() != 'none':
            accessibility_note = f"\n♿ IMPORTANT: Ensure recommendations are accessible for: {user_preferences['mobility_needs']}"
        
        prompt = f"""You are a cultural guide for {destination}. Suggest 3-4 cultural attractions specifically in {destination}.

{pref_context}
{interest_guidance}
{accessibility_note}

IMPORTANT: ALL suggestions MUST be:
- Actually located IN {destination} (not other cities)
- Real, existing cultural sites in {destination}
- Famous landmarks or attractions IN {destination}
- MATCH user's interests and accessibility needs

Context: {trip_context}

Include:
- Museums located IN {destination}
- Temples/shrines/churches IN {destination}
- Historical sites IN {destination}
- Cultural experiences available IN {destination}

Format as JSON array:
[
  {{
    "name": "Attraction name (must be in {destination})",
    "description": "Why visit + how it matches user interests (max 100 chars)",
    "category": "culture",
    "duration": "2-3 hours",
    "cost": "$10-20",
    "best_time": "Morning",
    "highlight": false,
    "matched_preferences": ["Interest: culture", "Interest: history"]
  }}
]

IMPORTANT: The "matched_preferences" field should list which user preferences this recommendation matches.
Examples:
- If historical site and user likes history: ["Interest: history"]
- If art museum and user likes art: ["Interest: art"]
- If accessible: ["Wheelchair accessible"]
- If photogenic and user likes photography: ["Interest: photography"]
- If includes nature: ["Interest: nature"]

CRITICAL: Verify each suggestion:
1. Is actually in {destination} (not another city)
2. Matches user's interests{' (' + ', '.join(user_preferences.get('interests', [])) + ')' if user_preferences.get('interests') else ''}
3. Is accessible if needed{' (' + user_preferences.get('mobility_needs') + ')' if user_preferences.get('mobility_needs') and user_preferences['mobility_needs'] != 'none' else ''}

Mark the BEST recommendation (that best matches user's profile) with "highlight": true.
Keep descriptions under 100 characters.
Use realistic entry fees and durations.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} personalized culture recommendations for {destination}")
            return filtered
        except Exception as e:
            logger.warning(f"AI culture recommendations failed: {e}")
            return self._fallback_culture(destination)
    
    def _clean_json(self, content: str) -> str:
        """Remove markdown fences."""
        content = content.strip()
        
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        
        if content.endswith("```"):
            content = content[:-3]
        
        return content.strip()
    
    def _validate_recommendations(self, recs: List[Dict]) -> List[Dict[str, Any]]:
        """Validate recommendation structure."""
        validated = []
        
        for rec in recs:
            if isinstance(rec, dict) and "name" in rec:
                description = rec.get("description", "")
                if len(description) > 150:
                    description = description[:147] + "..."
                
                matched_prefs = rec.get("matched_preferences", [])
                if not isinstance(matched_prefs, list):
                    matched_prefs = []
                
                validated.append({
                    "name": rec.get("name", "Unknown"),
                    "description": description,
                    "category": rec.get("category", "nearby"),
                    "duration": rec.get("duration", "2 hours"),
                    "cost": rec.get("cost", "$20-50"),
                    "best_time": rec.get("best_time", "Anytime"),
                    "highlight": rec.get("highlight", False),
                    "nearby_to": rec.get("nearby_to"),
                    "action": rec.get("action"),
                    "matched_preferences": matched_prefs,  # NEW: Include matched preferences
                })
        
        return validated
    
    def _filter_wrong_location(self, recommendations: List[Dict], expected_location: str) -> List[Dict]:
        """
        FIXED: Filter out recommendations that mention wrong cities.
        Now properly handles city hierarchies (e.g., Sapporo is in Hokkaido but they're different)
        """
        if not expected_location:
            return recommendations
        
        # City database - FIXED: Handle Hokkaido/Sapporo relationship properly
        city_groups = {
            # Japan - Major Cities
            "tokyo": ["tokyo", "shibuya", "shinjuku", "harajuku", "asakusa", "ginza", "roppongi", "akihabara"],
            "osaka": ["osaka", "dotonbori", "namba", "umeda", "shinsekai"],
            "kyoto": ["kyoto", "gion", "arashiyama", "fushimi"],
            
            # Hokkaido Region - Special handling
            "sapporo": ["sapporo", "susukino", "hokkaido"],  # Include hokkaido for Sapporo
            "otaru": ["otaru"],
            "hakodate": ["hakodate"],
            "niseko": ["niseko"],
            
            "fukuoka": ["fukuoka", "hakata"],
            "hiroshima": ["hiroshima", "miyajima"],
            "yokohama": ["yokohama"],
            "nagoya": ["nagoya"],
            "nara": ["nara"],
            "kobe": ["kobe"],
            
            # Other Asia
            "singapore": ["singapore"],
            "kuala lumpur": ["kuala lumpur"],
            "bangkok": ["bangkok", "sukhumvit"],
            "seoul": ["seoul", "gangnam", "hongdae"],
            "busan": ["busan"],
            "beijing": ["beijing", "peking"],
            "shanghai": ["shanghai", "pudong"],
            "hong kong": ["hong kong", "kowloon"],
        }
        
        expected_lower = expected_location.lower().strip()
        
        logger.info(f"🔍 Filtering recommendations for: {expected_location}")
        
        # Find which city group the expected location belongs to
        expected_group = None
        expected_city_key = None
        
        for city_key, aliases in city_groups.items():
            if any(alias in expected_lower for alias in aliases):
                expected_group = aliases
                expected_city_key = city_key
                logger.info(f"✅ Matched to city group: {city_key} (aliases: {aliases})")
                break
        
        if not expected_group:
            logger.info(f"⚠️ Location '{expected_location}' not in filter database, skipping strict filter")
            return recommendations
        
        # Get all other cities' aliases (cities to filter out)
        wrong_cities = []
        for city_key, aliases in city_groups.items():
            if city_key != expected_city_key:
                wrong_cities.extend([a for a in aliases if len(a) >= 4])
        
        logger.info(f"🚫 Will filter out mentions of: {wrong_cities[:10]}... (showing first 10)")
        logger.info(f"✅ Will KEEP mentions of: {expected_group}")
        
        # Filter recommendations
        filtered = []
        
        for rec in recommendations:
            name_lower = rec.get("name", "").lower()
            desc_lower = rec.get("description", "").lower()
            
            # Check if recommendation mentions a WRONG city
            contains_wrong_city = False
            detected_wrong = None
            
            for wrong_city in wrong_cities:
                pattern = r'\b' + re.escape(wrong_city) + r'\b'
                if re.search(pattern, name_lower) or re.search(pattern, desc_lower):
                    contains_wrong_city = True
                    detected_wrong = wrong_city
                    break
            
            if not contains_wrong:
                filtered.append(rec)
                logger.info(f"  ✅ KEPT: {rec.get('name')}")
            else:
                logger.warning(
                    f"  ❌ FILTERED: '{rec.get('name')}' - mentions '{detected_wrong}' "
                    f"(wrong for {expected_location})"
                )
        
        logger.info(f"📊 Filter result: {len(filtered)}/{len(recommendations)} recommendations passed")
        
        return filtered
    
    def _fallback_categories(self) -> Dict[str, List[Dict[str, Any]]]:
        return {"nearby": [], "food": [], "culture": []}
    
    def _fallback_nearby(self, destination: str) -> List[Dict[str, Any]]:
        return [{
            "name": f"Explore {destination}",
            "description": "Discover nearby attractions",
            "category": "nearby",
            "duration": "2 hours",
            "cost": "Free-$20",
            "best_time": "Anytime",
            "highlight": True,
            "matched_preferences": [],
            "lat": None,
            "lon": None,
            "address": None,
        }]
    
    def _fallback_food(self, destination: str) -> List[Dict[str, Any]]:
        return [{
            "name": f"Local Cuisine Tour",
            "description": f"Try authentic {destination} food",
            "category": "food",
            "duration": "1-2 hours",
            "cost": "$20-40",
            "best_time": "Lunch or Dinner",
            "highlight": True,
            "matched_preferences": [],
            "lat": None,
            "lon": None,
            "address": None,
        }]
    
    def _fallback_culture(self, destination: str) -> List[Dict[str, Any]]:
        return [{
            "name": f"Cultural Heritage Sites",
            "description": f"Visit {destination}'s landmarks",
            "category": "culture",
            "duration": "Half day",
            "cost": "$10-30",
            "best_time": "Morning",
            "highlight": True,
            "matched_preferences": [],
            "lat": None,
            "lon": None,
            "address": None,
        }]


# ============================================================================
# Quick Add Recommendation (WITH USER ACCESS CHECK)
# ============================================================================

class QuickAddRecommendationView(APIView):
    """
    POST /f1/recommendations/quick-add/
    
    Quickly add an AI-generated recommendation to trip itinerary.
    ✅ Allows both owners AND collaborators
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        trip_id = request.data.get('trip_id')
        day_index = request.data.get('day_index', 0)  # 0-indexed
        recommendation = request.data.get('recommendation', {})
        
        if not trip_id or not recommendation or not recommendation.get('name'):
            return Response(
                {"success": False, "error": "Missing required fields"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        try:
            if hasattr(user, 'email'):
                app_user = AppUser.objects.get(email=user.email)
            else:
                app_user = user
        except AppUser.DoesNotExist:
            return Response(
                {"success": False, "error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Allow both owner AND collaborators to add recommendations
        trip = Trip.objects.filter(
            Q(id=trip_id) & (Q(owner=app_user) | Q(collaborators__user=app_user))
        ).distinct().first()
        
        if not trip:
            return Response(
                {"success": False, "error": "Trip not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get or create the day (day_index is 0-indexed, but day_index in DB is 1-indexed)
        actual_day_index = day_index + 1
        trip_day, created = TripDay.objects.get_or_create(
            trip=trip,
            day_index=actual_day_index,
            defaults={'note': f'Day {actual_day_index}'}
        )
        
        # Get next sort order
        max_sort = ItineraryItem.objects.filter(
            trip=trip, 
            day=trip_day
        ).aggregate(Max('sort_order'))['sort_order__max'] or 0
        
        # Create itinerary item
        item = ItineraryItem.objects.create(
            trip=trip,
            day=trip_day,
            title=name,
            item_type=recommendation.get('category', 'activity'),
            notes_summary=recommendation.get('description', ''),
            sort_order=max_sort + 1,
            is_all_day=False,
        )
        
        logger.info(f"✅ Added '{name}' to trip {trip_id}, day {actual_day_index} with coords ({lat}, {lon})")
        
        return Response({
            "success": True,
            "message": f"Added '{item.title}' to Day {actual_day_index}",
            "item": {
                "id": item.id,
                "title": item.title,
                "day_index": actual_day_index,
                "category": item.item_type,
                "sort_order": item.sort_order,
                "lat": item.lat,
                "lon": item.lon,
                "address": item.address,
            }
        }, status=status.HTTP_201_CREATED)