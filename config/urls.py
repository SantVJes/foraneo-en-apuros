from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.http import HttpResponse
from django.views.generic import TemplateView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


class AppView(TemplateView):
    """Web vieja (HTML + JS). Con Supabase la web es la de Next.js y aquí solo se responde que la API vive."""

    template_name = "app.html"

    def get(self, request, *args, **kwargs):
        if not settings.LOGIN_LOCAL:
            return HttpResponse("Foráneo en apuros API", content_type="text/plain")
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        return {**super().get_context_data(**kwargs), "google_client_id": settings.GOOGLE_CLIENT_ID}


urlpatterns = [
    path("", AppView.as_view(), name="app"),
    path("admin/", admin.site.urls),
    path("api/auth/", include("cuentas.urls")),
    path("api/", include("catalogo.urls")),
    path("api/", include("pro.urls")),
    path("api/", include("salud.urls")),
    path("api/", include("despensa.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
