import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

User = get_user_model()


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """
    DRF authentication class that verifies Supabase access tokens.

    Expects header:
      Authorization: Bearer <supabase-access-token>
    """

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).decode("utf-8")

        if not auth_header:
            return None  # no auth header → DRF will treat as unauthenticated

        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise exceptions.AuthenticationFailed("Invalid Authorization header format")

        token = parts[1]

        if not settings.SUPABASE_JWT_SECRET:
            raise exceptions.AuthenticationFailed(
                "Supabase JWT secret not configured on backend."
            )

        try:
            # Decode token with Supabase JWT secret
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

        # Supabase usually sets 'sub' as user id, and 'email' in claims
        supabase_user_id = payload.get("sub")
        email = payload.get("email")

        if not supabase_user_id:
            raise exceptions.AuthenticationFailed("Invalid token payload: missing 'sub'")

        # Map Supabase user to Django user
        user, _created = User.objects.get_or_create(
            username=supabase_user_id,
            defaults={
                "email": email or "",
            },
        )

        return (user, None)
