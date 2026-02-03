# backend/TripMateFunctions/views/f1_5_views.py
"""
F1.5 - AI-Powered Recommendations (Real-time AI, No Database)

UPDATED: Now includes user profile preferences for personalized recommendations
AND geographic coordinates (lat/lon/address) for each recommendation

CRITICAL FIX: Added geocoding to ensure every recommendation has coordinates
so that place-details endpoint works properly when items are added to itinerary.
"""

import os
import json
import logging
import requests
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

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
# Helper: Geocoding (Get coordinates for place names)
# ============================================================================

def geocode_place(place_name: str, city: str) -> Optional[Tuple[float, float, str]]:
    """
    Geocode a place name to get coordinates.
    Returns (lat, lon, formatted_address) or None if failed.
    
    Uses Mapbox Geocoding API (you already have MAPBOX_ACCESS_TOKEN).
    """
    mapbox_token = os.environ.get("MAPBOX_ACCESS_TOKEN")
    if not mapbox_token:
        logger.warning("MAPBOX_ACCESS_TOKEN not set, geocoding disabled")
        return None
    
    try:
        # Combine place name with city for better accuracy
        query = f"{place_name}, {city}"
        
        url = "https://api.mapbox.com/geocoding/v5/mapbox.places/{}.json".format(
            requests.utils.quote(query)
        )
        
        params = {
            "access_token": mapbox_token,
            "limit": 1,
            "types": "poi,address,place",  # POI for landmarks, address for specific places
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            logger.warning(f"Geocoding failed for '{query}': status {response.status_code}")
            return None
        
        data = response.json()
        features = data.get("features", [])
        
        if not features:
            logger.warning(f"No geocoding results for '{query}'")
            return None
        
        feature = features[0]
        coordinates = feature.get("geometry", {}).get("coordinates", [])
        place_name_full = feature.get("place_name", "")
        
        if len(coordinates) >= 2:
            lon, lat = coordinates[0], coordinates[1]
            logger.info(f"✅ Geocoded '{place_name}' in {city}: ({lat}, {lon})")
            return (lat, lon, place_name_full)
        
        return None
        
    except Exception as e:
        logger.error(f"Geocoding error for '{place_name}' in {city}: {e}")
        return None


# ============================================================================
# F1.5 - AI Recommendations View (WITH COORDINATES)
# ============================================================================

class AIRecommendationsView(APIView):
    """
    GET/POST /f1/recommendations/ai/?trip_id=367&day_index=1&location=Sapporo
    
    UPDATED VERSION:
    - ✅ Uses current user's profile preferences
    - ✅ Includes geographic coordinates (lat/lon/address) for each recommendation
    - ✅ Geocodes AI-generated place names automatically
    - ✅ Allows both owners AND collaborators
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        """Handle GET requests (backward compatibility)"""
        return self._handle_request(request)
    
    def post(self, request, *args, **kwargs):
        """Handle POST requests with user preferences in body"""
        return self._handle_request(request)
    
    def _handle_request(self, request):
        """Main request handler for both GET and POST"""
        
        # Get parameters from either GET or POST
        trip_id = request.query_params.get('trip_id') or request.data.get('trip_id')
        day_index_param = request.query_params.get('day_index') or request.data.get('day_index')
        location_override = request.query_params.get('location') or request.data.get('location')
        
        if not trip_id:
            return Response(
                {"success": False, "error": "trip_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ====================================================================
        # GET CURRENT USER AND THEIR PROFILE PREFERENCES
        # ====================================================================
        user = request.user
        
        # Get AppUser
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
        
        # Fetch CURRENT USER'S profile preferences
        user_preferences = self._get_user_preferences(app_user)
        logger.info(f"✅ Loaded preferences for {app_user.email}: {user_preferences}")
        
        # ====================================================================
        # VERIFY TRIP ACCESS
        # ====================================================================
        try:
            # Allow both owner AND collaborators to access
            trip = Trip.objects.filter(
                Q(id=trip_id) & (Q(owner=app_user) | Q(collaborators__user=app_user))
            ).distinct().first()
            
            if not trip:
                return Response(
                    {"success": False, "error": "Trip not found or you don't have permission"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            all_items = ItineraryItem.objects.filter(trip=trip).order_by('day__day_index', 'sort_order')
            
            # Determine target day and items
            target_day_index = None
            day_items = list(all_items)  # Default: all items
            destination = location_override or trip.main_city or trip.main_country or "Unknown"
            
            if day_index_param is not None:
                try:
                    # Convert 0-indexed to 1-indexed for database lookup
                    day_index_query = int(day_index_param) + 1
                    target_day_index = int(day_index_param)
                    
                    logger.info(f"🔍 Looking for day_index={day_index_query} (0-indexed input: {day_index_param})")
                    
                    # Get the specific day
                    target_day = TripDay.objects.filter(
                        trip=trip, 
                        day_index=day_index_query
                    ).first()
                    
                    if target_day:
                        logger.info(f"✅ Found day: {target_day.id}, day_index={target_day.day_index}")
                        
                        # Get items only for this day
                        day_items = list(ItineraryItem.objects.filter(
                            trip=trip, 
                            day=target_day
                        ).order_by('sort_order'))
                        
                        logger.info(f"📍 Day {day_index_query} has {len(day_items)} items:")
                        for item in day_items:
                            logger.info(f"  - {item.title}: {item.address}")
                        
                        # Try to detect location from day's items
                        if not location_override and day_items:
                            detected_location = self._detect_location_from_items(day_items)
                            if detected_location:
                                destination = detected_location
                                logger.info(f"✅ Detected location for Day {day_index_query}: {destination}")
                            else:
                                logger.warning(f"⚠️ Could not detect location from items, using trip default: {destination}")
                    else:
                        logger.warning(f"⚠️ Day with day_index={day_index_query} not found")
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid day_index parameter: {day_index_param}, error: {e}")
            
            logger.info(f"🎯 Final destination for recommendations: {destination}")
            logger.info(f"🎯 Using {len(day_items)} items for recommendations")
            logger.info(f"👤 Generating personalized recommendations for: {app_user.email}")
            
            # Generate itinerary hash
            itinerary_hash = self._compute_itinerary_hash(day_items)
            
            # ====================================================================
            # GENERATE PERSONALIZED RECOMMENDATIONS WITH COORDINATES
            # ====================================================================
            categories = self._generate_categorized_recommendations(
                destination=destination,
                trip=trip,
                items=day_items,
                day_index=target_day_index,
                user_preferences=user_preferences
            )
            
            # ✅ CRITICAL: Geocode all recommendations to add coordinates
            for category_name, recommendations in categories.items():
                for rec in recommendations:
                    if not rec.get('lat') or not rec.get('lon'):
                        # Try to geocode this recommendation
                        coords = geocode_place(rec['name'], destination)
                        if coords:
                            rec['lat'], rec['lon'], rec['address'] = coords
                        else:
                            logger.warning(f"⚠️ Could not geocode: {rec['name']} in {destination}")
                            # Keep recommendation but mark it as missing coordinates
                            rec['lat'] = None
                            rec['lon'] = None
                            rec['address'] = None
            
            # Log coordinate statistics
            total_recs = sum(len(recs) for recs in categories.values())
            with_coords = sum(
                1 for recs in categories.values() 
                for rec in recs 
                if rec.get('lat') and rec.get('lon')
            )
            logger.info(f"📍 Geocoding result: {with_coords}/{total_recs} recommendations have coordinates")
            
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
            
            # Return fallback with empty categories
            return Response({
                "success": True,
                "destination": "Unknown",
                "day_index": target_day_index if 'target_day_index' in locals() else None,
                "itinerary_hash": "",
                "categories": self._fallback_categories(),
                "personalized": False,
            })
    
    def _get_user_preferences(self, app_user: AppUser) -> Dict[str, Any]:
        """Fetch the current user's profile preferences."""
        try:
            profile = Profile.objects.get(id=app_user.id)
            
            preferences = {
                'interests': profile.interests or [],
                'travel_pace': profile.travel_pace,
                'budget_level': profile.budget_level,
                'diet_preference': profile.diet_preference,
                'mobility_needs': profile.mobility_needs,
                'name': profile.name or app_user.full_name or 'Traveler',
            }
            
            return preferences
            
        except Profile.DoesNotExist:
            logger.warning(f"No profile found for user {app_user.email}, using defaults")
            return {
                'interests': [],
                'travel_pace': None,
                'budget_level': None,
                'diet_preference': None,
                'mobility_needs': None,
                'name': app_user.full_name or 'Traveler',
            }
    
    def _detect_location_from_items(self, items: List[ItineraryItem]) -> str:
        """Detect the primary location from a list of itinerary items."""
        if not items:
            logger.warning("No items provided for location detection")
            return ""
        
        cities = []
        
        logger.info("🔍 Starting location detection from addresses...")
        
        for item in items:
            if not item.address:
                logger.info(f"  ❌ {item.title}: No address")
                continue
                
            parts = [p.strip() for p in item.address.split(',')]
            logger.info(f"  📍 {item.title}: {item.address}")
            
            detected_city = None
            
            # Strategy 1: Third from end (Japan addresses)
            if len(parts) >= 3:
                potential_city = parts[-3].strip()
                if potential_city.lower() not in ['japan', 'prefecture']:
                    for suffix in [' City', ' Prefecture', ' Ward', ' District']:
                        if potential_city.endswith(suffix):
                            potential_city = potential_city[:-len(suffix)].strip()
                    
                    detected_city = potential_city
                    logger.info(f"     ✅ Strategy 1: Detected '{detected_city}'")
            
            # Strategy 2: Second from end
            if not detected_city and len(parts) >= 2:
                potential_city = parts[-2].strip()
                if potential_city.lower() != 'japan':
                    for suffix in [' City', ' Prefecture']:
                        if potential_city.endswith(suffix):
                            potential_city = potential_city[:-len(suffix)].strip()
                    
                    detected_city = potential_city
                    logger.info(f"     ✅ Strategy 2: Detected '{detected_city}'")
            
            # Strategy 3: Check for major cities
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
                            logger.info(f"     ✅ Strategy 3: Detected '{detected_city}'")
                            break
                    if detected_city:
                        break
            
            if detected_city:
                cities.append(detected_city)
        
        if cities:
            from collections import Counter
            city_counts = Counter(cities)
            detected_city = city_counts.most_common(1)[0][0]
            logger.info(f"✅ FINAL DETECTED LOCATION: {detected_city}")
            return detected_city
        
        logger.warning("❌ Could not detect any location from items")
        return ""
    
    def _compute_itinerary_hash(self, items) -> str:
        """Generate a hash of the current itinerary for change detection."""
        import hashlib
        items_str = ",".join([f"{item.id}:{item.sort_order}" for item in items])
        return hashlib.md5(items_str.encode()).hexdigest()[:8]
    
    def _generate_categorized_recommendations(
        self, 
        destination: str, 
        trip: Trip,
        items: List[ItineraryItem],
        day_index: int = None,
        user_preferences: Dict[str, Any] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Generate recommendations in 3 categories with user preferences."""
        
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
        
        categories["nearby"] = self._generate_nearby_recommendations(
            destination, existing_places_str, trip_context, user_preferences
        )
        
        categories["food"] = self._generate_food_recommendations(
            destination, trip_context, user_preferences
        )
        
        categories["culture"] = self._generate_culture_recommendations(
            destination, trip_context, user_preferences
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
        user_preferences: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate nearby place recommendations using AI with user preferences."""
        
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
                personalization += f"\n- Suggest leisurely activities"
            elif user_preferences['travel_pace'].lower() in ['fast', 'packed']:
                personalization += f"\n- Include efficient activities"
        
        prompt = f"""You are a local travel expert in {destination}. The user is planning a {trip_context}.

{pref_context}

Current itinerary includes: {existing_places}

Suggest 3-4 nearby places they should add, ALL located in {destination}.

PERSONALIZATION REQUIREMENTS:{personalization}

CRITICAL REQUIREMENTS:
- ALL suggestions MUST be in {destination} (not other cities!)
- Must be within walking distance or short travel from their existing stops
- Must complement what they already have
- Must match user's interests and preferences
- Must be real, well-known places in {destination}

Format as JSON array:
[
  {{
    "name": "Place name (must be in {destination})",
    "description": "Why visit (max 100 chars)",
    "category": "nearby",
    "duration": "30 min",
    "cost": "Free",
    "best_time": "Morning",
    "highlight": false,
    "nearby_to": "Existing stop name",
    "matched_preferences": ["Interest: culture", "Budget: free"]
  }}
]

Mark the BEST recommendation with "highlight": true.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} nearby recommendations")
            return filtered
        except Exception as e:
            logger.warning(f"AI nearby recommendations failed: {e}")
            return self._fallback_nearby(destination)
    
    def _generate_food_recommendations(
        self, 
        destination: str, 
        trip_context: str,
        user_preferences: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate food recommendations using AI with user preferences."""
        
        pref_context = self._build_preference_context(user_preferences)
        
        diet_requirements = ""
        if user_preferences.get('diet_preference'):
            diet_pref = user_preferences['diet_preference']
            if diet_pref.lower() in ['vegetarian', 'vegan', 'halal', 'kosher']:
                diet_requirements = f"\n⚠️ CRITICAL: User is {diet_pref}. ONLY recommend restaurants with {diet_pref} options!"
            elif diet_pref.lower() != 'no restrictions':
                diet_requirements = f"\n⚠️ User has dietary preference: {diet_pref}"
        
        budget_guidance = ""
        if user_preferences.get('budget_level'):
            if user_preferences['budget_level'].lower() in ['budget', 'low']:
                budget_guidance = "\n💰 Focus on affordable eateries"
            elif user_preferences['budget_level'].lower() in ['luxury', 'high']:
                budget_guidance = "\n💎 Include fine dining"
        
        prompt = f"""You are a local food expert in {destination}. Suggest 3-4 must-try food experiences in {destination}.

{pref_context}
{diet_requirements}
{budget_guidance}

ALL suggestions MUST be:
- Located IN {destination}
- Real, existing restaurants
- Match user's dietary preferences

Format as JSON array:
[
  {{
    "name": "Restaurant name (in {destination})",
    "description": "What makes it special (max 100 chars)",
    "category": "food",
    "duration": "1-2 hours",
    "cost": "$20-40",
    "best_time": "Lunch",
    "highlight": false,
    "matched_preferences": ["Diet: vegetarian", "Budget-friendly"]
  }}
]

Mark the BEST recommendation with "highlight": true.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} food recommendations")
            return filtered
        except Exception as e:
            logger.warning(f"AI food recommendations failed: {e}")
            return self._fallback_food(destination)
    
    def _generate_culture_recommendations(
        self, 
        destination: str, 
        trip_context: str,
        user_preferences: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate cultural attraction recommendations using AI."""
        
        pref_context = self._build_preference_context(user_preferences)
        
        interest_guidance = ""
        if user_preferences.get('interests'):
            interests = user_preferences['interests']
            if 'culture' in interests or 'history' in interests:
                interest_guidance += "\n- Emphasize historical significance"
            if 'art' in interests:
                interest_guidance += "\n- Suggest art museums and galleries"
            if 'nature' in interests:
                interest_guidance += "\n- Include sites with gardens/nature"
        
        accessibility_note = ""
        if user_preferences.get('mobility_needs') and user_preferences['mobility_needs'].lower() != 'none':
            accessibility_note = f"\n♿ Ensure accessibility for: {user_preferences['mobility_needs']}"
        
        prompt = f"""You are a cultural guide for {destination}. Suggest 3-4 cultural attractions in {destination}.

{pref_context}
{interest_guidance}
{accessibility_note}

ALL suggestions MUST be:
- Located IN {destination}
- Real cultural sites
- Match user interests

Format as JSON array:
[
  {{
    "name": "Attraction name (in {destination})",
    "description": "Why visit (max 100 chars)",
    "category": "culture",
    "duration": "2-3 hours",
    "cost": "$10-20",
    "best_time": "Morning",
    "highlight": false,
    "matched_preferences": ["Interest: culture", "Interest: history"]
  }}
]

Mark the BEST recommendation with "highlight": true.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} culture recommendations")
            return filtered
        except Exception as e:
            logger.warning(f"AI culture recommendations failed: {e}")
            return self._fallback_culture(destination)
    
    def _clean_json(self, content: str) -> str:
        """Remove markdown code fences from JSON."""
        content = content.strip()
        
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        
        if content.endswith("```"):
            content = content[:-3]
        
        return content.strip()
    
    def _validate_recommendations(self, recs: List[Dict]) -> List[Dict[str, Any]]:
        """Validate and normalize recommendation structure."""
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
                    "matched_preferences": matched_prefs,
                    # ✅ Initialize coordinate fields (will be filled by geocoding)
                    "lat": rec.get("lat"),
                    "lon": rec.get("lon"),
                    "address": rec.get("address"),
                    "xid": rec.get("xid"),
                })
        
        return validated
    
    def _filter_wrong_location(self, recommendations: List[Dict], expected_location: str) -> List[Dict]:
        """Filter out recommendations that mention wrong cities."""
        if not expected_location:
            return recommendations
        
        city_groups = {
            "tokyo": ["tokyo", "shibuya", "shinjuku", "harajuku", "asakusa", "ginza"],
            "osaka": ["osaka", "dotonbori", "namba", "umeda"],
            "kyoto": ["kyoto", "gion", "arashiyama", "fushimi"],
            "sapporo": ["sapporo", "susukino", "hokkaido"],
            "singapore": ["singapore"],
            "bangkok": ["bangkok"],
            "seoul": ["seoul"],
        }
        
        expected_lower = expected_location.lower().strip()
        expected_group = None
        expected_city_key = None
        
        for city_key, aliases in city_groups.items():
            if any(alias in expected_lower for alias in aliases):
                expected_group = aliases
                expected_city_key = city_key
                break
        
        if not expected_group:
            return recommendations
        
        wrong_cities = []
        for city_key, aliases in city_groups.items():
            if city_key != expected_city_key:
                wrong_cities.extend([a for a in aliases if len(a) >= 4])
        
        filtered = []
        import re
        
        for rec in recommendations:
            name_lower = rec.get("name", "").lower()
            desc_lower = rec.get("description", "").lower()
            
            contains_wrong_city = False
            
            for wrong_city in wrong_cities:
                pattern = r'\b' + re.escape(wrong_city) + r'\b'
                
                if re.search(pattern, name_lower) or re.search(pattern, desc_lower):
                    contains_wrong_city = True
                    break
            
            if not contains_wrong_city:
                filtered.append(rec)
        
        return filtered
    
    def _fallback_categories(self) -> Dict[str, List[Dict[str, Any]]]:
        """Fallback categories if AI fails."""
        return {
            "nearby": [],
            "food": [],
            "culture": []
        }
    
    def _fallback_nearby(self, destination: str) -> List[Dict[str, Any]]:
        """Fallback nearby recommendations."""
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
        """Fallback food recommendations."""
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
        """Fallback culture recommendations."""
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
# Quick Add Recommendation (WITH COORDINATES)
# ============================================================================

class QuickAddRecommendationView(APIView):
    """
    POST /f1/recommendations/quick-add/
    
    Quickly add an AI-generated recommendation to trip itinerary.
    ✅ Validates coordinates before adding
    ✅ Allows both owners AND collaborators
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        trip_id = request.data.get('trip_id')
        day_index = request.data.get('day_index', 0)  # 0-indexed
        recommendation = request.data.get('recommendation', {})
        
        if not trip_id or not recommendation or not recommendation.get('name'):
            return Response(
                {"success": False, "error": "trip_id and recommendation with name are required"},
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
        
        # Allow both owner AND collaborators
        trip = Trip.objects.filter(
            Q(id=trip_id) & (Q(owner=app_user) | Q(collaborators__user=app_user))
        ).distinct().first()
        
        if not trip:
            return Response(
                {"success": False, "error": "Trip not found or you don't have permission"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # ✅ Extract coordinates from recommendation
        name = recommendation.get('name', 'New Place')
        lat = recommendation.get('lat')
        lon = recommendation.get('lon')
        address = recommendation.get('address')
        xid = recommendation.get('xid')
        
        # ✅ CRITICAL: Validate coordinates exist
        if lat is None or lon is None:
            logger.error(f"❌ Recommendation missing coordinates: {name}")
            return Response({
                'success': False,
                'error': f'Cannot add "{name}" - missing location data. Please refresh recommendations and try again.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Convert to float
        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid coordinate format'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create the day (0-indexed to 1-indexed)
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
        
        # ✅ Create itinerary item WITH coordinates
        item = ItineraryItem.objects.create(
            trip=trip,
            day=trip_day,
            title=name,
            item_type=recommendation.get('category', 'activity'),
            notes_summary=recommendation.get('description', ''),
            sort_order=max_sort + 1,
            is_all_day=False,
            # ✅ CRITICAL: Store coordinates
            lat=lat,
            lon=lon,
            address=address,
            # xid=xid,  # Uncomment if your model has xid field
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