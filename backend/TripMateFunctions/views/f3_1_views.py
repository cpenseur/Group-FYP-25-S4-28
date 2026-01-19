# TripMateFunctions/views/f3_1_views.py
import json
import os
import re
import time
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse
from urllib.request import Request, urlopen

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

DEFAULT_DATA_GOV_URL = (
    "https://data.gov.sg/api/action/datastore_search"
    "?resource_id=d_b2b7ffe00aaec3936ed379369fdf531b"
)

# Only names that exist in your dataset
NAME_TO_CODE = {
    "Australian Dollar": "AUD",
    "Euro": "EUR",
    "Hong Kong Dollar": "HKD",
    "Indian Rupee": "INR",
    "Indonesian Rupiah": "IDR",
    "Japanese Yen": "JPY",
    "Korean Won": "KRW",
    "Malaysian Ringgit": "MYR",
    "New Taiwan Dollar": "TWD",
    "Philippine Peso": "PHP",
    "Renminbi": "CNY",
    "Sterling Pound": "GBP",
    "Swiss Franc": "CHF",
    "Thai Baht": "THB",
    "US Dollar": "USD",
}

CODE_TO_NAME = {
    "SGD": "Singapore Dollar",
    "AUD": "Australian Dollar",
    "EUR": "Euro",
    "HKD": "Hong Kong Dollar",
    "INR": "Indian Rupee",
    "IDR": "Indonesian Rupiah",
    "JPY": "Japanese Yen",
    "KRW": "South Korean Won",
    "MYR": "Malaysian Ringgit",
    "TWD": "New Taiwan Dollar",
    "PHP": "Philippine Peso",
    "CNY": "Chinese Yuan",
    "GBP": "British Pound",
    "CHF": "Swiss Franc",
    "THB": "Thai Baht",
    "USD": "US Dollar",
}

SCALE_BY_CODE = {
    "JPY": 100,
    "KRW": 100,
    "IDR": 100,
    "THB": 100,
}

MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
    "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
    "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

FX_CACHE = {
    "updated_at": 0,
    "payload": {"base": "SGD", "sgd_per_unit": {"SGD": 1.0}, "as_of": None},
}


def _build_data_gov_url():
    base = os.environ.get("MAS_FX_URL") or DEFAULT_DATA_GOV_URL
    parsed = urlparse(base)
    qs = parse_qs(parsed.query)
    if "limit" not in qs:
        qs["limit"] = ["500"]
    new_query = urlencode(qs, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def _fetch_data_gov_json():
    url = _build_data_gov_url()
    headers = {"Accept": "application/json"}
    api_key = os.environ.get("MAS_FX_API_KEY")
    if api_key:
        headers["X-API-KEY"] = api_key

    req = Request(url, headers=headers)
    with urlopen(req, timeout=10) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def _latest_rate_column(record):
    candidates = []
    for key in record.keys():
        if re.match(r"^\d{4}[A-Za-z]{3}$", key):
            year = int(key[:4])
            mon = MONTHS.get(key[4:], 0)
            if mon:
                candidates.append((year, mon, key))
    if not candidates:
        return None
    return sorted(candidates, key=lambda x: (x[0], x[1]))[-1][2]


def _get_cached_fx_payload():
    ttl_seconds = int(os.environ.get("MAS_FX_CACHE_SECONDS") or "43200")
    now = int(time.time())
    if now - FX_CACHE["updated_at"] < ttl_seconds:
        return FX_CACHE["payload"]
    return None


def _set_cached_fx_payload(payload):
    FX_CACHE["payload"] = payload
    FX_CACHE["updated_at"] = int(time.time())


@api_view(["GET"])
def fx_currencies(request):
    currencies = []
    seen = set()
    for code, name in CODE_TO_NAME.items():
        if code in seen:
            continue
        seen.add(code)
        currencies.append({"code": code, "name": name})
    currencies.sort(key=lambda x: x["code"])
    return Response({"currencies": currencies}, status=status.HTTP_200_OK)


@api_view(["GET"])
def fx_latest(request):
    """
    Fetch latest monthly FX rates from data.gov.sg and convert to SGD per unit.
    The dataset values appear to be SGD per unit of foreign currency,
    except some that are quoted per 100 units (scaled below).
    """
    cached = _get_cached_fx_payload()
    if cached:
        return Response(cached, status=status.HTTP_200_OK)

    try:
        data = _fetch_data_gov_json()
        records = data.get("result", {}).get("records", [])
        if not records:
            raise ValueError("No records")

        latest_col = _latest_rate_column(records[0])
        if not latest_col:
            raise ValueError("No date columns")

        sgd_per_unit = {"SGD": 1.0}
        for rec in records:
            name = rec.get("DataSeries") or rec.get("data_series")
            if not name:
                continue
            code = NAME_TO_CODE.get(str(name).strip())
            if not code:
                continue
            raw_val = rec.get(latest_col)
            if raw_val in (None, ""):
                continue
            try:
                val = float(str(raw_val).replace(",", ""))
            except ValueError:
                continue
            scale = SCALE_BY_CODE.get(code, 1)
            sgd_per_unit[code] = val / scale

        payload = {"base": "SGD", "sgd_per_unit": sgd_per_unit, "as_of": latest_col}
        _set_cached_fx_payload(payload)
        return Response(payload, status=status.HTTP_200_OK)
    except Exception:
        payload = {"base": "SGD", "sgd_per_unit": {"SGD": 1.0}, "as_of": None}
        _set_cached_fx_payload(payload)
        return Response(payload, status=status.HTTP_200_OK)


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
