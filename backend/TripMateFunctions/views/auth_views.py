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

    def get(self, request, *args, **kwargs):
        user = request.user  # comes from Supabase JWT auth

        return Response(
            {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "supabase_uid": getattr(user, "supabase_uid", None),
            }
        )
