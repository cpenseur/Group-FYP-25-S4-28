from rest_framework.views import APIView
from rest_framework.response import Response


class F72LandingContentView(APIView):
    """
    F7.2 - Optional API to serve static landing content from backend.
    """

    def get(self, request, *args, **kwargs):
        return Response(
            {
                "features": [
                    "Smart trip planning",
                    "AI itinerary generation",
                    "Collaboration & sharing",
                ],
                "faqs": [],
            }
        )
