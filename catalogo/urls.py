from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import BuscarUbicacionView, IngredienteViewSet, OpcionesView, PlatilloViewSet, RecetaViewSet, SupermercadoViewSet

router = DefaultRouter()
router.register("platillos", PlatilloViewSet)
router.register("ingredientes", IngredienteViewSet)
router.register("supermercados", SupermercadoViewSet)
router.register("recetas", RecetaViewSet, basename="receta")
urlpatterns = [
    path("ubicacion/buscar/", BuscarUbicacionView.as_view(), name="buscar-ubicacion"),
    path("opciones/", OpcionesView.as_view(), name="opciones"),
] + router.urls
