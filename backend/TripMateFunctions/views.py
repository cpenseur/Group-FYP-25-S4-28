from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .models import (
    AppUser,
    Trip,
    TripDay,
    ItineraryItem,
    TripExpense,
    TripBudget,
    Checklist,
    ChecklistItem,
    TravelDocument,
    TripPhoto,
    Destination,
    DestinationFAQ,
    DestinationQA,
    CountryInfo,
)
from .serializers import (
    AppUserSerializer,
    TripSerializer,
    TripDaySerializer,
    ItineraryItemSerializer,
    TripExpenseSerializer,
    TripBudgetSerializer,
    ChecklistSerializer,
    ChecklistItemSerializer,
    TravelDocumentSerializer,
    TripPhotoSerializer,
    DestinationSerializer,
    DestinationFAQSerializer,
    DestinationQASerializer,
    CountryInfoSerializer,
)


class BaseViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # tighten later with auth


class AppUserViewSet(BaseViewSet):
    queryset = AppUser.objects.all()
    serializer_class = AppUserSerializer


class TripViewSet(BaseViewSet):
    queryset = Trip.objects.all().select_related("owner")
    serializer_class = TripSerializer


class TripDayViewSet(BaseViewSet):
    queryset = TripDay.objects.all()
    serializer_class = TripDaySerializer


class ItineraryItemViewSet(BaseViewSet):
    queryset = ItineraryItem.objects.all()
    serializer_class = ItineraryItemSerializer


class TripBudgetViewSet(BaseViewSet):
    queryset = TripBudget.objects.all()
    serializer_class = TripBudgetSerializer


class TripExpenseViewSet(BaseViewSet):
    queryset = TripExpense.objects.all()
    serializer_class = TripExpenseSerializer


class ChecklistViewSet(BaseViewSet):
    queryset = Checklist.objects.all()
    serializer_class = ChecklistSerializer


class ChecklistItemViewSet(BaseViewSet):
    queryset = ChecklistItem.objects.all()
    serializer_class = ChecklistItemSerializer


class TravelDocumentViewSet(BaseViewSet):
    queryset = TravelDocument.objects.all()
    serializer_class = TravelDocumentSerializer


class TripPhotoViewSet(BaseViewSet):
    queryset = TripPhoto.objects.all()
    serializer_class = TripPhotoSerializer


class DestinationViewSet(BaseViewSet):
    queryset = Destination.objects.all()
    serializer_class = DestinationSerializer


class DestinationFAQViewSet(BaseViewSet):
    queryset = DestinationFAQ.objects.all()
    serializer_class = DestinationFAQSerializer


class DestinationQAViewSet(BaseViewSet):
    queryset = DestinationQA.objects.all()
    serializer_class = DestinationQASerializer


class CountryInfoViewSet(BaseViewSet):
    queryset = CountryInfo.objects.all()
    serializer_class = CountryInfoSerializer
