# backend/TripMateFunctions/views/recommendations_views.py
"""
Recommendations Page Backend - Class-Based Views
Serves featured guides, popular destinations, and destination info
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Q, Count
from django.core.cache import cache

from ..models import (
    Trip,
    Guide,
    Destination,
    SavedGuide,
    SavedDestination,
)


class DestinationInfoView(APIView):
    """
    GET /f1/recommendations/destination-info/?destination=Japan
    
    Returns destination information including description, best time to visit, etc.
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        destination_name = request.GET.get('destination', '')
        
        if not destination_name:
            return Response(
                {"error": "destination parameter required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check cache first
        cache_key = f"dest_info_{destination_name.lower()}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        
        try:
            # Try to get from database
            destination = Destination.objects.filter(
                Q(name__iexact=destination_name) | 
                Q(country__iexact=destination_name)
            ).first()
            
            if destination:
                data = {
                    "destination": destination.name,
                    "description": destination.description,
                    "best_time": destination.best_time_to_visit,
                    "avg_budget": destination.average_budget,
                    "popular_activities": destination.popular_activities or [],
                    "fun_facts": destination.fun_facts or [],
                    "lat": float(destination.lat) if destination.lat else None,
                    "lon": float(destination.lon) if destination.lon else None,
                }
            else:
                # Fallback to default descriptions
                data = self._get_default_destination_info(destination_name)
            
            # Cache for 1 hour
            cache.set(cache_key, data, timeout=3600)
            
            return Response(data)
            
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _get_default_destination_info(self, destination_name):
        """Fallback destination info when not in database"""
        defaults = {
            "Japan": {
                "destination": "Japan",
                "description": "Japan is an island country in East Asia. Located in the Pacific Ocean off the northeast coast of the Asian mainland, it is bordered to the west by the Sea of Japan and extends from the Sea of Okhotsk in the north to the East China Sea in the south.",
                "best_time": "March-May (Spring), September-November (Fall)",
                "avg_budget": "$100-150 per day",
                "popular_activities": ["Visit temples", "Try local cuisine", "Cherry blossom viewing", "Hot springs"],
                "fun_facts": [
                    "Japan has over 6,800 islands",
                    "The country has the world's oldest company (founded in 578 AD)",
                    "Japan is home to more than 75,000 centenarians"
                ],
                "lat": 36.2048,
                "lon": 138.2529
            },
            "Singapore": {
                "destination": "Singapore",
                "description": "Singapore is a sunny, tropical island in Southeast Asia, off the southern tip of the Malay Peninsula.",
                "best_time": "February-April",
                "avg_budget": "$80-120 per day",
                "popular_activities": ["Gardens by the Bay", "Hawker centers", "Marina Bay", "Sentosa Island"],
                "fun_facts": [
                    "Singapore is the world's only island city-state",
                    "It has the world's first night zoo",
                    "Chewing gum is banned"
                ],
                "lat": 1.3521,
                "lon": 103.8198
            }
        }
        
        return defaults.get(destination_name, {
            "destination": destination_name,
            "description": f"Explore the wonderful sights and experiences in {destination_name}.",
            "best_time": "Year-round",
            "avg_budget": "$100 per day",
            "popular_activities": [],
            "fun_facts": [],
            "lat": None,
            "lon": None
        })


class FeaturedGuidesView(APIView):
    """
    GET /f1/recommendations/featured-guides/?destination=Japan&limit=6
    
    Returns user-created guides for the destination
    Sorted by: verified > views > saves > recent
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        destination_name = request.GET.get('destination', '')
        limit = int(request.GET.get('limit', 6))
        
        try:
            # Query guides from database
            guides_query = Guide.objects.filter(
                is_public=True,
                status='published'
            )
            
            # Filter by destination if specified
            if destination_name:
                guides_query = guides_query.filter(
                    Q(main_destination__icontains=destination_name) |
                    Q(countries__icontains=destination_name)
                )
            
            # Sort: verified first, then by popularity
            guides_query = guides_query.annotate(
                total_saves=Count('savedguide')
            ).order_by(
                '-verified',
                '-views',
                '-total_saves',
                '-created_at'
            )[:limit]
            
            # Format response
            guides_data = []
            for guide in guides_query:
                guides_data.append(self._format_guide(guide))
            
            return Response({"guides": guides_data})
            
        except Exception as e:
            # Fallback to mock data if database error
            return Response({
                "guides": self._get_fallback_guides(destination_name, limit)
            })
    
    def _format_guide(self, guide):
        """Format guide object for response"""
        return {
            "id": str(guide.id),
            "title": guide.title,
            "author": guide.author.username if guide.author else "Anonymous",
            "author_avatar": guide.author.profile_picture if hasattr(guide.author, 'profile_picture') else None,
            "thumbnail": guide.cover_image or self._get_default_guide_thumbnail(guide.main_destination),
            "destination": guide.main_destination,
            "days": guide.duration_days,
            "views": guide.views,
            "saves": guide.savedguide_set.count(),
            "verified": guide.verified,
            "year": str(guide.created_at.year) if guide.created_at else None,
        }
    
    def _get_default_guide_thumbnail(self, destination):
        """Get default thumbnail for guide based on destination"""
        return f"https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=240&fit=crop&q=80"
    
    def _get_fallback_guides(self, destination, limit=6):
        """Fallback mock guides when database unavailable"""
        guides = [
            {
                "id": "1",
                "title": f"Tuyết's {destination}: Video Game Guide",
                "author": "Tuyết",
                "author_avatar": None,
                "thumbnail": "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400&h=240&fit=crop",
                "destination": destination,
                "days": 10,
                "views": 1234,
                "saves": 56,
                "verified": True,
                "year": "2025"
            },
            {
                "id": "2",
                "title": f"Julia Jabłońska's {destination} Guide in ca&PL",
                "author": "Julia Jabłońska",
                "author_avatar": None,
                "thumbnail": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=240&fit=crop",
                "destination": destination,
                "days": 14,
                "views": 890,
                "saves": 34,
                "verified": False,
                "year": "2024"
            },
            {
                "id": "3",
                "title": f"Laura's A 10-Day {destination} Winter Itinerary",
                "author": "Laura Khairunnisa",
                "author_avatar": None,
                "thumbnail": "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&h=240&fit=crop",
                "destination": destination,
                "days": 10,
                "views": 2100,
                "saves": 78,
                "verified": False,
                "year": "2025"
            }
        ]
        return guides[:limit]


class PopularDestinationsView(APIView):
    """
    GET /f1/recommendations/popular-destinations/?destination=Japan&limit=6
    
    Returns popular destinations related to the current trip
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        destination_name = request.GET.get('destination', '')
        limit = int(request.GET.get('limit', 6))
        user = request.user
        
        try:
            # Query destinations from database
            destinations_query = Destination.objects.filter(
                is_active=True
            )
            
            # If destination specified, find related destinations
            if destination_name:
                base_dest = Destination.objects.filter(
                    Q(name__iexact=destination_name) |
                    Q(country__iexact=destination_name)
                ).first()
                
                if base_dest:
                    # Same country or nearby countries
                    destinations_query = destinations_query.filter(
                        Q(country=base_dest.country) |
                        Q(country__in=self._get_nearby_countries(base_dest.country))
                    ).exclude(id=base_dest.id)
            
            # Sort by popularity
            destinations_query = destinations_query.annotate(
                total_saves=Count('saveddestination')
            ).order_by('-total_saves', '-views')[:limit]
            
            # Check which ones user has saved
            saved_dest_ids = set()
            if user.is_authenticated:
                saved_dest_ids = set(
                    SavedDestination.objects.filter(
                        user=user
                    ).values_list('destination_id', flat=True)
                )
            
            # Format response
            destinations_data = []
            for dest in destinations_query:
                destinations_data.append(self._format_destination(dest, saved_dest_ids, destination_name))
            
            return Response({"destinations": destinations_data})
            
        except Exception as e:
            # Fallback to mock data if database error
            return Response({
                "destinations": self._get_fallback_destinations(destination_name, limit)
            })
    
    def _format_destination(self, dest, saved_dest_ids, current_destination):
        """Format destination object for response"""
        return {
            "id": str(dest.id),
            "title": dest.name,
            "description": dest.short_description or dest.description[:150],
            "thumbnail": dest.thumbnail_image or self._get_default_destination_thumbnail(dest.name),
            "saved": dest.id in saved_dest_ids,
            "category": self._categorize_destination(dest, current_destination),
            "country": dest.country,
        }
    
    def _get_default_destination_thumbnail(self, destination):
        """Get default thumbnail for destination"""
        return f"https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=240&fit=crop&q=80"
    
    def _get_nearby_countries(self, country):
        """Get nearby countries based on geography"""
        nearby_map = {
            "Japan": ["South Korea", "China", "Taiwan"],
            "Singapore": ["Malaysia", "Indonesia", "Thailand"],
            "Thailand": ["Singapore", "Malaysia", "Vietnam", "Cambodia"],
            "Italy": ["France", "Switzerland", "Austria", "Greece"],
            "France": ["Italy", "Spain", "Switzerland", "Belgium"],
        }
        return nearby_map.get(country, [])
    
    def _categorize_destination(self, destination, current_destination):
        """Categorize destination relative to current trip"""
        if not current_destination:
            return "Popular"
        
        # Same country = Nearby
        base_dest = Destination.objects.filter(
            Q(name__iexact=current_destination) |
            Q(country__iexact=current_destination)
        ).first()
        
        if base_dest and destination.country == base_dest.country:
            return "Nearby"
        
        # High saves/views = Popular
        if destination.saveddestination_set.count() > 100:
            return "Popular"
        
        return "Other"
    
    def _get_fallback_destinations(self, current_destination, limit=6):
        """Fallback mock destinations when database unavailable"""
        destinations = [
            {
                "id": "1",
                "title": "Rome in 2 days",
                "description": "I prioritize the places I visit based on their distance from where I am staying...",
                "thumbnail": "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=240&fit=crop",
                "saved": False,
                "category": "Popular",
                "country": "Italy"
            },
            {
                "id": "2",
                "title": "2 weeks Seoul Guide",
                "description": "A solo travelers' guide to 2 weeks in Seoul. I went in mid to late November...",
                "thumbnail": "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400&h=240&fit=crop",
                "saved": False,
                "category": "Popular",
                "country": "South Korea"
            },
            {
                "id": "3",
                "title": "Busan 4D3N Guide",
                "description": "Chill beach and nature vibes! Short getaway from Seoul!",
                "thumbnail": "https://images.unsplash.com/photo-1541698444083-023c97d3f4b6?w=400&h=240&fit=crop",
                "saved": True,
                "category": "Nearby",
                "country": "South Korea"
            }
        ]
        return destinations[:limit]


class SaveGuideView(APIView):
    """
    POST /f1/recommendations/save-guide/
    Body: {"guide_id": "123"}
    
    Saves a guide to user's collection
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        guide_id = request.data.get('guide_id')
        
        if not guide_id:
            return Response(
                {"error": "guide_id required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            guide = Guide.objects.get(id=guide_id)
            
            # Create or get saved guide
            saved, created = SavedGuide.objects.get_or_create(
                user=request.user,
                guide=guide
            )
            
            return Response({
                "success": True,
                "created": created,
                "guide_id": guide_id
            })
            
        except Guide.DoesNotExist:
            return Response(
                {"error": "Guide not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UnsaveGuideView(APIView):
    """
    POST /f1/recommendations/unsave-guide/
    Body: {"guide_id": "123"}
    
    Removes a guide from user's collection
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        guide_id = request.data.get('guide_id')
        
        if not guide_id:
            return Response(
                {"error": "guide_id required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            SavedGuide.objects.filter(
                user=request.user,
                guide_id=guide_id
            ).delete()
            
            return Response({
                "success": True,
                "guide_id": guide_id
            })
            
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SaveDestinationView(APIView):
    """
    POST /f1/recommendations/save-destination/
    Body: {"destination_id": "123"}
    
    Saves a destination to user's collection
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        destination_id = request.data.get('destination_id')
        
        if not destination_id:
            return Response(
                {"error": "destination_id required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            destination = Destination.objects.get(id=destination_id)
            
            # Create or get saved destination
            saved, created = SavedDestination.objects.get_or_create(
                user=request.user,
                destination=destination
            )
            
            return Response({
                "success": True,
                "created": created,
                "destination_id": destination_id
            })
            
        except Destination.DoesNotExist:
            return Response(
                {"error": "Destination not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UnsaveDestinationView(APIView):
    """
    POST /f1/recommendations/unsave-destination/
    Body: {"destination_id": "123"}
    
    Removes a destination from user's collection
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        destination_id = request.data.get('destination_id')
        
        if not destination_id:
            return Response(
                {"error": "destination_id required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            SavedDestination.objects.filter(
                user=request.user,
                destination_id=destination_id
            ).delete()
            
            return Response({
                "success": True,
                "destination_id": destination_id
            })
            
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )