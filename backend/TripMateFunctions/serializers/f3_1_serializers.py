# TripMateFunctions/serializers/f3_1_serializers.py
from rest_framework import serializers
from ..models import TripBudget, TripExpense, ExpenseSplit


class F31ExpenseSplitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseSplit
        fields = ["id", "expense", "user", "amount", "is_settled"]


class F31TripExpenseSerializer(serializers.ModelSerializer):
    # IMPORTANT: read_only so DRF won't try to pass "splits" into objects.create()
    splits = F31ExpenseSplitSerializer(many=True, read_only=True)

    class Meta:
        model = TripExpense
        fields = [
            "id",
            "trip",
            "payer",
            "description",
            "category",
            "amount",
            "currency",
            "paid_at",
            "linked_day",
            "linked_item",
            "splits",
        ]


class F31TripBudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripBudget
        fields = ["id", "trip", "currency", "planned_total", "actual_total"]

# TripMateFunctions/serializers/f3_1_serializers.py
'''
from rest_framework import serializers
from ..models import TripBudget, TripExpense, ExpenseSplit


class F31ExpenseSplitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseSplit
        fields = ["id", "expense", "user", "amount", "is_settled"]


class F31TripExpenseSerializer(serializers.ModelSerializer):
    splits = F31ExpenseSplitSerializer(many=True, read_only=True)

    class Meta:
        model = TripExpense
        fields = [
            "id",
            "trip",
            "payer",
            "description",
            "category",
            "amount",
            "currency",
            "paid_at",
            "linked_day",
            "linked_item",
            "splits",
        ]


class F31TripBudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripBudget
        fields = ["id", "trip", "currency", "planned_total", "actual_total"]'''
