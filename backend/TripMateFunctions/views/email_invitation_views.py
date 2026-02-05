"""
Email invitation system for group trips.
Sends invitation emails with unique tokens to invited users.
"""

import secrets
import ssl
import smtplib
import threading
import logging
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Trip, TripCollaborator

logger = logging.getLogger(__name__)


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

        # Send email asynchronously (non-blocking)
        def send_invitation_email_async():
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

                # Prefer Brevo HTTP API, fall back to SMTP
                if getattr(settings, "BREVO_API_KEY", ""):
                    headers = {
                        "api-key": settings.BREVO_API_KEY,
                        "Content-Type": "application/json",
                    }
                    payload = {
                        "sender": {
                            "email": settings.BREVO_SENDER_EMAIL,
                            "name": settings.BREVO_SENDER_NAME,
                        },
                        "to": [{"email": invited_email}],
                        "subject": subject,
                        "textContent": body,
                    }
                    resp = requests.post(
                        settings.BREVO_API_URL,
                        headers=headers,
                        json=payload,
                        timeout=10,
                    )
                    resp.raise_for_status()
                    logger.info(f"Invitation email sent to {invited_email} via Brevo (messageId={resp.json().get('messageId')})")
                    return

                # Fallback to SMTP if HTTP providers are not configured
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE

                server = smtplib.SMTP(settings.INVITATION_EMAIL_HOST, settings.INVITATION_EMAIL_PORT, timeout=10)
                server.starttls(context=context)
                server.login(settings.INVITATION_EMAIL_USER, settings.INVITATION_EMAIL_PASSWORD)
                server.send_message(msg)
                server.quit()
                logger.info(f"Invitation email sent to {invited_email} via SMTP")

            except Exception as e:
                logger.error(f"Failed to send invitation email to {invited_email}: {str(e)}")

        # Start email sending in background thread
        email_thread = threading.Thread(target=send_invitation_email_async)
        email_thread.start()

        # Return immediately without waiting for email
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
