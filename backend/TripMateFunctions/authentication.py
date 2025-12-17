import jwt
from django.conf import settings
from rest_framework import authentication, exceptions

from .models import AppUser  # IMPORTANT: use your AppUser, not Django auth.User


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """
    DRF authentication class that verifies Supabase access tokens.

    Expects header:
      Authorization: Bearer <supabase-access-token>
    """

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).decode("utf-8")

        if not auth_header:
            return None  # no auth header → unauthenticated

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise exceptions.AuthenticationFailed("Invalid Authorization header format")

        token = parts[1]

        if not getattr(settings, "SUPABASE_JWT_SECRET", ""):
            raise exceptions.AuthenticationFailed(
                "Supabase JWT secret not configured on backend."
            )

        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Token has expired")
        except jwt.InvalidTokenError:
            raise exceptions.AuthenticationFailed("Invalid token")

        email = payload.get("email")
        supabase_user_id = payload.get("sub")  # available if you want to log/debug

        # Your AppUser model has no field for `sub`, and `email` is the only unique key.
        if not email:
            raise exceptions.AuthenticationFailed(
                "Invalid token payload: missing 'email' (cannot map to AppUser)."
            )

        # Map to AppUser
        user, _created = AppUser.objects.get_or_create(
            email=email,
            defaults={
                "password_hash": "",   # required field in your model
                "full_name": "",
            },
        )

        # Make DRF/Django treat this as an authenticated user (no models.py change)
        user.is_authenticated = True
        user.is_anonymous = False

        # Optional: attach claims for later use
        request.supabase_claims = payload
        request.supabase_user_id = supabase_user_id

        return (user, token)