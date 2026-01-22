# TripMateFunctions/views/f5_2_views.py
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from .base_views import BaseViewSet
from ..models import TripMediaHighlight, TripHistoryEntry, AppUser
from ..serializers.f5_2_serializers import (
    F52TripMediaHighlightSerializer,
    F52TripHistoryEntrySerializer,
)


class F52TripMediaHighlightViewSet(BaseViewSet):
    queryset = TripMediaHighlight.objects.all()
    serializer_class = F52TripMediaHighlightSerializer
    
    def get_queryset(self):
        """
        Override to show only the current user's own highlights
        (Unlike photos which are shared across all collaborators)
        """
        user = getattr(self.request, "user", None)
        if not user:
            return TripMediaHighlight.objects.none()
        
        # Try to get AppUser from request.user
        try:
            if hasattr(user, 'email'):
                app_user = AppUser.objects.get(email=user.email)
            else:
                app_user = user
        except AppUser.DoesNotExist:
            return TripMediaHighlight.objects.none()
        
        # ✅ Only return highlights created by THIS user
        # (not shared with collaborators)
        return TripMediaHighlight.objects.filter(user=app_user)
    
    def perform_create(self, serializer):
        """
        Verify user has access to trip before creating highlight
        Get AppUser from request.user (Supabase user)
        """
        user = self.request.user
        trip = serializer.validated_data.get('trip')
        
        # Get or create AppUser
        try:
            if hasattr(user, 'email'):
                app_user = AppUser.objects.get(email=user.email)
            else:
                app_user = user
        except AppUser.DoesNotExist:
            app_user = AppUser.objects.create(
                email=user.email,
                full_name=getattr(user, 'full_name', ''),
            )
        
        # Check if user has access to trip (same as F51)
        if trip:
            has_access = trip.owner == app_user or trip.collaborators.filter(user=app_user).exists()
            
            if not has_access:
                raise PermissionDenied(f"You don't have access to trip {trip.id}")
        
        serializer.save(user=app_user)


class F52TripHistoryEntryViewSet(BaseViewSet):
    queryset = TripHistoryEntry.objects.all()
    serializer_class = F52TripHistoryEntrySerializer
    
    def get_queryset(self):
        """
        Filter history entries by trip access
        """
        user = getattr(self.request, "user", None)
        if not user:
            return TripHistoryEntry.objects.none()
        
        # Try to get AppUser from request.user
        try:
            if hasattr(user, 'email'):
                app_user = AppUser.objects.get(email=user.email)
            else:
                app_user = user
        except AppUser.DoesNotExist:
            return TripHistoryEntry.objects.none()
        
        # Filter by trips where user is owner OR collaborator
        return TripHistoryEntry.objects.filter(
            Q(trip__owner=app_user) |
            Q(trip__collaborators__user=app_user)
        ).distinct()
    
    def perform_create(self, serializer):
        """
        Get AppUser and verify trip access before creating history entry
        """
        user = self.request.user
        trip = serializer.validated_data.get('trip')
        
        # Get or create AppUser
        try:
            if hasattr(user, 'email'):
                app_user = AppUser.objects.get(email=user.email)
            else:
                app_user = user
        except AppUser.DoesNotExist:
            app_user = AppUser.objects.create(
                email=user.email,
                full_name=getattr(user, 'full_name', ''),
            )
        
        # Check if user has access to trip
        if trip:
            has_access = trip.owner == app_user or trip.collaborators.filter(user=app_user).exists()
            
            if not has_access:
                raise PermissionDenied(f"You don't have access to trip {trip.id}")
        
        serializer.save(user=app_user)