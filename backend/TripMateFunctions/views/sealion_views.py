from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from openai import OpenAI
from rest_framework.authentication import SessionAuthentication
import os

class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return
    
client = OpenAI(
    api_key=os.getenv("SEALION_API_KEY"),
    base_url="https://api.sealion.ai/v1"
)

@method_decorator(csrf_exempt, name="dispatch")
class SealionTestAPIView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = []

    def post(self, request):
        prompt = request.data.get("prompt", "")

        if not prompt:
            return Response(
                {"error": "Missing prompt"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            response = client.chat.completions.create(
                model="aisingapore/Gemma-SEA-LION-v4-27B-IT",
                messages=[{"role": "user", "content": prompt}]
            )

            return Response({
                "content": response.choices[0].message.content
            })

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
