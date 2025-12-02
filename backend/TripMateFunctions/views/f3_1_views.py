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
