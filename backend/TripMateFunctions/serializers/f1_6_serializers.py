from rest_framework import serializers
from ..models import Destination, DestinationFAQ, DestinationQA, CountryInfo
from .f1_1_serializers import ItineraryItemSerializer  # optional if needed
class DestinationSerializer(serializers.ModelSerializer):
    """Lightweight destination serializer for FAQ panel usage."""

    class Meta:
        model = Destination
        fields = [
            "id",
            "name",
            "address",
            "city",
            "country",
            "country_code",
            "lat",
            "lon",
            "timezone",
            "category",
            "subcategory",
            "description",
            "opening_hours_json",
            "average_rating",
            "rating_count",
            "external_ref",
        ]


class F16DestinationFAQRequestSerializer(serializers.Serializer):
    destination_id = serializers.IntegerField()


class F16FAQEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = DestinationFAQ
        fields = ["id", "question", "answer", "source_type", "upvotes"]


class F16QAEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = DestinationQA
        fields = ["id", "question", "answer", "upvotes", "is_public"]


class F16CountryInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CountryInfo
        fields = [
            "country_code",
            "country_name",
            "currency_code",
            "visa_requirements",
            "holidays_json",
            "travel_notes",
            "required_documents",
            "local_transport_info",
            "payment_notes",
        ]


class F16DestinationFAQPanelSerializer(serializers.Serializer):
    destination = DestinationSerializer()
    faqs = F16FAQEntrySerializer(many=True)
    community_qas = F16QAEntrySerializer(many=True)
    country_info = F16CountryInfoSerializer(required=False, allow_null=True)
