from rest_framework import serializers


class F6ExportPDFRequestSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
