from django.http import JsonResponse
from openai import OpenAI
import os

# use Sealion API
client = OpenAI(
    api_key=os.getenv("SEALION_API_KEY"),
    base_url="https://api.sea-lion.ai/v1"
)

def test_sealion_api(request):
    try:
        response = client.chat.completions.create(
            model="aisingapore/Gemma-SEA-LION-v4-27B-IT",
            messages=[{"role": "user", "content": "Hello from TripMate!"}]
        )
        return JsonResponse(response.dict())
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
