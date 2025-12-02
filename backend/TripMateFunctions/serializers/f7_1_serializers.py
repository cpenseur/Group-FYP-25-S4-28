from rest_framework import serializers


class F71DemoRequestSerializer(serializers.Serializer):
    demo_slug = serializers.CharField(required=False, allow_blank=True)
