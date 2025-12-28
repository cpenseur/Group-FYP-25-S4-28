import os
import requests
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


@method_decorator(csrf_exempt, name="dispatch")
class SealionTestAPIView(APIView):
    """
    AI test endpoint aligned with the chatbot flow but kept separate.
    Calls Sea-Lion directly and returns {"reply": "..."} like /f1/ai-chatbot/.
    """

    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        prompt = (request.data.get("prompt") or "").strip()
        if not prompt:
            return Response({"reply": "Missing prompt"}, status=status.HTTP_400_BAD_REQUEST)

        api_key = getattr(settings, "SEA_LION_API_KEY", None) or os.environ.get("SEA_LION_API_KEY")
        if not api_key:
            return Response(
                {"reply": "AI service unavailable (SEA_LION_API_KEY not configured)."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        messages = [{"role": "user", "content": prompt}]

        try:
            resp = requests.post(
                "https://api.sea-lion.ai/v1/chat/completions",
                headers={
                    "accept": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "aisingapore/Llama-SEA-LION-v3-70B-IT",
                    "messages": messages,
                    "temperature": 0.4,
                    "max_completion_tokens": 300,
                },
                timeout=40,
            )
        except requests.RequestException as exc:
            return Response(
                {
                    "reply": (
                        "Chat is currently unavailable (network error reaching the AI service). "
                        "Please try again in a moment."
                    ),
                    "error": str(exc),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not resp.ok:
            return Response(
                {
                    "reply": (
                        "Planbot couldn't reach the AI service right now. "
                        "Please refine your question or try again later."
                    ),
                    "error": f"Sea-Lion HTTP {resp.status_code}",
                    "details": resp.text,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            data_json = resp.json()
            answer = (
                data_json.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
        except Exception:
            answer = ""

        if not answer:
            answer = (
                "I couldn't generate a detailed answer just now. "
                "Try asking in a slightly different way."
            )

        return Response({"reply": answer}, status=status.HTTP_200_OK)
