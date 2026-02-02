"""
Email invitation system for group trips.
Sends invitation emails with unique tokens to invited users.
"""

import secrets
import ssl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Trip, TripCollaborator


class SendTripInvitationView(APIView):
    """
    POST /api/f1/trips/{trip_id}/invite/
    
    Sends email invitation to collaborate on a trip.
    Creates TripCollaborator with invited status and unique token.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, trip_id):
        """
        Request body:
        {
            "email": "friend@example.com"
        }
        """
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response(
                {"error": "Trip not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if current user is the trip owner
        if trip.owner_id != request.user.id:
            return Response(
                {"error": "Only trip owner can send invitations"},
                status=status.HTTP_403_FORBIDDEN
            )

        invited_email = request.data.get("email")
        if not invited_email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        role = request.data.get("role", "viewer")

        valid_roles = [choice[0] for choice in TripCollaborator.Role.choices]
        if role not in valid_roles:
            return Response(
                {"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if already invited
        existing_collab = TripCollaborator.objects.filter(
            trip=trip,
            invited_email=invited_email
        ).first()

        if existing_collab:
            if existing_collab.status == TripCollaborator.Status.ACTIVE:
                return Response(
                    {"error": "User already accepted invitation"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            elif existing_collab.status == TripCollaborator.Status.INVITED:
                return Response(
                    {"error": "Invitation already sent to this email"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Generate unique invitation token
        invite_token = secrets.token_urlsafe(32)

        # Determine invitation type based on trip's travel_type
        is_ai = getattr(trip, 'travel_type', None) == 'group_ai_pending'
        invitation_type = TripCollaborator.InvitationType.AI if is_ai else TripCollaborator.InvitationType.DIRECT

        # Create TripCollaborator with invited status
        collaborator = TripCollaborator.objects.create(
            trip=trip,
            invited_email=invited_email,
            role=role,
            status=TripCollaborator.Status.INVITED,
            invite_token=invite_token,
            invitation_type=invitation_type,
        )

        # Build invitation link based on invitation type
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        if invitation_type == TripCollaborator.InvitationType.AI:
            invitation_link = f"{frontend_url}/ai-invitation/{invite_token}"
        else:
            invitation_link = f"{frontend_url}/trip-invitation/{invite_token}"

        # Send email using direct SMTP (bypassing Django's email system)
        try:
            subject = f"{request.user.email} invited you to join a trip on TripMate"
            body = f"""
Hello!

{request.user.email} has invited you to collaborate on a trip: "{trip.title}"

Click the link below to accept the invitation and join the trip:
{invitation_link}

This invitation will expire in 7 days.

Best regards,
TripMate Team
            """.strip()

            # Create message
            msg = MIMEMultipart()
            msg['From'] = settings.INVITATION_EMAIL_USER
            msg['To'] = invited_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))

            # Create SSL context that doesn't verify certificates
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE

            # Connect to Gmail SMTP server
            server = smtplib.SMTP(settings.INVITATION_EMAIL_HOST, settings.INVITATION_EMAIL_PORT)
            server.starttls(context=context)  # Use our custom SSL context
            server.login(settings.INVITATION_EMAIL_USER, settings.INVITATION_EMAIL_PASSWORD)
            
            # Send email
            server.send_message(msg)
            server.quit()

            return Response(
                {
                    "message": "Invitation sent successfully",
                    "invited_email": invited_email,
                    "invitation_link": invitation_link,
                    "invite_token": invite_token,
                    "invitation_type": invitation_type,
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            # Delete the collaborator if email fails
            collaborator.delete()
            print(f"Failed to send invitation email to {invited_email}: {str(e)}")
            return Response(
                {"error": f"Failed to send email: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )