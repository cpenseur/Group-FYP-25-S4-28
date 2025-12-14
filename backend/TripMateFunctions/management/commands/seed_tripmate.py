# backend/TripMateFunctions/management/commands/seed_tripmate.py
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from TripMateFunctions.models import (
    AppUser,
    Trip,
    TripCollaborator,
    TripDay,
    Destination,
    TripBudget,
)

class Command(BaseCommand):
    help = "Seed demo Trip / collaborators / budget data for TripMate"

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("Seeding TripMate demo data..."))

        # --- 1. Demo users ---
        owner, _ = AppUser.objects.get_or_create(
            email="owner@example.com",
            defaults={
                "full_name": "Rina Lim",
                "password_hash": "demo",
                "status": AppUser.Status.VERIFIED,
            },
        )

        collab1, _ = AppUser.objects.get_or_create(
            email="louis@example.com",
            defaults={
                "full_name": "Louis Park",
                "password_hash": "demo",
                "status": AppUser.Status.VERIFIED,
            },
        )
        collab2, _ = AppUser.objects.get_or_create(
            email="mei@example.com",
            defaults={
                "full_name": "Mei Tan",
                "password_hash": "demo",
                "status": AppUser.Status.VERIFIED,
            },
        )

        # --- 2. Trip ---
        start = date(2025, 3, 1)
        end = start + timedelta(days=6)  # 7 days, 6 nights

        trip, created = Trip.objects.get_or_create(
            owner=owner,
            title="Trip to Japan",
            defaults={
                "main_city": "Tokyo",
                "main_country": "Japan",
                "start_date": start,
                "end_date": end,
                "visibility": Trip.Visibility.SHARED,
                "description": "Demo seeded trip for UI testing.",
                "is_demo": True,
            },
        )

        # --- 3. Collaborators ---
        TripCollaborator.objects.get_or_create(
            trip=trip,
            user=owner,
            defaults={"role": TripCollaborator.Role.OWNER},
        )
        TripCollaborator.objects.get_or_create(
            trip=trip,
            user=collab1,
            defaults={"role": TripCollaborator.Role.EDITOR},
        )
        TripCollaborator.objects.get_or_create(
            trip=trip,
            user=collab2,
            defaults={"role": TripCollaborator.Role.VIEWER},
        )

        # --- 4. Destinations (for LOCATION text) ---
        tokyo, _ = Destination.objects.get_or_create(
            name="Tokyo Station",
            city="Tokyo",
            country="Japan",
        )
        osaka, _ = Destination.objects.get_or_create(
            name="Osaka Castle",
            city="Osaka",
            country="Japan",
        )

        # Link a couple of days to make sure TripDay relationship exists
        TripDay.objects.get_or_create(
            trip=trip,
            day_index=1,
            defaults={"date": start, "note": "Arrival in Tokyo"},
        )
        TripDay.objects.get_or_create(
            trip=trip,
            day_index=2,
            defaults={"date": start + timedelta(days=1), "note": "Explore Tokyo"},
        )

        # --- 5. Budget (for CURRENCY block) ---
        TripBudget.objects.get_or_create(
            trip=trip,
            defaults={
                "currency": "USD",
                "planned_total": 2650,
                "actual_total": 0,
            },
        )

        self.stdout.write(
            self.style.SUCCESS(f"Seeded demo trip with id={trip.id} (Trip to Japan)")
        )
