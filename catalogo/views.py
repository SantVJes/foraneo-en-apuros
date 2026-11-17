from django.conf import settings
import django_filters
import requests
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DIFICULTADES, RESTRICCIONES, TIPOS_COMIDA, Ingrediente, Platillo, Supermercado
from .sucursales import buscar_direccion, supermercados_cercanos
from .unidades import FRACCIONES_CHOICES, UNIDADES
from .serializers import (
    IngredienteSerializer,
    PlatilloDetalleSerializer,
    PlatilloListaSerializer,
    PrecioSerializer,
    SupermercadoSerializer,
)


class PlatilloFilter(django_filters.FilterSet):
    """?dificultad=facil,intermedio&tipo_comida=cena&estilo=mexicana&max_minutos=30"""

    dificultad = django_filters.MultipleChoiceFilter(choices=DIFICULTADES, conjoined=False)
    tipo_comida = django_filters.MultipleChoiceFilter(choices=TIPOS_COMIDA)
    estilo = django_filters.CharFilter(lookup_expr="iexact")
    fuente = django_filters.CharFilter()
    max_minutos = django_filters.NumberFilter(field_name="tiempo_minutos", lookup_expr="lte")

    def __init__(self, data=None, *args, **kwargs):
        # Permite ?dificultad=facil,intermedio además de ?dificultad=facil&dificultad=intermedio
        if data is not None:
            data = data.copy()
            for campo in ("dificultad", "tipo_comida"):
                valores = []
                for v in data.getlist(campo):
                    valores.extend(x.strip() for x in v.split(",") if x.strip())
                if valores:
                    data.setlist(campo, valores)
        super().__init__(data, *args, **kwargs)

    class Meta:
        model = Platillo
        fields = ["dificultad", "tipo_comida", "estilo", "max_minutos", "fuente"]


class PlatilloViewSet(viewsets.ReadOnlyModelViewSet):
    """Catálogo de platillos con sus ingredientes. Filtra por dificultad, tipo de comida y estilo."""

    queryset = Platillo.objects.prefetch_related("ingredientes__ingrediente").distinct()
    filterset_class = PlatilloFilter

    def get_queryset(self):
        from .models import platillos_visibles

        return platillos_visibles(self.request.user).prefetch_related("ingredientes__ingrediente").distinct()
    search_fields = ["nombre", "descripcion", "ingredientes__ingrediente__nombre"]
    ordering_fields = ["nombre", "tiempo_minutos", "dificultad"]

    def get_serializer_class(self):
        return PlatilloDetalleSerializer if self.action == "retrieve" else PlatilloListaSerializer

    @extend_schema(parameters=[OpenApiParameter(
        "para_mi", bool, description="1 = quitar los platillos con tus alergias o ingredientes que no comes")])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)
        if self.action == "list" and self.request.query_params.get("para_mi") in ("1", "true", "si"):
            from despensa.servicios import platillos_permitidos

            ids = [p.id for p in platillos_permitidos(self.request.user, qs)]
            qs = qs.filter(id__in=ids)
        return qs


class IngredienteViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Ingrediente.objects.all()
    serializer_class = IngredienteSerializer
    search_fields = ["nombre", "categoria"]
    filterset_fields = ["categoria", "unidad_base"]

    @extend_schema(responses=PrecioSerializer(many=True), summary="Comparar precios de un ingrediente")
    @action(detail=True)
    def precios(self, request, pk=None):
        ingrediente = self.get_object()
        precios = sorted(
            ingrediente.precios.filter(supermercado__activo=True).select_related("supermercado"),
            key=lambda p: p.precio_por_unidad,
        )
        return Response(PrecioSerializer(precios, many=True).data)


class SupermercadoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Supermercado.objects.filter(activo=True)
    serializer_class = SupermercadoSerializer
    pagination_class = None

    @extend_schema(
        parameters=[OpenApiParameter("lat", float), OpenApiParameter("lng", float),
                    OpenApiParameter("radio_km", float, description="Si no se manda, usa la de tu perfil")],
        summary="Supermercados cerca de ti (sucursal más cercana de cada cadena)",
    )
    @action(detail=False)
    def cercanos(self, request):
        u = request.user
        try:
            lat = float(request.query_params.get("lat", u.lat))
            lng = float(request.query_params.get("lng", u.lng))
            radio = float(request.query_params.get("radio_km", u.radio_km))
        except (TypeError, ValueError):
            return Response({"detail": "Manda lat y lng, o guarda tu ubicación en tu perfil."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not (0.5 <= radio <= 50):
            return Response({"radio_km": "Elige una distancia entre 0.5 y 50 km."}, status=status.HTTP_400_BAD_REQUEST)
        cercanos, mapa_ok = supermercados_cercanos(lat, lng, radio)
        membresias = set(u.membresias.values_list("id", flat=True))
        resultado = []
        for sup in self.get_queryset():
            c = cercanos.get(sup.id)
            resultado.append({
                **SupermercadoSerializer(sup).data,
                "tienes_membresia": sup.id in membresias,
                "cerca": c is not None,
                "distancia_km": c["distancia_km"] if c else None,
                "sucursal": {"nombre": c["sucursal"].nombre, "direccion": c["sucursal"].direccion,
                             "lat": c["sucursal"].lat, "lng": c["sucursal"].lng} if c else None,
            })
        resultado.sort(key=lambda r: (r["distancia_km"] is None, r["distancia_km"] or 0, r["nombre"]))
        return Response({"radio_km": radio, "mapa_consultado": mapa_ok, "supermercados": resultado})


class BuscarUbicacionView(APIView):
    throttle_scope = "direcciones"  # Nominatim pide no abusar de su servicio gratis
    @extend_schema(parameters=[OpenApiParameter("q", str, description="Colonia, calle o ciudad")],
                   summary="Buscar una dirección (si no quieres usar el GPS)")
    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 3:
            return Response({"q": "Escribe al menos 3 letras."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(buscar_direccion(q))
        except requests.RequestException:
            return Response({"detail": "El buscador de direcciones no responde. Intenta otra vez o usa tu GPS."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)


class OpcionesView(APIView):
    """Listas para llenar formularios en la app."""

    def get(self, request):
        def lista(choices):
            return [{"valor": v, "nombre": n} for v, n in choices]

        return Response({
            "restricciones": lista(RESTRICCIONES),
            "dificultades": lista(DIFICULTADES),
            "tipos_comida": lista(TIPOS_COMIDA),
            "unidades": lista(UNIDADES),
            "fracciones": lista(FRACCIONES_CHOICES),
            "modos_compra": [{"valor": "varios", "nombre": "Lo más barato en varios súper"},
                             {"valor": "un_super", "nombre": "Todo en un solo súper"}],
            "pro_activo": settings.PRO_ACTIVO,
            "planes_gratis": settings.PLANES_GRATIS,
            "pro_mensual": settings.PRO_PRECIO_MENSUAL,
            "pro_anual": settings.PRO_PRECIO_ANUAL,
        })


class RecetaViewSet(viewsets.ModelViewSet):
    """Recetas de la gente. ?de=mias|guardadas|comunidad (por defecto comunidad) y ?search=.
    Solo el autor edita o borra. Guardar una receta hace que pueda salir en tu semana."""

    serializer_class = None
    search_fields = ["nombre", "descripcion", "ingredientes__ingrediente__nombre"]
    filterset_class = PlatilloFilter
    ordering = ["-creado"]

    def get_serializer_class(self):
        from .serializers import RecetaSerializer

        return RecetaSerializer

    def get_queryset(self):
        from django.db.models import Count

        from .models import OCULTAR_CON_REPORTES

        yo = self.request.user
        de = self.request.query_params.get("de", "comunidad")
        qs = Platillo.objects.select_related("autor").prefetch_related("ingredientes__ingrediente", "guardada_por", "cocinada_por")
        if self.action != "list":
            # Ver, guardar o reportar: cualquier receta visible. Editar o borrar: solo las tuyas.
            if self.action in ("update", "partial_update", "destroy"):
                return qs.filter(autor=yo)
            from .models import platillos_visibles

            return qs.filter(id__in=platillos_visibles(yo).values("id"))
        autor = self.request.query_params.get("autor")
        if autor and autor.isdigit():
            # Perfil de quien cocina: sus recetas públicas (y todas si eres tú).
            qs = qs.filter(autor_id=int(autor))
            if int(autor) != yo.id:
                qs = qs.filter(publica=True, reportes__lt=OCULTAR_CON_REPORTES)
        elif de == "mias":
            qs = qs.filter(autor=yo)
        elif de == "guardadas":
            qs = qs.filter(guardada_por=yo)
        else:
            qs = qs.filter(publica=True, reportes__lt=OCULTAR_CON_REPORTES).exclude(autor=None)
        return qs.annotate(n_guardados=Count("guardada_por", distinct=True)).order_by("-n_guardados", "-creado").distinct()

    @action(detail=True, methods=["post"])
    def guardar(self, request, pk=None):
        """Guarda o quita de tus guardadas (alterna)."""
        p = self.get_object()
        if p.guardada_por.filter(id=request.user.id).exists():
            p.guardada_por.remove(request.user)
            guardada = False
        else:
            p.guardada_por.add(request.user)
            guardada = True
        return Response({"guardada": guardada, "guardados": p.guardada_por.count()})

    @action(detail=True, methods=["post"])
    def cocinada(self, request, pk=None):
        """«La cociné»: alterna y regresa cuántas personas la han cocinado."""
        p = self.get_object()
        if p.cocinada_por.filter(id=request.user.id).exists():
            p.cocinada_por.remove(request.user)
            hecho = False
        else:
            p.cocinada_por.add(request.user)
            hecho = True
        return Response({"cocinada": hecho, "cocinadas": p.cocinada_por.count()})

    @action(detail=True, methods=["post"])
    def reportar(self, request, pk=None):
        """Avisar que una receta es inapropiada o spam. Con 3 reportes deja de salir en Comunidad."""
        p = self.get_object()
        if p.autor_id == request.user.id:
            return Response({"detail": "No puedes reportar tu propia receta."}, status=status.HTTP_400_BAD_REQUEST)
        Platillo.objects.filter(id=p.id).update(reportes=p.reportes + 1)
        return Response({"ok": True})

    @action(detail=False, methods=["get"], url_path=r"codigo/(?P<codigo>[\w-]+)")
    def por_codigo(self, request, codigo=None):
        """Abrir una receta compartida con su enlace (aunque sea privada)."""
        p = Platillo.objects.filter(codigo=codigo).first()
        if not p:
            return Response({"detail": "Esa receta ya no existe."}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(p).data)
