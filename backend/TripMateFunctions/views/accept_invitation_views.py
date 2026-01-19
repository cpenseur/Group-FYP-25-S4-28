"""
Accept trip invitation system.
Handles invitation token validation and trip collaboration activation.
"""

from django.utils import timezone
from django.db import transaction
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Trip, TripCollaborator


class AcceptTripInvitationView(APIView):
    """
    POST /api/f1/trip-invitation/{token}/accept/
    
    Accepts trip invitation using unique token.
    Updates TripCollaborator status from INVITED to ACTIVE.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        """
        Request body: {} (empty, user comes from authentication)
        """
        current_user = request.user

        # Find invitation by token
        try:
            collaborator = TripCollaborator.objects.select_related('trip').get(
                invite_token=token,
                status=TripCollaborator.Status.INVITED
            )
        except TripCollaborator.DoesNotExist:
            return Response(
                {"error": "Invalid or expired invitation"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Verify email matches
        if collaborator.invited_email != current_user.email:
            return Response(
                {
                    "error": f"This invitation was sent to {collaborator.invited_email}. "
                             f"Please log in with that email to accept."
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # Use transaction to prevent race conditions
        with transaction.atomic():
            # Check if user is already a collaborator on this trip
            # Lock the rows to prevent concurrent modifications
            existing_collab = TripCollaborator.objects.select_for_update().filter(
                trip=collaborator.trip,
                user=current_user,
                status=TripCollaborator.Status.ACTIVE
            ).exclude(id=collaborator.id).first()

            if existing_collab:
                # User already accepted through a different invitation
                # Delete the duplicate pending invitation to clean up
                collaborator.delete()
                
                return Response(
                    {
                        "message": "You have already accepted this invitation",
                        "trip_id": collaborator.trip.id,
                        "trip_title": collaborator.trip.title,
                        "role": existing_collab.role,
                        "already_accepted": True
                    },
                    status=status.HTTP_200_OK
                )

            # Update collaborator status
            collaborator.user = current_user
            collaborator.status = TripCollaborator.Status.ACTIVE
            collaborator.accepted_at = timezone.now()
            collaborator.invite_token = None  # Clear token after acceptance
            collaborator.save()

        return Response(
            {
                "message": "Invitation accepted successfully",
                "trip_id": collaborator.trip.id,
                "trip_title": collaborator.trip.title,
                "role": collaborator.role,
                "already_accepted": False
            },
            status=status.HTTP_200_OK
        )

    @method_decorator(ensure_csrf_cookie)
    def get(self, request, token):
        """
        GET /api/f1/trip-invitation/{token}/accept/
        
        Returns invitation details without accepting (for preview).
        Sets CSRF cookie for subsequent POST request.
        """
        try:
            collaborator = TripCollaborator.objects.select_related('trip').get(
                invite_token=token,
                status=TripCollaborator.Status.INVITED
            )
        except TripCollaborator.DoesNotExist:
            return Response(
                {"error": "Invalid or expired invitation"},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            {
                "trip_id": collaborator.trip.id,
                "trip_title": collaborator.trip.title,
                "invited_email": collaborator.invited_email,
                "role": collaborator.role,
                "invited_at": collaborator.invited_at.isoformat() if collaborator.invited_at else None,
            },
            status=status.HTTP_200_OK
        )