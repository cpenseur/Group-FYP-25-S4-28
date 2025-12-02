from rest_framework import serializers
from ..models import CountryInfo, LocalContextCache


class F4CountryInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CountryInfo
        fields = "__all__"


class F4LocalContextCacheSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocalContextCache
        fields = "__all__"
