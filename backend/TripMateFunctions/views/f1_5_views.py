# backend/TripMateFunctions/views/f1_5_views.py
"""
F1.5 - AI-Powered Recommendations (Real-time AI, No Database)

FIXED: Better day-specific location detection and city filtering
FIXED: Allow both trip owners AND collaborators to access recommendations
- Analyzes addresses more accurately
- Filters out wrong cities comprehensively
- Day-aware recommendations
- Collaborator access enabled
"""

import os
import json
import logging
import requests
from typing import List, Dict, Any
from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.db.models import Q

from ..models import Trip, TripDay, ItineraryItem

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
# F1.5 - AI Recommendations View (FIXED - Collaborator Access)
# ============================================================================

class AIRecommendationsView(APIView):
    """
    GET /f1/recommendations/ai/?trip_id=367&day_index=1&location=Sapporo
    
    FIXED VERSION:
    - Better location detection from addresses
    - More comprehensive city filtering
    - Day-specific recommendations
    - ✅ NOW ALLOWS BOTH OWNERS AND COLLABORATORS
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        trip_id = request.query_params.get('trip_id')
        day_index_param = request.query_params.get('day_index')
        location_override = request.query_params.get('location')
        
        if not trip_id:
            return Response(
                {"success": False, "error": "trip_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # FIXED: Allow both owner AND collaborators to access
            trip = Trip.objects.filter(
                Q(id=trip_id) & (Q(owner=request.user) | Q(collaborators__user=request.user))
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
                        
                        # IMPROVED: Try to detect location from day's items
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
            
            # Generate itinerary hash
            itinerary_hash = self._compute_itinerary_hash(day_items)
            
            # Generate categorized recommendations for this specific day/location
            categories = self._generate_categorized_recommendations(
                destination=destination,
                trip=trip,
                items=day_items,
                day_index=target_day_index
            )
            
            return Response({
                "success": True,
                "destination": destination,
                "day_index": target_day_index,
                "itinerary_hash": itinerary_hash,
                "categories": categories
            })
            
        except Exception as e:
            logger.error(f"AI recommendations failed: {e}", exc_info=True)
            
            # Return fallback with empty categories
            return Response({
                "success": True,
                "destination": "Unknown",
                "day_index": target_day_index if 'target_day_index' in locals() else None,
                "itinerary_hash": "",
                "categories": self._fallback_categories()
            })
    
    def _detect_location_from_items(self, items: List[ItineraryItem]) -> str:
        """
        IMPROVED: Detect the primary location from a list of itinerary items.
        Extracts city names more accurately from addresses.
        """
        if not items:
            logger.warning("No items provided for location detection")
            return ""
        
        cities = []
        
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
        """Generate a hash of the current itinerary for change detection."""
        import hashlib
        
        # Create string from item IDs and sort orders
        items_str = ",".join([f"{item.id}:{item.sort_order}" for item in items])
        return hashlib.md5(items_str.encode()).hexdigest()[:8]
    
    def _generate_categorized_recommendations(
        self, 
        destination: str, 
        trip: Trip,
        items: List[ItineraryItem],
        day_index: int = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Generate recommendations in 3 categories for specific day/location."""
        
        # Get existing places for context
        existing_places = [item.title for item in items if item.title]
        existing_places_str = ", ".join(existing_places[:8]) if existing_places else "none yet"
        
        # Build trip context
        if day_index is not None:
            trip_context = f"Day {day_index + 1} of trip in {destination}"
        else:
            trip_duration = len(set(item.day_id for item in items if item.day_id)) or 1
            trip_context = f"{trip_duration}-day trip to {destination}"
        
        categories = {}
        
        # 1. NEARBY: Places near current itinerary (day-specific)
        categories["nearby"] = self._generate_nearby_recommendations(
            destination, existing_places_str, trip_context
        )
        
        # 2. FOOD: Dining experiences (location-specific)
        categories["food"] = self._generate_food_recommendations(
            destination, trip_context
        )
        
        # 3. CULTURE: Cultural attractions (location-specific)
        categories["culture"] = self._generate_culture_recommendations(
            destination, trip_context
        )
        
        return categories
    
    def _generate_nearby_recommendations(
        self, destination: str, existing_places: str, trip_context: str
    ) -> List[Dict[str, Any]]:
        """Generate nearby place recommendations using AI."""
        
        prompt = f"""You are a local travel expert in {destination}. The user is planning a {trip_context}.

Current itinerary includes: {existing_places}

Suggest 3-4 nearby places they should add, ALL located in {destination}.

CRITICAL REQUIREMENTS:
- ALL suggestions MUST be in {destination} (not other cities!)
- Must be within walking distance or short travel from their existing stops
- Must complement what they already have
- Must be diverse (different types of attractions)
- Must be real, well-known places in {destination}

Format as JSON array:
[
  {{
    "name": "Place name (must be in {destination})",
    "description": "Why visit (1 sentence, max 100 chars)",
    "category": "nearby",
    "duration": "30 min",
    "cost": "Free",
    "best_time": "Morning",
    "highlight": false,
    "nearby_to": "Name of existing stop it's near"
  }}
]

Example for Sapporo (if existing places include "Sapporo TV Tower"):
- ✅ "Odori Park" - nearby to Sapporo TV Tower, in Sapporo
- ✅ "Susukino District" - nearby to Sapporo TV Tower, in Sapporo
- ❌ "Shibuya Crossing" - in Tokyo, NOT in Sapporo!

VERIFY: Each suggestion is actually located in {destination}!

Mark the BEST recommendation with "highlight": true.
Keep descriptions under 100 characters.
Use realistic costs and durations.
Respond ONLY with valid JSON array, no markdown."""

        try:
            content = call_sealion_ai(prompt, temperature=0.7, max_tokens=1200)
            content = self._clean_json(content)
            recs = json.loads(content)
            validated = self._validate_recommendations(recs)
            # IMPROVED: Better filtering
            filtered = self._filter_wrong_location(validated, destination)
            logger.info(f"✅ Generated {len(filtered)} nearby recommendations for {destination}")
            return filtered
        except Exception as e:
            logger.warning(f"AI nearby recommendations failed: {e}")
            return self._fallback_nearby(destination)
    
    def _generate_food_recommendations(
        self, destination: str, trip_context: str
    ) -> List[Dict[str, Any]]:
        """Generate food & dining recommendations using AI."""
        
        prompt = f"""You are a local food expert in {destination}. Suggest 3-4 must-try food experiences specifically in {destination}.

IMPORTANT: ALL suggestions MUST be:
- Actually located IN {destination} (not other cities)
- Real, existing restaurants or food areas in {destination}
- Popular with both locals and tourists in {destination}

Context: {trip_context}

Include:
- Local specialties unique to {destination}
- Authentic restaurants or food streets IN {destination}
- Unique dining experiences available IN {destination}

Format as JSON array:
[
  {{
    "name": "Restaurant/Food name (must be in {destination})",
    "description": "What makes it special (1 sentence, max 100 chars)",
    "category": "food",
    "duration": "1-2 hours",
    "cost": "$20-40",
    "best_time": "Lunch",
    "highlight": false
  }}
]

Example for Sapporo:
- ✅ "Sapporo Ramen Yokocho" (in Sapporo)
- ✅ "Nijo Market" (in Sapporo)
- ❌ "Tsukiji Market" (in Tokyo, not Sapporo)

CRITICAL: Verify each suggestion is actually in {destination}, not another city!

Mark the BEST recommendation with "highlight": true.
Keep descriptions under 100 characters.
Use realistic price ranges for {destination}.
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
        self, destination: str, trip_context: str
    ) -> List[Dict[str, Any]]:
        """Generate cultural attraction recommendations using AI."""
        
        prompt = f"""You are a cultural guide for {destination}. Suggest 3-4 cultural attractions specifically in {destination}.

IMPORTANT: ALL suggestions MUST be:
- Actually located IN {destination} (not other cities)
- Real, existing cultural sites in {destination}
- Famous landmarks or attractions IN {destination}

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
    "description": "Why visit (1 sentence, max 100 chars)",
    "category": "culture",
    "duration": "2-3 hours",
    "cost": "$10-20",
    "best_time": "Morning",
    "highlight": false
  }}
]

Example for Sapporo:
- ✅ "Hokkaido Shrine" (in Sapporo)
- ✅ "Sapporo Clock Tower" (in Sapporo)
- ❌ "Senso-ji Temple" (in Tokyo, not Sapporo)

Example for Kyoto:
- ✅ "Fushimi Inari Shrine" (in Kyoto)
- ✅ "Kinkaku-ji Temple" (in Kyoto)
- ❌ "Tokyo National Museum" (in Tokyo, not Kyoto)

CRITICAL: Verify each suggestion is actually in {destination}, not another city!

Mark the BEST recommendation with "highlight": true.
Keep descriptions under 100 characters.
Use realistic entry fees and durations.
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
        """Remove markdown code fences from JSON."""
        content = content.strip()
        
        # Remove markdown code fences
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
                # Truncate long descriptions
                description = rec.get("description", "")
                if len(description) > 150:
                    description = description[:147] + "..."
                
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
                })
        
        return validated
    
    def _filter_wrong_location(self, recommendations: List[Dict], expected_location: str) -> List[Dict]:
        """
        FIXED: Filter out recommendations that mention wrong cities.
        Now properly handles city hierarchies (e.g., Sapporo is in Hokkaido but they're different)
        """
        if not expected_location:
            logger.info("No expected location provided, skipping filter")
            return recommendations
        
        # City database - FIXED: Handle Hokkaido/Sapporo relationship properly
        # Note: Sapporo is IN Hokkaido, so Hokkaido landmarks in Sapporo are valid
        city_groups = {
            # Japan - Major Cities
            "tokyo": ["tokyo", "shibuya", "shinjuku", "harajuku", "asakusa", "ginza", "roppongi", "akihabara"],
            "osaka": ["osaka", "dotonbori", "namba", "umeda", "shinsekai"],
            "kyoto": ["kyoto", "gion", "arashiyama", "fushimi"],
            
            # Hokkaido Region - Special handling
            # Sapporo is the capital city of Hokkaido prefecture
            # When user is in Sapporo, allow both "sapporo" AND "hokkaido" mentions
            # since many Sapporo attractions are named "Hokkaido X"
            "sapporo": ["sapporo", "susukino", "hokkaido"],  # Include hokkaido for Sapporo
            "otaru": ["otaru"],  # Other Hokkaido cities filter separately
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
        
        # Normalize expected location
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
        
        # FIXED: Get all other cities' aliases (cities to filter out)
        # Only add cities from OTHER groups (not the expected city's group)
        wrong_cities = []
        for city_key, aliases in city_groups.items():
            if city_key != expected_city_key:  # Only add OTHER city groups
                safe_aliases = [a for a in aliases if len(a) >= 4]  # Avoid short aliases
                wrong_cities.extend(safe_aliases)
        
        logger.info(f"🚫 Will filter out mentions of: {wrong_cities[:10]}... (showing first 10)")
        logger.info(f"✅ Will KEEP mentions of: {expected_group}")
        
        # Filter recommendations
        filtered = []
        import re
        
        for rec in recommendations:
            name_lower = rec.get("name", "").lower()
            desc_lower = rec.get("description", "").lower()
            
            # Check if recommendation mentions a WRONG city
            contains_wrong_city = False
            detected_wrong = None
            
            for wrong_city in wrong_cities:
                # Use word boundary regex for accuracy
                pattern = r'\b' + re.escape(wrong_city) + r'\b'
                
                if re.search(pattern, name_lower) or re.search(pattern, desc_lower):
                    contains_wrong_city = True
                    detected_wrong = wrong_city
                    break
            
            # KEEP if it doesn't mention wrong cities
            # (It's OK if it mentions the correct city - that's expected!)
            if not contains_wrong_city:
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
            "description": "Discover nearby attractions and hidden gems",
            "category": "nearby",
            "duration": "2 hours",
            "cost": "Free-$20",
            "best_time": "Anytime",
            "highlight": True
        }]
    
    def _fallback_food(self, destination: str) -> List[Dict[str, Any]]:
        """Fallback food recommendations."""
        return [{
            "name": f"Local Cuisine Tour",
            "description": f"Try authentic {destination} food and local specialties",
            "category": "food",
            "duration": "1-2 hours",
            "cost": "$20-40",
            "best_time": "Lunch or Dinner",
            "highlight": True
        }]
    
    def _fallback_culture(self, destination: str) -> List[Dict[str, Any]]:
        """Fallback culture recommendations."""
        return [{
            "name": f"Cultural Heritage Sites",
            "description": f"Visit {destination}'s most iconic historical and cultural landmarks",
            "category": "culture",
            "duration": "Half day",
            "cost": "$10-30",
            "best_time": "Morning",
            "highlight": True
        }]


# ============================================================================
# Quick Add Recommendation (FIXED - Collaborator Access)
# ============================================================================

class QuickAddRecommendationView(APIView):
    """
    POST /f1/recommendations/quick-add/
    
    Quickly add an AI-generated recommendation to trip itinerary.
    ✅ NOW ALLOWS BOTH OWNERS AND COLLABORATORS
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        trip_id = request.data.get('trip_id')
        day_index = request.data.get('day_index', 0)
        recommendation = request.data.get('recommendation', {})
        
        if not trip_id or not recommendation or not recommendation.get('name'):
            return Response(
                {"success": False, "error": "trip_id and recommendation with name are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # FIXED: Allow both owner AND collaborators to add recommendations
        trip = Trip.objects.filter(
            Q(id=trip_id) & (Q(owner=request.user) | Q(collaborators__user=request.user))
        ).distinct().first()
        
        if not trip:
            return Response(
                {"success": False, "error": "Trip not found or you don't have permission"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get or create the day (day_index is 0-indexed, but day_index in DB is 1-indexed)
        actual_day_index = day_index + 1
        trip_day, created = TripDay.objects.get_or_create(
            trip=trip,
            day_index=actual_day_index,
            defaults={'note': f'Day {actual_day_index}'}
        )
        
        # Get the next sort order for this day
        existing_items = ItineraryItem.objects.filter(trip=trip, day=trip_day)
        next_sort_order = existing_items.count() + 1
        
        # Create itinerary item
        item = ItineraryItem.objects.create(
            trip=trip,
            day=trip_day,
            title=recommendation.get('name', 'New Activity'),
            item_type=recommendation.get('category', 'activity'),
            notes_summary=recommendation.get('description', ''),
            sort_order=next_sort_order,
            is_all_day=False,
        )
        
        logger.info(f"Added recommendation '{item.title}' to trip {trip_id}, day {actual_day_index}")
        
        return Response({
            "success": True,
            "message": f"Added '{item.title}' to Day {actual_day_index}",
            "item": {
                "id": item.id,
                "title": item.title,
                "day_index": actual_day_index,
                "category": item.item_type,
                "sort_order": item.sort_order
            }
        }, status=status.HTTP_201_CREATED)