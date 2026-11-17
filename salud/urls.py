from django.urls import path

from .views import PesosView, SaludView

urlpatterns = [
    path("salud/", SaludView.as_view(), name="salud"),
    path("salud/pesos/", PesosView.as_view(), name="salud-pesos"),
]
