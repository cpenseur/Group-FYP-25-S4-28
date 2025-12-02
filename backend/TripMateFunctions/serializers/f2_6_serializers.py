from rest_framework import serializers


class F26TemplateCopyRequestSerializer(serializers.Serializer):
    public_trip_id = serializers.IntegerField()
    new_owner_id = serializers.IntegerField(required=False)


class F26TemplateCopyResponseSerializer(serializers.Serializer):
    new_trip_id = serializers.IntegerField()
    message = serializers.CharField()
