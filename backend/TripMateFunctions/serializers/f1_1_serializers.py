# backend/TripMateFunctions/serializers/f1_1_serializers.py
from decimal import Decimal
from rest_framework import serializers
import uuid

from ..models import (
    Trip,
    TripDay,
    ItineraryItem,
    TripCollaborator,
    TripBudget,
    Destination,
    AppUser,
)


class TripDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = TripDay
        fields = ["id", "trip", "date", "day_index", "note"]


class ItineraryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItineraryItem
        fields = [
            "id",
            "trip",
            "day",
            "destination",
            "title",
            "item_type",
            "start_time",
            "end_time",
            "lat",
            "lon",
            "address",
            "thumbnail_url",
            "notes_summary",
            "cost_amount",
            "cost_currency",
            "booking_reference",
            "is_all_day",
            "sort_order",
        ]

class TripCollaboratorSerializer(serializers.ModelSerializer):
    user_id = serializers.SerializerMethodField()
    invited_email = serializers.EmailField(allow_null=True, allow_blank=True)
    user = serializers.SerializerMethodField()
    
    class Meta:
        model = TripCollaborator
        fields = ["id", "user_id", "user", "invited_email", "role", "status", "invited_at", "accepted_at"]
    
    def get_user_id(self, obj):
        if obj.user_id:
            return str(obj.user_id)
        return None
    
    def get_user(self, obj):
        if obj.user:
            return {
                "id": str(obj.user.id),
                "email": obj.user.email,
                "full_name": obj.user.full_name or "",
            }
        return None


class TripSerializer(serializers.ModelSerializer):
    """
    Full Trip + nested days/items (used by itinerary editor F1.1).
    Owner is read-only and should be taken from request.user in the viewset.
    """

    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    days = TripDaySerializer(many=True, read_only=True)
    items = ItineraryItemSerializer(many=True, read_only=True)
    collaborators = TripCollaboratorSerializer(many=True, read_only=True) 
    class Meta:
        model = Trip
        fields = [
            "id",
            "owner",
            "title",
            "main_city",
            "main_country",
            "visibility",
            "start_date",
            "end_date",
            "description",
            "travel_type",
            "is_demo",
            "created_at",
            "updated_at",
            "days",
            "items",
            "collaborators",  
        ]


class TripCollaboratorSummarySerializer(serializers.Serializer):
    id = serializers.CharField()
    full_name = serializers.CharField(allow_blank=True, required=False)
    email = serializers.EmailField(allow_blank=True, required=False)
    initials = serializers.CharField()
    is_owner = serializers.BooleanField()
    is_current_user = serializers.BooleanField()


class TripOverviewSerializer(serializers.ModelSerializer):
    """
    Lightweight "header" view for TripSubHeader:
    - collaborators
    - location
    - duration
    - budget summary
    """

    collaborators = serializers.SerializerMethodField()
    location_label = serializers.SerializerMethodField()
    duration_label = serializers.SerializerMethodField()
    currency_code = serializers.SerializerMethodField()
    currency_symbol = serializers.SerializerMethodField()
    planned_total = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            "id",
            "title",
            "main_city",
            "main_country",
            "start_date",
            "end_date",
            "collaborators",
            "location_label",
            "duration_label",
            "currency_code",
            "currency_symbol",
            "planned_total",
        ]
        
    def get_collaborators(self, obj: Trip):
        """
        Return all TripCollaborator users for this trip.
        If none exist, at least show the Trip.owner as a collaborator.
        Also mark which collaborator is the current logged-in user.
        """
        # figure out current logged-in AppUser (if any)
        request = self.context.get("request")
        current_user = None
        if request is not None:
            current_user = getattr(request, "app_user", None) or getattr(
                request, "user", None
            )

        collabs_qs = (
            obj.collaborators.select_related("user")
            .order_by("-role", "invited_at")  # owner first, then others
        )

        out = []
        for c in collabs_qs:
            # If invited_email exists, always allow showing it
            invited_email = (getattr(c, "invited_email", "") or "").strip()

            u = None
            raw_user_id = getattr(c, "user_id", None)

            if raw_user_id:
                try:
                    user_uuid = uuid.UUID(str(raw_user_id))
                    u = AppUser.objects.filter(id=user_uuid).first()
                except (ValueError, TypeError):
                    u = None

            if u:        
                initials = _initials_from_name(u.full_name, u.email)
                is_current = bool(current_user and getattr(current_user, "id", None) == u.id)

                out.append(
                    {
                        "id": str(u.id),
                        "full_name": u.full_name or "",
                        "email": u.email or "",
                        "initials": initials,
                        "is_owner": (c.role == TripCollaborator.Role.OWNER),
                        "is_current_user": is_current,
                    }
                )
                continue

            # pending invite (not AppUser yet)
            elif invited_email:
                initials = _initials_from_name(None, invited_email)
                out.append(
                    {
                        "id": "0",  
                        "full_name": "",
                        "email": invited_email,
                        "initials": initials,
                        "is_owner": False,
                        "is_current_user": False,
                    }
                )

        # 🔹 Fallback: no TripCollaborator rows – still show the owner
        if not out and obj.owner:
            u: AppUser = obj.owner
            initials = _initials_from_name(u.full_name, u.email)
            is_current = bool(current_user and getattr(current_user, "id", None) == u.id)

            out.append(
                {
                    "id": str(u.id),
                    "full_name": u.full_name or "",
                    "email": u.email or "",
                    "initials": initials,
                    "is_owner": True,
                    "is_current_user": is_current,
                }
            )

        return out


    def get_location_label(self, obj: Trip) :
        qs = (
            ItineraryItem.objects.filter(trip=obj, destination__city__isnull=False)
            .values_list("destination__city", flat=True)
            .distinct()
        )
        cities = [c for c in qs if c]
        if not cities and obj.main_city:
            cities = [obj.main_city]
        if not cities:
            return ""
        return " - ".join(cities)

    def get_duration_label(self, obj: Trip) -> str:
        # For AI-generated trips: duration comes from TripDay count (slider),
        # because start/end are just availability window.
        if obj.travel_type in ("solo_ai", "group_ai"):
            day_count = obj.days.count()  # TripDay related_name="days"
            if day_count > 0:
                nights = max(day_count - 1, 0)
                return f"{day_count} days - {nights} nights"
            return ""

        # For manual trips: keep original behavior (date range is the actual trip)
        if not obj.start_date or not obj.end_date:
            return ""

        days = (obj.end_date - obj.start_date).days + 1
        if days <= 0:
            return ""

        nights = max(days - 1, 0)
        return f"{days} days - {nights} nights"


    def get_currency_code(self, obj: Trip) -> str | None:
        budget = getattr(obj, "budget", None)
        return budget.currency if budget else None

    def get_currency_symbol(self, obj: Trip) -> str:
        budget = getattr(obj, "budget", None)
        return _currency_symbol(budget.currency if budget else None)

    def get_planned_total(self, obj: Trip):
        budget = getattr(obj, "budget", None)
        if not budget or budget.planned_total is None:
            return None
        if isinstance(budget.planned_total, Decimal):
            return str(budget.planned_total)
        return budget.planned_total


# helpers -----------------------------------------------------


def _initials_from_name(full_name: str | None, email: str | None = None) -> str:
    if full_name:
        parts = [p for p in full_name.strip().split() if p]
        if len(parts) == 1:
            return parts[0][0].upper()
        return (parts[0][0] + parts[-1][0]).upper()
    if email:
        return email[0].upper()
    return "U"


def _currency_symbol(code: str | None) -> str:
    if not code:
        return "$"
    code = code.upper()
    mapping = {
        "USD": "$",
        "SGD": "$",
        "EUR": "€",
        "GBP": "£",
        "JPY": "¥",
        "CNY": "¥",
        "IDR": "Rp",
        "AUD": "A$",
        "NZD": "NZ$",
        "MYR": "RM",
        "THB": "฿",
        "KRW": "₩",
        "INR": "₹",
    }
    return mapping.get(code, code)


class TripCollaboratorInviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=TripCollaborator.Role.choices,
        required=False,
        default=TripCollaborator.Role.EDITOR,
    )
