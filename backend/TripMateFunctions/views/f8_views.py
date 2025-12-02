from .base_views import BaseViewSet
from ..models import AppUser, Trip, DestinationFAQ, DestinationQA, SupportTicket
from ..serializers.f8_serializers import (
    F8AdminUserSerializer,
    F8AdminTripSerializer,
    F8AdminDestinationFAQSerializer,
    F8AdminDestinationQASerializer,
    F8SupportTicketSerializer,
)


class F8AdminUserViewSet(BaseViewSet):
    queryset = AppUser.objects.all()
    serializer_class = F8AdminUserSerializer


class F8AdminTripViewSet(BaseViewSet):
    queryset = Trip.objects.all()
    serializer_class = F8AdminTripSerializer


class F8AdminDestinationFAQViewSet(BaseViewSet):
    queryset = DestinationFAQ.objects.all()
    serializer_class = F8AdminDestinationFAQSerializer


class F8AdminDestinationQAViewSet(BaseViewSet):
    queryset = DestinationQA.objects.all()
    serializer_class = F8AdminDestinationQASerializer


class F8SupportTicketViewSet(BaseViewSet):
    queryset = SupportTicket.objects.all()
    serializer_class = F8SupportTicketSerializer
