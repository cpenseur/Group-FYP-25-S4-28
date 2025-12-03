from rest_framework import generics
from ..models import LegalDocument
from ..serializers.f7_3_serializers import F73HelpArticleSerializer


class F73HelpCenterListView(generics.ListAPIView):
    """
    F7.3 - Help center listing (reusing LegalDocument for now).
    """
    queryset = LegalDocument.objects.filter(is_current=True)
    serializer_class = F73HelpArticleSerializer
