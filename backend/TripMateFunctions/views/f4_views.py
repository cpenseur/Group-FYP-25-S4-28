from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from ..models import CountryInfo, LocalContextCache
from ..serializers.f4_serializers import (
    F4CountryInfoSerializer,
    F4LocalContextCacheSerializer,
)


class F4LocalInfoView(APIView):
    """
    F4 - Travel Information & Localisation
    """

    def get(self, request, *args, **kwargs):
        country_code = request.query_params.get("country_code")
        if not country_code:
            return Response(
                {"detail": "country_code is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        country = CountryInfo.objects.filter(country_code=country_code).first()
        cache = LocalContextCache.objects.filter(country_code=country_code).order_by(
            "-fetched_at"
        ).first()

        return Response(
            {
                "country_info": F4CountryInfoSerializer(country).data
                if country
                else None,
                "local_context": F4LocalContextCacheSerializer(cache).data
                if cache
                else None,
            },
            status=status.HTTP_200_OK,
        )
