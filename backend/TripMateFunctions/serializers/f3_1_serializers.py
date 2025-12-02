from rest_framework import serializers
from ..models import TripBudget, TripExpense, ExpenseSplit


class F31TripBudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripBudget
        fields = ["id", "trip", "currency", "planned_total", "actual_total"]


class F31TripExpenseSerializer(serializers.ModelSerializer):
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
        ]


class F31ExpenseSplitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseSplit
        fields = ["id", "expense", "user", "amount", "is_settled"]
