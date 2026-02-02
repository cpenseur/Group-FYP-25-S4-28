"""
Accept trip invitation system.
Handles invitation token validation and trip collaboration activation.
"""

from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Trip, TripCollaborator

# Invitation link valid for 24 hours
INVITATION_EXPIRY_HOURS = 24


class AcceptTripInvitationView(APIView):
    """
    POST /api/f1/trip-invitation/{token}/accept/
    
    Accepts trip invitation using unique token.
    Updates TripCollaborator status from INVITED to ACTIVE.
    Invitation links are valid for 24 hours from creation.
    """
    permission_classes = [IsAuthenticated]

    def _check_invitation_expired(self, collaborator):
        """Check if invitation has expired (older than 24 hours)."""
        if collaborator.invited_at:
            expiry_time = collaborator.invited_at + timedelta(hours=INVITATION_EXPIRY_HOURS)
            if timezone.now() > expiry_time:
                return True
        return False

    def post(self, request, token):
        """
        Request body: {} (empty, user comes from authentication)
        """
        current_user = request.user

        # Find invitation by token - first check for pending (INVITED)
        collaborator = TripCollaborator.objects.select_related('trip', 'user').filter(
            invite_token=token,
            status=TripCollaborator.Status.INVITED
        ).first()
        
        # If not found as INVITED, check if already accepted (ACTIVE with same token)
        if not collaborator:
            collaborator = TripCollaborator.objects.select_related('trip', 'user').filter(
                invite_token=token,
                status=TripCollaborator.Status.ACTIVE
            ).first()
            
            if collaborator:
                # Check if still within 24h window
                if self._check_invitation_expired(collaborator):
                    return Response(
                        {"error": "This invitation has expired."},
                        status=status.HTTP_410_GONE
                    )
                # Already accepted - return success so user can access the trip
                return Response(
                    {
                        "message": "You have already joined this trip",
                        "trip_id": collaborator.trip.id,
                        "trip_title": collaborator.trip.title,
                        "role": collaborator.role,
                        "already_accepted": True
                    },
                    status=status.HTTP_200_OK
                )
            
            # No invitation found at all
            return Response(
                {"error": "Invalid or expired invitation"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if invitation has expired (24 hours)
        if self._check_invitation_expired(collaborator):
            return Response(
                {"error": "This invitation has expired. Please ask the trip owner to send a new invitation."},
                status=status.HTTP_410_GONE
            )

        # Verify the invitation is for this user
        # Case 1: User was already in system when invited (user field is set)
        # Case 2: User was invited by email (invited_email field is set)
        invitation_email = collaborator.invited_email
        if collaborator.user:
            invitation_email = collaborator.user.email
        
        if invitation_email and invitation_email.lower() != current_user.email.lower():
            return Response(
                {
                    "error": f"This invitation was sent to {invitation_email}. "
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
            # Keep the token - link remains valid until 24h expiry
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
        Also handles already-accepted invitations within 24h window.
        """
        # First try to find a pending invitation
        collaborator = TripCollaborator.objects.select_related('trip', 'user').filter(
            invite_token=token,
            status=TripCollaborator.Status.INVITED
        ).first()
        
        # If not found as INVITED, check if it was already accepted (ACTIVE with same token)
        if not collaborator:
            collaborator = TripCollaborator.objects.select_related('trip', 'user').filter(
                invite_token=token,
                status=TripCollaborator.Status.ACTIVE
            ).first()
            
            if collaborator:
                # Check if still within 24h window
                if self._check_invitation_expired(collaborator):
                    return Response(
                        {"error": "This invitation has expired."},
                        status=status.HTTP_410_GONE
                    )
                # Already accepted - return info so frontend can redirect
                invitation_email = collaborator.invited_email
                if collaborator.user:
                    invitation_email = collaborator.user.email
                return Response(
                    {
                        "trip_id": collaborator.trip.id,
                        "trip_title": collaborator.trip.title,
                        "invited_email": invitation_email,
                        "role": collaborator.role,
                        "invited_at": collaborator.invited_at.isoformat() if collaborator.invited_at else None,
                        "already_accepted": True,
                    },
                    status=status.HTTP_200_OK
                )
            
            # No invitation found at all
            return Response(
                {"error": "Invalid or expired invitation"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if invitation has expired (24 hours)
        if self._check_invitation_expired(collaborator):
            return Response(
                {"error": "This invitation has expired. Please ask the trip owner to send a new invitation."},
                status=status.HTTP_410_GONE
            )

        # Get the email from either invited_email or user.email
        invitation_email = collaborator.invited_email
        if collaborator.user:
            invitation_email = collaborator.user.email

        return Response(
            {
                "trip_id": collaborator.trip.id,
                "trip_title": collaborator.trip.title,
                "invited_email": invitation_email,
                "role": collaborator.role,
                "invited_at": collaborator.invited_at.isoformat() if collaborator.invited_at else None,
                "already_accepted": False,
            },
            status=status.HTTP_200_OK
        )