# backend/TripMateFunctions/views/base_views.py
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import AllowAny
from ..authentication import SupabaseJWTAuthentication

class BaseViewSet(ModelViewSet):
    authentication_classes = [SupabaseJWTAuthentication]
    permission_classes = [AllowAny]
