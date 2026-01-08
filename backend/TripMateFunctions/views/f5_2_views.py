from .base_views import BaseViewSet
from ..models import TripMediaHighlight, TripHistoryEntry, AppUser
from ..serializers.f5_2_serializers import (
    F52TripMediaHighlightSerializer,
    F52TripHistoryEntrySerializer,
)


class F52TripMediaHighlightViewSet(BaseViewSet):
    queryset = TripMediaHighlight.objects.all()
    serializer_class = F52TripMediaHighlightSerializer
    
    def perform_create(self, serializer):
        # Get AppUser from request.user (Supabase user)
        # Assuming request.user is already an AppUser instance from auth middleware
        
        # If request.user is Supabase user, map to AppUser by email
        try:
            if hasattr(self.request.user, 'email'):
                app_user = AppUser.objects.get(email=self.request.user.email)
            else:
                app_user = self.request.user
                
            serializer.save(user=app_user)
        except AppUser.DoesNotExist:
            # Create AppUser if doesn't exist
            app_user = AppUser.objects.create(
                email=self.request.user.email,
                full_name=getattr(self.request.user, 'full_name', ''),
            )
            serializer.save(user=app_user)


class F52TripHistoryEntryViewSet(BaseViewSet):
    queryset = TripHistoryEntry.objects.all()
    serializer_class = F52TripHistoryEntrySerializer
    
    def perform_create(self, serializer):
        # Same logic as above
        try:
            if hasattr(self.request.user, 'email'):
                app_user = AppUser.objects.get(email=self.request.user.email)
            else:
                app_user = self.request.user
                
            serializer.save(user=app_user)
        except AppUser.DoesNotExist:
            app_user = AppUser.objects.create(
                email=self.request.user.email,
                full_name=getattr(self.request.user, 'full_name', ''),
            )
            serializer.save(user=app_user)