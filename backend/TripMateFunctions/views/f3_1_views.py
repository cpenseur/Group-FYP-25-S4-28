#f3.1 budget view
from .base_views import BaseViewSet
from ..models import TripBudget, TripExpense, ExpenseSplit
from ..serializers.f3_1_serializers import (
    F31TripBudgetSerializer,
    F31TripExpenseSerializer,
    F31ExpenseSplitSerializer,
)

class F31TripBudgetViewSet(BaseViewSet):
    queryset = TripBudget.objects.all()
    serializer_class = F31TripBudgetSerializer


class F31TripExpenseViewSet(BaseViewSet):
    queryset = TripExpense.objects.all()
    serializer_class = F31TripExpenseSerializer


class F31ExpenseSplitViewSet(BaseViewSet):
    queryset = ExpenseSplit.objects.all()
    serializer_class = F31ExpenseSplitSerializer
'''
# TripMateFunctions/views/f3_1_views.py

from .base_views import BaseViewSet

# ✅ IMPORTANT: models live in TripMateFunctions/models.py (one level up from /views)
from ..models import TripBudget, TripExpense, ExpenseSplit, Trip, TripCollaborator

# ✅ IMPORTANT: serializers live in TripMateFunctions/serializers (one level up from /views)
from ..serializers.f3_1_serializers import (
    F31TripBudgetSerializer,
    F31TripExpenseSerializer,
    F31ExpenseSplitSerializer,
)

from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework import status

import datetime
import requests


class F31TripBudgetViewSet(BaseViewSet):
    queryset = TripBudget.objects.all()
    serializer_class = F31TripBudgetSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        trip_id = self.request.query_params.get("trip")
        if trip_id:
            qs = qs.filter(trip_id=trip_id)
        return qs

    @action(detail=False, methods=["get"], url_path="trip-members")
    def trip_members(self, request):
        trip_id = request.query_params.get("trip")
        if not trip_id:
            return Response({"detail": "trip is required"}, status=status.HTTP_400_BAD_REQUEST)

        trip = Trip.objects.filter(id=trip_id).first()
        if not trip:
            return Response({"detail": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

        members = {trip.owner_id: trip.owner}
        for c in TripCollaborator.objects.filter(trip_id=trip_id).select_related("user"):
            members[c.user_id] = c.user

        data = [
            {
                "id": u.id,
                "full_name": getattr(u, "full_name", None),
                "email": getattr(u, "email", None),
            }
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


class F31ExpenseSplitViewSet(BaseViewSet):
    queryset = ExpenseSplit.objects.all()
    serializer_class = F31ExpenseSplitSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        expense_id = self.request.query_params.get("expense")
        if expense_id:
            qs = qs.filter(expense_id=expense_id)
        return qs


# -----------------------------
# FX endpoint for budget page
# -----------------------------
@api_view(["GET"])
def fx_latest(request):
    """
    GET /api/f3/fx/latest/?base=SGD

    Returns:
    {
      "base": "SGD",
      "sgd_per_unit": { "SGD":1, "USD":1.33, ... },
      "year": 2024,
      "fetched_at": "..."
    }

    NOTE: Uses a public dataset (data.gov.sg) for demo purposes.
    """
    base = (request.query_params.get("base") or "SGD").upper()
    if base != "SGD":
        return Response({"detail": "Only base=SGD supported for now."}, status=status.HTTP_400_BAD_REQUEST)

    dataset_id = "d_1ca9cbc55aa0e6added2c719d4bbedac"
    url = "https://data.gov.sg/api/action/datastore_search"

    try:
        r = requests.get(url, params={"resource_id": dataset_id, "limit": 1000}, timeout=12)
        r.raise_for_status()
        payload = r.json()
        records = payload.get("result", {}).get("records", [])

        if not records:
            return Response({"detail": "No FX data returned."}, status=status.HTTP_502_BAD_GATEWAY)

        year_candidates = []
        for k in records[0].keys():
            if isinstance(k, str) and k.isdigit():
                year_candidates.append(int(k))
        if not year_candidates:
            return Response({"detail": "FX dataset missing year columns."}, status=status.HTTP_502_BAD_GATEWAY)

        latest_year = max(year_candidates)
        latest_year_key = str(latest_year)

        series_to_code = {
            "US Dollar": "USD",
            "Euro": "EUR",
            "Pound Sterling": "GBP",
            "Japanese Yen": "JPY",
            "Australian Dollar": "AUD",
            "Canadian Dollar": "CAD",
            "Malaysian Ringgit": "MYR",
            "Hong Kong Dollar": "HKD",
            "Indonesian Rupiah": "IDR",
            "Korean Won": "KRW",
            "Indian Rupee": "INR",
            "Chinese Renminbi": "CNY",
            "Thai Baht": "THB",
            "New Taiwan Dollar": "TWD",
        }

        # Some tables are per 100 units
        per_100_units = {"JPY", "KRW", "IDR", "INR"}

        sgd_per_unit = {"SGD": 1.0}

        for row in records:
            series = row.get("Data Series") or row.get("data_series") or row.get("DataSeries")
            if not series:
                continue

            code = series_to_code.get(series)
            if not code:
                continue

            raw_val = row.get(latest_year_key)
            if raw_val in (None, "", "na", "NA"):
                continue

            try:
                val = float(raw_val)
            except Exception:
                continue

            if code in per_100_units:
                val = val / 100.0

            sgd_per_unit[code] = val

        return Response(
            {
                "base": "SGD",
                "sgd_per_unit": sgd_per_unit,
                "year": latest_year,
                "fetched_at": datetime.datetime.utcnow().isoformat() + "Z",
            },
            status=status.HTTP_200_OK,
        )

    except requests.RequestException as e:
        return Response({"detail": f"Failed to fetch FX data: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)'''