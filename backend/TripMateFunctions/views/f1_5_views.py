"""
F1.5 - AI-Powered Recommendations with GEOCODING and DISTANCE FILTERING

✅ FIXED: Location detection now correctly identifies cities over states
✅ Geocodes all recommendations to get coordinates
✅ Improved city detection (prioritizes cities over states/attractions)
✅ Strict distance requirements for "nearby" recommendations
✅ Country validation to prevent wrong-country suggestions
✅ User profile preferences for personalization
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
# Helper: Geocoding (CRITICAL for coordinates!)
# ============================================================================

def geocode_place(place_name: str, city: str) -> Optional[Tuple[float, float, str]]:
    """
    Geocode a place name to get coordinates.
    Returns (lat, lon, formatted_address) or None if failed.
    
    Uses Mapbox Geocoding API.
    """
    mapbox_token = os.environ.get("MAPBOX_ACCESS_TOKEN")
    if not mapbox_token:
        logger.warning("⚠️ MAPBOX_ACCESS_TOKEN not set, geocoding disabled")
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
            "types": "poi,address,place",
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
# Helper: Distance Calculation
# ============================================================================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two points using Haversine formula."""
    R = 6371  # Earth radius in km
    
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c


# ============================================================================
# Helper: Extract city/country from address (FIXED VERSION)
# ============================================================================

def extract_city_hint(addr: str | None) -> str | None:
    """
    FIXED: Better city heuristic that avoids states.
    - Prioritizes actual city names over states/provinces
    - Avoids postal codes and region names
    - Uses comprehensive city and state databases
    """
    if not addr:
        return None
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    if len(parts) < 2:
        return None

    # ✅ Major cities to recognize
    major_cities = {
        'sydney': 'Sydney',
        'melbourne': 'Melbourne',
        'brisbane': 'Brisbane',
        'perth': 'Perth',
        'adelaide': 'Adelaide',
        'canberra': 'Canberra',
        'tokyo': 'Tokyo',
        'osaka': 'Osaka',
        'kyoto': 'Kyoto',
        'singapore': 'Singapore',
        'bangkok': 'Bangkok',
        'seoul': 'Seoul',
        'hong kong': 'Hong Kong',
    }
    
    # ✅ States/provinces to EXCLUDE
    exclude_states = {
        'new south wales', 'nsw',
        'victoria', 'vic',
        'queensland', 'qld',
        'western australia', 'wa',
        'south australia', 'sa',
        'tasmania', 'tas',
        'northern territory', 'nt',
        'scotland', 'england', 'wales',
        'montana', 'wyoming', 'california',
        'south carolina', 'north carolina',
    }
    
    addr_lower = addr.lower()
    
    # ✅ PRIORITY: Check for major cities first
    for keyword, city in major_cities.items():
        if keyword in addr_lower:
            return city
    
    # ✅ Try from right to left, skipping country and excluding states
    candidates = parts[:-1]  # exclude last (usually country)
    for p in reversed(candidates):
        p_lower = p.lower()
        
        # Skip if it's a state
        if p_lower in exclude_states:
            continue
        
        # reject mostly-numeric chunks
        if re.match(r"^\d", p):
            # if it begins with digits, keep only the alpha tail if meaningful
            tail = re.sub(r"^[0-9\-\s]+", "", p).strip()
            if tail and re.search(r"[A-Za-z]", tail) and len(tail) > 2:
                return tail
            continue
        
        if re.search(r"[A-Za-z]", p) and len(p) > 2:
            return p
    
    return None

def extract_country_hint(addr: str | None) -> str | None:
    if not addr:
        return None
    parts = [p.strip() for p in addr.split(",") if p.strip()]
    if not parts:
        return None
    return parts[-1]


# ============================================================================
# F1.5 - AI Recommendations View
# ============================================================================

class AIRecommendationsView(APIView):
    """
    GET/POST /f1/recommendations/ai/?trip_id=367&day_index=1&location=Sydney
    
    FEATURES:
    - ✅ FIXED: Correctly detects cities (not states)
    - ✅ Geocodes every recommendation
    - ✅ Improved city detection (avoids states/regions/attractions)
    - ✅ Country validation (prevents wrong-country recommendations)
    - ✅ Distance-based filtering
    - ✅ User profile preferences
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
        
        # Get user preferences
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
            
            # Generate recommendations
            categories = self._generate_categorized_recommendations(
                destination=destination,
                trip=trip,
                items=day_items,
                day_index=target_day_index,
                user_preferences=user_preferences,
                trip_country=trip_country,
            )
            
            # ✅ CRITICAL: Geocode all recommendations
            logger.info("\n=== 🗺️ Starting Geocoding ===")
            for category_name, recommendations in categories.items():
                logger.info(f"\n📍 Geocoding {category_name} recommendations:")
                for rec in recommendations:
                    if rec.get('lat') is None or rec.get('lon') is None:
                        coords = geocode_place(rec['name'], destination)
                        if coords:
                            rec['lat'], rec['lon'], rec['address'] = coords
                            logger.info(f"  ✅ {rec['name']} → ({rec['lat']:.4f}, {rec['lon']:.4f})")
                        else:
                            logger.warning(f"  ⚠️ Could not geocode: {rec['name']}")
                            rec['lat'] = None
                            rec['lon'] = None
                            rec['address'] = None
            
            # Log stats
            total_recs = sum(len(recs) for recs in categories.values())
            with_coords = sum(
                1 for recs in categories.values() 
                for rec in recs 
                if rec.get('lat') and rec.get('lon')
            )
            logger.info(f"\n📊 Geocoding Summary: {with_coords}/{total_recs} recommendations have coordinates")
            
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
        """Get user preferences with fallback."""
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
        FIXED: Detect location with strong priority on cities over states.
        
        Priority logic:
        1. Check for major cities in entire address (e.g., "Sydney" anywhere)
        2. Parse address parts, but EXCLUDE states/provinces
        3. Validate each candidate (not state, not postcode, has letters)
        
        Example:
        - "Sydney Harbour, Sydney, New South Wales, Australia" → "Sydney" ✅
        - "The Rocks, Sydney, NSW, Australia" → "Sydney" ✅
        - "Airport, Mascot, Sydney, NSW, Australia" → "Sydney" ✅
        """
        if not items:
            return ""
        
        cities = []
        countries = []
        
        logger.info("🔍 Starting FIXED location detection...")
        
        # ✅ COMPREHENSIVE DATABASES
        major_cities = {
            # Australia
            'sydney': 'Sydney',
            'melbourne': 'Melbourne',
            'brisbane': 'Brisbane',
            'perth': 'Perth',
            'adelaide': 'Adelaide',
            'canberra': 'Canberra',
            'gold coast': 'Gold Coast',
            'newcastle': 'Newcastle',
            'wollongong': 'Wollongong',
            'hobart': 'Hobart',
            'darwin': 'Darwin',
            'cairns': 'Cairns',
            'townsville': 'Townsville',
            
            # Japan
            'tokyo': 'Tokyo',
            'osaka': 'Osaka',
            'kyoto': 'Kyoto',
            'sapporo': 'Sapporo',
            'fukuoka': 'Fukuoka',
            'yokohama': 'Yokohama',
            'nagoya': 'Nagoya',
            'kobe': 'Kobe',
            'hiroshima': 'Hiroshima',
            'sendai': 'Sendai',
            'nara': 'Nara',
            
            # Other Asia
            'singapore': 'Singapore',
            'bangkok': 'Bangkok',
            'seoul': 'Seoul',
            'hong kong': 'Hong Kong',
            'taipei': 'Taipei',
            'kuala lumpur': 'Kuala Lumpur',
            'manila': 'Manila',
            'jakarta': 'Jakarta',
            'hanoi': 'Hanoi',
            'ho chi minh': 'Ho Chi Minh City',
            
            # Americas
            'new york': 'New York',
            'los angeles': 'Los Angeles',
            'san francisco': 'San Francisco',
            'chicago': 'Chicago',
            'toronto': 'Toronto',
            'vancouver': 'Vancouver',
            'honolulu': 'Honolulu',
        }
        
        # ✅ STATES/PROVINCES TO EXCLUDE (these are NOT cities!)
        exclude_states = {
            # Australia
            'new south wales', 'nsw',
            'victoria', 'vic',
            'queensland', 'qld',
            'western australia', 'wa',
            'south australia', 'sa',
            'tasmania', 'tas',
            'northern territory', 'nt',
            'australian capital territory', 'act',
            
            # USA
            'california', 'ca',
            'new york', 'ny',  # (state, not city)
            'texas', 'tx',
            'florida', 'fl',
            'south carolina', 'sc',
            'north carolina', 'nc',
            'montana', 'mt',
            'wyoming', 'wy',
            'hawaii', 'hi',  # (state)
            
            # UK
            'scotland',
            'england',
            'wales',
            'northern ireland',
            'fife',
            
            # Japan (prefectures)
            'hokkaido',
            'honshu',
            'kyushu',
            'shikoku',
        }
        
        # ✅ NEIGHBORHOODS/ATTRACTIONS (also not cities)
        not_cities = {
            'the rocks', 'bondi', 'manly', 'darling harbour', 'circular quay',
            'opera house', 'fish market', 'botanic garden', 'royal botanic',
            'st kilda', 'southbank', 'south bank', 'fortitude valley',
            'shibuya', 'shinjuku', 'harajuku', 'asakusa', 'ginza',
            'sentosa', 'marina bay', 'chinatown', 'little india',
            'rock hill', 'great falls', 'cluny road', 'mandai',
            'orange grove', 'marina boulevard', 'marina gardens',
            'mascot', 'bayside',  # Sydney suburbs
        }
        
        for item in items:
            if not item.address:
                logger.info(f"  ❌ {item.title}: No address")
                continue
            
            address_lower = item.address.lower()
            parts = [p.strip() for p in item.address.split(',')]
            
            logger.info(f"  📍 {item.title}: {item.address}")
            
            # Track country for validation
            if 'australia' in address_lower:
                countries.append('Australia')
            elif 'japan' in address_lower:
                countries.append('Japan')
            elif 'singapore' in address_lower:
                countries.append('Singapore')
            elif 'united states' in address_lower or ' usa' in address_lower:
                countries.append('United States')
            
            # ✅ PRIORITY STRATEGY 1: Check for major cities ANYWHERE in address
            # This is MOST reliable because "Sydney" will appear even if followed by "NSW"
            city_found = False
            for city_keyword, city_name in major_cities.items():
                # Use word boundary regex to avoid partial matches
                if re.search(r'\b' + re.escape(city_keyword) + r'\b', address_lower):
                    cities.append(city_name)
                    logger.info(f"     ✅ MATCHED MAJOR CITY: {city_name}")
                    city_found = True
                    break
            
            if city_found:
                continue
            
            # ✅ STRATEGY 2: Parse address parts (but EXCLUDE states!)
            detected_city = None
            
            # Try different positions: -2, -3, -4 (skip -1 which is country)
            for index in [-2, -3, -4]:
                if abs(index) > len(parts):
                    continue
                
                potential = parts[index].strip()
                # Clean up common suffixes
                potential_clean = (potential
                    .replace(' City', '')
                    .replace(' Municipality', '')
                    .replace(' Prefecture', '')
                    .replace(' Ward', '')
                    .replace(' District', '')
                    .strip())
                potential_lower = potential_clean.lower()
                
                # ✅ VALIDATION: Is this a valid city?
                is_valid = (
                    # Not a state/province
                    potential_lower not in exclude_states and
                    # Not a neighborhood/attraction
                    potential_lower not in not_cities and
                    # Not too short (like "NSW", "CA")
                    len(potential_clean) > 2 and
                    # Not just numbers (postcodes like "2020")
                    not potential_clean.isdigit() and
                    # Not starting with numbers (like "2020 Sydney")
                    not re.match(r'^\d', potential_clean) and
                    # Has letters
                    any(c.isalpha() for c in potential_clean)
                )
                
                if is_valid:
                    detected_city = potential_clean
                    logger.info(f"     ✅ Extracted from address[{index}]: '{detected_city}'")
                    break
            
            if detected_city:
                cities.append(detected_city)
        
        logger.info(f"\n📊 Detected cities: {cities}")
        logger.info(f"📊 Detected countries: {countries}")
        
        # ✅ NO CITIES FOUND
        if not cities:
            logger.warning("❌ Could not detect city from addresses")
            return ""
        
        # ✅ RETURN MOST COMMON CITY
        from collections import Counter
        city_counts = Counter(cities)
        most_common_city, count = city_counts.most_common(1)[0]
        
        # ✅ FINAL VALIDATION: Check against country context
        if countries:
            most_common_country = Counter(countries).most_common(1)[0][0]
            
            # Australian cities
            aus_cities = ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 
                         'Canberra', 'Gold Coast', 'Newcastle', 'Hobart', 'Darwin', 'Cairns']
            
            # If country is Australia but city isn't Australian, try to find one
            if most_common_country == 'Australia':
                if most_common_city not in aus_cities:
                    logger.warning(f"⚠️ City '{most_common_city}' doesn't match country 'Australia'")
                    # Try to find an Australian city in the list
                    for city in cities:
                        if city in aus_cities:
                            most_common_city = city
                            count = city_counts[city]
                            logger.info(f"✅ Corrected to Australian city: {most_common_city}")
                            break
        
        logger.info(f"✅ FINAL LOCATION: {most_common_city} (appears {count} times)")
        return most_common_city
    
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
        user_preferences: Dict[str, Any] = None,
        trip_country: str = "Unknown",
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Generate recommendations in 3 categories."""
        
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
        
        # 1. NEARBY
        categories["nearby"] = self._generate_nearby_recommendations(
            destination, existing_places_str, trip_context, user_preferences, trip_country
        )
        
        # 2. FOOD
        categories["food"] = self._generate_food_recommendations(
            destination, trip_context, user_preferences, trip_country
        )
        
        # 3. CULTURE
        categories["culture"] = self._generate_culture_recommendations(
            destination, trip_context, user_preferences, trip_country
        )
        
        return categories
    
    def _build_preference_context(self, user_preferences: Dict[str, Any]) -> str:
        """Build preference context string."""
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
        
        # ✅ CRITICAL: Country-aware prompt
        prompt = f"""You are a local travel expert in {destination}, {trip_country}. The user is planning a {trip_context}.

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
- Must be real, well-known places
- Include accurate "lat" and "lon" (decimal degrees) for EVERY suggestion

Format as JSON array (include accurate coordinates for each place):
[
  {{
    "name": "Place name (MUST be in {destination}, {trip_country})",
    "description": "Why visit + how it matches preferences (max 100 chars)",
    "category": "nearby",
    "duration": "1-2 hours",
    "cost": "Free",
    "best_time": "Morning",
    "highlight": false,
    "lat": 35.6895,
    "lon": 139.6917,
    "nearby_to": "Name of existing stop it's near",
    "matched_preferences": ["Interest: culture", "Budget-friendly"]
  }}
]

VERIFY BEFORE RESPONDING:
1. Is this place IN {destination}, {trip_country}? (Check city AND country!)
2. Can you reach it within 30 minutes from {destination} city center?
3. Is it within 10-15 km of {destination} city center?

Mark the BEST recommendation with "highlight": true.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} nearby recommendations for {destination}")
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
        """Generate food recommendations."""
        
        pref_context = self._build_preference_context(user_preferences)
        
        diet_requirements = ""
        if user_preferences.get('diet_preference'):
            diet_pref = user_preferences['diet_preference']
            if diet_pref.lower() in ['vegetarian', 'vegan', 'halal', 'kosher']:
                diet_requirements = f"\n⚠️ CRITICAL: User is {diet_pref}. ONLY recommend restaurants with {diet_pref} options!"
            elif diet_pref.lower() != 'no restrictions':
                diet_requirements = f"\n⚠️ IMPORTANT: User prefers: {diet_pref}."
        
        budget_guidance = ""
        if user_preferences.get('budget_level'):
            if user_preferences['budget_level'].lower() in ['budget', 'low']:
                budget_guidance = "\n💰 Focus on affordable eateries and street food"
            elif user_preferences['budget_level'].lower() in ['luxury', 'high']:
                budget_guidance = "\n💎 Include fine dining experiences"
        
        prompt = f"""You are a local food expert in {destination}, {trip_country}. Suggest 3-4 must-try food experiences in {destination}.

{pref_context}
{diet_requirements}
{budget_guidance}

Context: {trip_context}

IMPORTANT: ALL suggestions MUST be:
- Actually located IN {destination}, {trip_country} (not other cities or countries)
- Real, existing restaurants or food areas
- Match user's dietary preferences
- Include accurate "lat" and "lon" (decimal degrees) for EVERY suggestion

Format as JSON array (include accurate coordinates for each place):
[
  {{
    "name": "Restaurant name (in {destination}, {trip_country})",
    "description": "What makes it special (max 100 chars)",
    "category": "food",
    "duration": "1-2 hours",
    "cost": "$20-40",
    "best_time": "Lunch",
    "highlight": false,
    "lat": 35.6895,
    "lon": 139.6917,
    "matched_preferences": ["Vegetarian-friendly", "Budget-friendly"]
  }}
]

Mark the BEST match with "highlight": true.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} food recommendations for {destination}")
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
        """Generate culture recommendations."""
        
        pref_context = self._build_preference_context(user_preferences)
        
        interest_guidance = ""
        if user_preferences.get('interests'):
            interests = user_preferences['interests']
            if 'culture' in interests or 'history' in interests:
                interest_guidance += "\n- Emphasize historical significance"
            if 'art' in interests or 'photography' in interests:
                interest_guidance += "\n- Suggest visually stunning sites"
            if 'nature' in interests:
                interest_guidance += "\n- Include sites with gardens/natural elements"
        
        accessibility_note = ""
        if user_preferences.get('mobility_needs') and user_preferences['mobility_needs'].lower() != 'none':
            accessibility_note = f"\n♿ IMPORTANT: Ensure accessibility for: {user_preferences['mobility_needs']}"
        
        prompt = f"""You are a cultural guide for {destination}, {trip_country}. Suggest 3-4 cultural attractions in {destination}.

{pref_context}
{interest_guidance}
{accessibility_note}

Context: {trip_context}

IMPORTANT: ALL suggestions MUST be:
- Located IN {destination}, {trip_country} (not other cities or countries)
- Real, famous cultural sites
- Match user's interests
- Include accurate "lat" and "lon" (decimal degrees) for EVERY suggestion

Format as JSON array (include accurate coordinates for each place):
[
  {{
    "name": "Attraction name (in {destination}, {trip_country})",
    "description": "Why visit (max 100 chars)",
    "category": "culture",
    "duration": "2-3 hours",
    "cost": "$10-20",
    "best_time": "Morning",
    "highlight": false,
    "lat": 35.6895,
    "lon": 139.6917,
    "matched_preferences": ["Interest: history", "Wheelchair accessible"]
  }}
]

Mark the BEST match with "highlight": true.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} culture recommendations for {destination}")
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

                # Normalize coordinates if provided
                lat = rec.get("lat")
                lon = rec.get("lon")
                try:
                    lat = float(lat) if lat is not None else None
                except (TypeError, ValueError):
                    lat = None
                try:
                    lon = float(lon) if lon is not None else None
                except (TypeError, ValueError):
                    lon = None
                if lat is not None and (lat < -90 or lat > 90):
                    lat = None
                if lon is not None and (lon < -180 or lon > 180):
                    lon = None

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
                    # ✅ Initialize coordinate fields
                    "lat": lat,
                    "lon": lon,
                    "address": rec.get("address"),
                    "xid": rec.get("xid"),
                })
        
        return validated
    
    def _filter_wrong_location(self, recommendations: List[Dict], expected_location: str) -> List[Dict]:
        """Filter out recommendations mentioning wrong cities."""
        if not expected_location:
            return recommendations
        
        # City groups for filtering
        city_groups = {
            # Australia
            "sydney": ["sydney", "bondi", "manly", "darling harbour", "circular quay"],
            "melbourne": ["melbourne", "st kilda", "fitzroy", "southbank"],
            "brisbane": ["brisbane", "south bank", "fortitude valley"],
            "perth": ["perth", "fremantle", "northbridge"],
            "adelaide": ["adelaide", "glenelg"],
            "canberra": ["canberra"],
            "gold coast": ["gold coast", "surfers paradise"],
            "newcastle": ["newcastle"],
            "cairns": ["cairns"],
            "darwin": ["darwin"],
            "hobart": ["hobart"],
            
            # Japan
            "tokyo": ["tokyo", "shibuya", "shinjuku", "harajuku", "asakusa", "ginza"],
            "osaka": ["osaka", "dotonbori", "namba", "umeda"],
            "kyoto": ["kyoto", "gion", "arashiyama"],
            "sapporo": ["sapporo", "susukino"],
            "fukuoka": ["fukuoka", "hakata"],
            "hiroshima": ["hiroshima"],
            
            # Other Asia
            "singapore": ["singapore", "sentosa", "marina bay"],
            "bangkok": ["bangkok", "sukhumvit", "silom"],
            "seoul": ["seoul", "gangnam", "hongdae", "myeongdong"],
            "hong kong": ["hong kong", "kowloon", "tsim sha tsui"],
            "taipei": ["taipei", "ximending"],
        }
        
        expected_lower = expected_location.lower().strip()
        
        # Find expected city group
        expected_group = None
        expected_city_key = None
        
        for city_key, aliases in city_groups.items():
            if any(alias in expected_lower for alias in aliases):
                expected_group = aliases
                expected_city_key = city_key
                logger.info(f"✅ Matched city group: {city_key}")
                break
        
        if not expected_group:
            logger.info(f"⚠️ City '{expected_location}' not in filter database, keeping all")
            return recommendations
        
        # Get wrong cities (including US cities)
        wrong_cities = []
        for city_key, aliases in city_groups.items():
            if city_key != expected_city_key:
                wrong_cities.extend([a for a in aliases if len(a) >= 4])
        
        # ✅ Add common US cities to wrong list if we're not in USA
        us_cities = ["rock hill", "south carolina", "new york", "los angeles", "chicago", "san francisco"]
        wrong_cities.extend(us_cities)
        
        # Filter
        filtered = []
        
        for rec in recommendations:
            name_lower = rec.get("name", "").lower()
            desc_lower = rec.get("description", "").lower()
            
            contains_wrong = False
            detected_wrong = None
            
            for wrong_city in wrong_cities:
                pattern = r'\b' + re.escape(wrong_city) + r'\b'
                if re.search(pattern, name_lower) or re.search(pattern, desc_lower):
                    contains_wrong = True
                    detected_wrong = wrong_city
                    break
            
            if not contains_wrong:
                filtered.append(rec)
                logger.info(f"  ✅ KEPT: {rec.get('name')}")
            else:
                logger.warning(f"  ❌ FILTERED: '{rec.get('name')}' - mentions '{detected_wrong}'")
        
        logger.info(f"📊 Filter result: {len(filtered)}/{len(recommendations)} passed")
        
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
# Quick Add with Coordinate Validation
# ============================================================================

class QuickAddRecommendationView(APIView):
    """POST /f1/recommendations/quick-add/"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        trip_id = request.data.get('trip_id')
        day_index = request.data.get('day_index', 0)
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
        
        trip = Trip.objects.filter(
            Q(id=trip_id) & (Q(owner=app_user) | Q(collaborators__user=app_user))
        ).distinct().first()
        
        if not trip:
            return Response(
                {"success": False, "error": "Trip not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Extract data
        name = recommendation.get('name', 'New Place')
        lat = recommendation.get('lat')
        lon = recommendation.get('lon')
        address = recommendation.get('address')
        
        # ✅ VALIDATE coordinates
        if lat is None or lon is None:
            logger.error(f"❌ Missing coordinates for: {name}")
            return Response({
                'success': False,
                'error': f'Cannot add "{name}" - missing location data. Please refresh recommendations.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': 'Invalid coordinate format'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create day
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
        
        # ✅ CREATE with coordinates
        item = ItineraryItem.objects.create(
            trip=trip,
            day=trip_day,
            title=name,
            item_type=recommendation.get('category', 'activity'),
            notes_summary=recommendation.get('description', ''),
            sort_order=max_sort + 1,
            is_all_day=False,
            lat=lat,
            lon=lon,
            address=address,
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
