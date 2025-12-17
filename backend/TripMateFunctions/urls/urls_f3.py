from django.urls import path, include
from rest_framework.routers import DefaultRouter

from ..views.f3_1_views import (
    F31TripBudgetViewSet,
    F31TripExpenseViewSet,
    F31ExpenseSplitViewSet,
)
from ..views.f3_2_views import (
    F32ChecklistViewSet,
    F32ChecklistItemViewSet,
)
from ..views.f3_3_views import (
    F33ItineraryItemNoteViewSet,
    F33ItineraryItemTagViewSet,
    F33TravelDocumentViewSet,
)

router = DefaultRouter()

# F3.1 - Budgeting
router.register(r"budgets", F31TripBudgetViewSet, basename="f3-budget")
router.register(r"expenses", F31TripExpenseViewSet, basename="f3-expense")
router.register(r"expense-splits", F31ExpenseSplitViewSet, basename="f3-expense-split")

# F3.2 - Checklists
router.register(r"checklists", F32ChecklistViewSet, basename="f3-checklist")
router.register(r"checklist-items", F32ChecklistItemViewSet, basename="f3-checklist-item")

# F3.3 - Notes, Tags & Documents
router.register(r"notes", F33ItineraryItemNoteViewSet, basename="f3-note")
router.register(r"tags", F33ItineraryItemTagViewSet, basename="f3-tag")
router.register(r"documents", F33TravelDocumentViewSet, basename="f3-document")

urlpatterns = [
    path("", include(router.urls)),
]

# backend/.../urls_f3.py

# TripMateFunctions/urls/urls_f3.py
'''
from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views.f3_1_views import (
    F31TripBudgetViewSet,
    F31TripExpenseViewSet,
    F31ExpenseSplitViewSet,
    fx_latest,
)

from ..views.f3_2_views import (
    F32ChecklistViewSet,
    F32ChecklistItemViewSet,
)

from ..views.f3_3_views import (
    F33ItineraryItemNoteViewSet,
    F33ItineraryItemTagViewSet,
    F33TravelDocumentViewSet,
)

router = DefaultRouter()

# F3.1 - Budget
router.register(r"budgets", F31TripBudgetViewSet, basename="f3-budget")
router.register(r"expenses", F31TripExpenseViewSet, basename="f3-expense")
router.register(r"expense-splits", F31ExpenseSplitViewSet, basename="f3-expense-split")

# F3.2 - Checklists
router.register(r"checklists", F32ChecklistViewSet, basename="f3-checklist")
router.register(r"checklist-items", F32ChecklistItemViewSet, basename="f3-checklist-item")

# F3.3 - Notes/Tags/Documents
router.register(r"notes", F33ItineraryItemNoteViewSet, basename="f3-note")
router.register(r"tags", F33ItineraryItemTagViewSet, basename="f3-tag")
router.register(r"documents", F33TravelDocumentViewSet, basename="f3-document")

urlpatterns = [
    # ✅ Needed for currency conversion
    path("fx/latest/", fx_latest),
] + router.urls'''
