from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from .base_views import BaseViewSet
from ..models import TripPhoto
from ..serializers.f5_1_serializers import F51TripPhotoSerializer


class F51TripPhotoViewSet(BaseViewSet):
    queryset = TripPhoto.objects.all()
    serializer_class = F51TripPhotoSerializer
    
    def get_queryset(self):
        """
        Override to check trip collaborators
        Returns photos from trips the user owns OR collaborates on
        """
        user = getattr(self.request, "user", None)
        if not user:
            return TripPhoto.objects.none()
        
        # Filter by trips where user is owner OR collaborator
        return TripPhoto.objects.filter(
            Q(trip__owner=user) |  # Trip owner
            Q(trip__collaborators__user=user)  # Trip collaborator
        ).distinct()
    
    def perform_create(self, serializer):
        """
        Verify user has access to trip before creating photo
        """
        user = self.request.user
        trip = serializer.validated_data.get('trip')
        
        if trip:
            # Check if user has access
            has_access = trip.owner == user or trip.collaborators.filter(user=user).exists()
            
            if not has_access:
                raise PermissionDenied(f"You don't have access to trip {trip.id}")
        
        serializer.save(user=user)