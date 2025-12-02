from rest_framework import serializers


class F21SyncRequestSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    last_synced_at = serializers.DateTimeField(required=False)
    # Optional: list of local changes to push
    changes = serializers.JSONField(required=False)


class F21SyncResponseSerializer(serializers.Serializer):
    """
    Return any new remote changes since last_synced_at.
    Frontend will merge these into local state.
    """
    trip = serializers.JSONField(required=False)
    changes = serializers.JSONField(required=False)
    server_timestamp = serializers.DateTimeField()
