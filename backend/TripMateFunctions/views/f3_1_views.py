# TripMateFunctions/views/f3_1_views.py
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework import status

from .base_views import BaseViewSet
from ..models import (
    TripBudget,
    TripExpense,
    ExpenseSplit,
    Trip,
    TripCollaborator,
)

from ..serializers.f3_1_serializers import (
    F31TripBudgetSerializer,
    F31TripExpenseSerializer,
    F31ExpenseSplitSerializer,
)


@api_view(["GET"])
def fx_latest(request):
    """
    Simple FX endpoint so frontend conversion UI doesn't 404.
    For demo: hardcoded rates. You can replace with a real API later.
    """
    base = (request.query_params.get("base") or "SGD").upper()

    rates_table = {
        "SGD": {"SGD": 1.0, "USD": 0.74, "THB": 26.5, "KRW": 990.0, "JPY": 110.0, "MYR": 3.45},
        "USD": {"USD": 1.0, "SGD": 1.35, "THB": 35.8, "KRW": 1340.0, "JPY": 150.0, "MYR": 4.65},
        "THB": {"THB": 1.0, "SGD": 0.038, "USD": 0.028, "KRW": 37.0, "JPY": 4.1, "MYR": 0.13},
    }

    rates = rates_table.get(base)
    if not rates:
        base = "SGD"
        rates = rates_table["SGD"]

    # Convert base->currency to SGD per unit of currency
    sgd_rate = rates.get("SGD", 1.0)
    sgd_per_unit = {cur: (sgd_rate / rate if rate else 1.0) for cur, rate in rates.items()}

    return Response({"base": "SGD", "sgd_per_unit": sgd_per_unit}, status=status.HTTP_200_OK)

class F31TripBudgetViewSet(BaseViewSet):
    queryset = TripBudget.objects.all()
    serializer_class = F31TripBudgetSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            qs = qs.filter(trip_id=trip_id)
        return qs

    def list(self, request, *args, **kwargs):
        """
        If budget row doesn't exist for a trip yet, create it
        so frontend won't show 'Not found.'
        """
        trip_id = request.query_params.get("trip")
        if trip_id:
            trip = Trip.objects.filter(id=trip_id).first()
            if not trip:
                return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

            TripBudget.objects.get_or_create(
                trip_id=trip_id,
                defaults={"currency": "SGD", "planned_total": None, "actual_total": None},
            )

        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="trip-members")
    def trip_members(self, request):
        """
        Frontend expects: GET /api/f3/budgets/trip-members/?trip=<tripId>
        Returns list of users: [{id, full_name, email}, ...]
        """
        trip_id = request.query_params.get("trip")
        if not trip_id:
            return Response({"detail": "trip is required"}, status=status.HTTP_400_BAD_REQUEST)

        trip = Trip.objects.filter(id=trip_id).select_related("owner").first()
        if not trip:
            return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

        members = {}
        if trip.owner_id and trip.owner:
            members[str(trip.owner_id)] = trip.owner

        collabs = (
            TripCollaborator.objects
            .filter(trip_id=trip_id, user__isnull=False)
            .select_related("user")
        )
        for c in collabs:
            members[str(c.user_id)] = c.user

        data = [
            {"id": str(u.id), "full_name": u.full_name, "email": u.email}
            for u in members.values()
        ]
        return Response(data, status=status.HTTP_200_OK)


class F31TripExpenseViewSet(BaseViewSet):
    queryset = TripExpense.objects.all()
    serializer_class = F31TripExpenseSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            qs = qs.filter(trip_id=trip_id)
        return qs

'''
class F31ExpenseSplitViewSet(BaseViewSet):
    queryset = ExpenseSplit.objects.all()
    serializer_class = F31ExpenseSplitSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        expense_id = self.request.query_params.get("expense")
        if expense_id:
            qs = qs.filter(expense_id=expense_id)
        return qs'''
class F31ExpenseSplitViewSet(BaseViewSet):
    queryset = ExpenseSplit.objects.all()
    serializer_class = F31ExpenseSplitSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        expense_id = self.request.query_params.get("expense")
        if expense_id:
            qs = qs.filter(expense_id=expense_id)
        return qs
    
    def destroy(self, request, *args, **kwargs):
        """Allow deleting individual splits"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

