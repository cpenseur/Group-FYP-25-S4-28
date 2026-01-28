from rest_framework.permissions import BasePermission
from TripMateFunctions.models import AppUser

class IsAppAdmin(BasePermission):
    message = "Admin access required."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user:
            return False

        # CASE A: authentication already set request.user = AppUser
        role = getattr(user, "role", None)
        status = getattr(user, "status", None)
        if role is not None:
            return (role == "admin") and (status in (None, "verified", "active"))

        # CASE B: request.user is some auth object, so look up AppUser
        auth_user_id = getattr(user, "auth_user_id", None) or getattr(user, "id", None)
        if not auth_user_id:
            return False

        app_user = AppUser.objects.filter(auth_user_id=auth_user_id).only("role", "status").first()
        if not app_user:
            app_user = AppUser.objects.filter(id=auth_user_id).only("role", "status").first()

        if not app_user:
            return False

        return (app_user.role == "admin") and (app_user.status in (None, "verified", "active"))