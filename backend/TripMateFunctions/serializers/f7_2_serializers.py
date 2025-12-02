from rest_framework import serializers


class F72LandingContentSerializer(serializers.Serializer):
    features = serializers.ListField(child=serializers.CharField())
    faqs = serializers.ListField(child=serializers.CharField())
