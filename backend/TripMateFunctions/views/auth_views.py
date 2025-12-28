# TripMateFunctions/views/auth_views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class WhoAmIView(APIView):
    """
    GET /api/auth/whoami/
    Returns the Django user linked to the Supabase JWT token.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = getattr(request, "app_user", None) or request.user

        return Response({
            "id": str(getattr(user, "id", "")),
            "email": getattr(user, "email", ""),
            "full_name": getattr(user, "full_name", ""),
            "is_staff": getattr(user, "is_staff", False),
            "is_superuser": getattr(user, "is_superuser", False),
            }
        )