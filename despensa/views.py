from django.conf import settings
from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import servicios
from .models import ArticuloAlacena, ComidaPlanificada, PlanSemanal
from .servicios import ORDEN_COMIDAS
from .serializers import (
    ArticuloAlacenaSerializer,
    CambiarPlatilloSerializer,
    GenerarSerializer,
    PlanSemanalSerializer,
)


class AlacenaViewSet(viewsets.ModelViewSet):
    """Lo que ya tienes en casa. Ejemplos:

    - Exacto: `{"ingrediente_id": 1, "cantidad": 1, "unidad": "kg"}`
    - Aproximado: `{"ingrediente_id": 2, "fraccion": "mitad"}` (media botella de aceite)
    """

    serializer_class = ArticuloAlacenaSerializer
    search_fields = ["ingrediente__nombre"]
    pagination_class = None

    def get_queryset(self):
        return ArticuloAlacena.objects.filter(usuario=self.request.user).select_related("ingrediente")

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class PlanSemanalViewSet(viewsets.ModelViewSet):
    serializer_class = PlanSemanalSerializer

    def get_queryset(self):
        return PlanSemanal.objects.filter(usuario=self.request.user).prefetch_related(
            "comidas_planificadas__platillo"
        )

    def create(self, request, *args, **kwargs):
        limite = settings.PLANES_GRATIS
        if settings.PRO_ACTIVO and not request.user.es_pro and self.get_queryset().count() >= limite:
            return Response(
                {"detail": f"Con la cuenta gratis guardas hasta {limite} semanas. Borra una o pásate a Pro.",
                 "codigo": "limite_planes"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def perform_create(self, serializer):
        plan = serializer.save()
        if serializer.validated_data.get("generar", True):
            servicios.generar_plan(plan, serializer.validated_data.get("ajustar_presupuesto", True))

    @extend_schema(request=GenerarSerializer, summary="Volver a generar la semana con otros platillos")
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def generar(self, request, pk=None):
        plan = self.get_object()
        ser = GenerarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        servicios.generar_plan(plan, ser.validated_data["ajustar_presupuesto"])
        return Response(self.get_serializer(self.get_queryset().get(pk=plan.pk)).data)

    @extend_schema(request=CambiarPlatilloSerializer,
                   summary="Elegir el platillo de un día y comida (platillo_id null = ese día no la hago)")
    @action(detail=True, methods=["post"], url_path="cambiar-platillo")
    def cambiar_platillo(self, request, pk=None):
        plan = self.get_object()
        ser = CambiarPlatilloSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        platillo = d["platillo_id"]
        if platillo is not None and platillo.tipo_comida != d["tipo_comida"]:
            return Response(
                {"platillo_id": f"{platillo} es de {platillo.tipo_comida}, no de {d['tipo_comida']}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dia, tipo = d["dia"], d["tipo_comida"]
        if tipo not in plan.comidas:
            # Una comida que la semana no tenía: solo se agrega ese día
            for otro in range(7):
                plan.comidas_por_dia[str(otro)] = plan.comidas_del_dia(otro)
            plan.comidas = [t for t in ORDEN_COMIDAS if t in plan.comidas + [tipo]]
        hoy = plan.comidas_del_dia(dia)
        if platillo is None:
            # "Ese día no como aquí" (evento, comedor del trabajo...): sale del menú y de la lista
            plan.comidas_por_dia[str(dia)] = [t for t in hoy if t != tipo]
            ComidaPlanificada.objects.filter(plan=plan, dia=dia, tipo_comida=tipo).delete()
        else:
            plan.comidas_por_dia[str(dia)] = [t for t in ORDEN_COMIDAS if t in hoy + [tipo]]
            ComidaPlanificada.objects.update_or_create(
                plan=plan, dia=dia, tipo_comida=tipo, defaults={"platillo": platillo}
            )
        plan.save(update_fields=["comidas", "comidas_por_dia"])
        return Response(self.get_serializer(self.get_queryset().get(pk=plan.pk)).data)

    @extend_schema(
        parameters=[
            OpenApiParameter("modo", str, enum=["varios", "un_super"],
                             description="varios = lo más barato en cada súper; un_super = todo en uno"),
            OpenApiParameter("supermercado", int, description="Con modo=un_super, el súper que quieres"),
        ],
        responses=OpenApiResponse(description="Lista de compras con el súper más barato por producto"),
        summary="Lista de compras de la semana",
    )
    @action(detail=True, url_path="lista-compras")
    def lista_compras(self, request, pk=None):
        modo = request.query_params.get("modo")
        if modo not in (None, servicios.VARIOS, servicios.UN_SUPER):
            return Response({"modo": "Usa varios o un_super."}, status=status.HTTP_400_BAD_REQUEST)
        sup = request.query_params.get("supermercado")
        if sup is not None and not sup.isdigit():
            return Response({"supermercado": "Debe ser un número."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(servicios.lista_de_compras(self.get_object(), modo=modo, supermercado_id=sup))
