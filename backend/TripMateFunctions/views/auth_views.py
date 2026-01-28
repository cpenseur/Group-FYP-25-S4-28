# TripMateFunctions/views/auth_views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from django.middleware.csrf import get_token


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfTokenView(APIView):
    """
    GET /api/f1/csrf/
    Returns CSRF token and sets the csrftoken cookie.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        csrf_token = get_token(request)
        return Response({'csrfToken': csrf_token})


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