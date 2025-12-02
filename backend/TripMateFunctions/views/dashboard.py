# TripMateFunctions/views/dashboard.py
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin


class DashboardView(LoginRequiredMixin, TemplateView):
    """
    Simple dashboard that shows the logged-in user's name.
    """
    template_name = "dashboard.html"
    login_url = "login"        # name of the login URL
    redirect_field_name = "next"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        user = self.request.user

        # Prefer full name if it exists, otherwise username
        display_name = user.get_full_name() or user.get_username()
        ctx["display_name"] = display_name

        return ctx
