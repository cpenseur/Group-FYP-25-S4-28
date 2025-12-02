from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import Trip, TripDay, ItineraryItem, AppUser
from ..serializers.f2_6_serializers import (
    F26TemplateCopyRequestSerializer,
    F26TemplateCopyResponseSerializer,
)


class F26ItineraryTemplateCopyView(APIView):
    """
    F2.6 - Copy a public itinerary as private template.
    """

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        req = F26TemplateCopyRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        data = req.validated_data

        try:
            source_trip = Trip.objects.get(id=data["public_trip_id"], visibility="public")
        except Trip.DoesNotExist:
            return Response(
                {"detail": "Template itinerary no longer available"},
                status=status.HTTP_404_NOT_FOUND,
            )

        user = request.user if request.user.is_authenticated else None
        if not user and data.get("new_owner_id"):
            try:
                user = AppUser.objects.get(id=data["new_owner_id"])
            except AppUser.DoesNotExist:
                pass
        if not user:
            return Response(
                {"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED
            )

        # Create new Trip
        new_trip = Trip.objects.create(
            owner=user,
            title=source_trip.title,
            main_city=source_trip.main_city,
            main_country=source_trip.main_country,
            visibility="private",
            start_date=source_trip.start_date,
            end_date=source_trip.end_date,
            description=source_trip.description,
            travel_type=source_trip.travel_type,
            is_demo=False,
        )

        # Copy days
        day_map = {}
        for day in source_trip.days.all():
            new_day = TripDay.objects.create(
                trip=new_trip,
                date=day.date,
                day_index=day.day_index,
                note=day.note,
            )
            day_map[day.id] = new_day

        # Copy items (without expenses/media)
        for item in source_trip.items.all():
            ItineraryItem.objects.create(
                trip=new_trip,
                day=day_map.get(item.day_id),
                destination=item.destination,
                title=item.title,
                item_type=item.item_type,
                start_time=item.start_time,
                end_time=item.end_time,
                lat=item.lat,
                lon=item.lon,
                address=item.address,
                notes_summary=item.notes_summary,
                cost_amount=None,
                cost_currency=None,
                booking_reference="",
                is_all_day=item.is_all_day,
                sort_order=item.sort_order,
            )

        res = {
            "new_trip_id": new_trip.id,
            "message": "Itinerary successfully copied to your trips.",
        }
        return Response(
            F26TemplateCopyResponseSerializer(res).data,
            status=status.HTTP_201_CREATED,
        )
