from rest_framework import serializers
from ..models import LegalDocument


class F73HelpArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalDocument  # reuse or create HelpArticle model later
        fields = ["id", "doc_type", "content", "version", "published_at", "is_current"]
