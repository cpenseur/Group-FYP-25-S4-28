from rest_framework import viewsets
from rest_framework.permissions import AllowAny


class BaseViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # tighten later
