import stripe
from django.conf import settings
from django.http import HttpResponseBadRequest, HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalogo.models import Supermercado
from despensa.models import PlanSemanal

from . import afiliados, pagos, servicios
from .models import ClicAfiliado

BENEFICIOS = [
    "Guarda todas las semanas que quieras (gratis: hasta 5)",
    "Alertas de ofertas en los súper que tienes cerca",
    "Plan de nutrición: calorías y proteína de cada día",
]


def requiere_pro(request):
    if not settings.PRO_ACTIVO:
        return Response({"detail": "No disponible."}, status=status.HTTP_404_NOT_FOUND)
    if request.user.es_pro:
        return None
    return Response({"detail": "Esta función es del Plan Pro.", "codigo": "requiere_pro"},
                    status=status.HTTP_403_FORBIDDEN)


class EstadoProView(APIView):
    @extend_schema(summary="Estado del Plan Pro y precios")
    def get(self, request):
        u = request.user
        if not settings.PRO_ACTIVO:
            return Response({"detail": "No disponible."}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            "es_pro": u.es_pro, "pro_hasta": u.pro_hasta,
            "precios": {"mensual": settings.PRO_PRECIO_MENSUAL, "anual": settings.PRO_PRECIO_ANUAL},
            "planes_gratis": settings.PLANES_GRATIS,
            "planes_guardados": PlanSemanal.objects.filter(usuario=u).count(),
            "pagos_configurados": pagos.configurados(),
            "puede_administrar": bool(u.stripe_customer_id) and pagos.configurados(),
            "beneficios": BENEFICIOS,
        })


class CheckoutView(APIView):
    @extend_schema(summary="Ir a pagar el Plan Pro", request={"application/json": {"type": "object",
                   "properties": {"plan": {"type": "string", "enum": ["mensual", "anual"]}}}})
    def post(self, request):
        if not settings.PRO_ACTIVO:
            return Response({"detail": "No disponible."}, status=status.HTTP_404_NOT_FOUND)
        plan = request.data.get("plan")
        if plan not in ("mensual", "anual"):
            return Response({"plan": "Elige mensual o anual."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response({"url": pagos.crear_checkout(request.user, plan)})
        except pagos.PagosNoConfigurados as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe.StripeError:
            return Response({"detail": "No pudimos abrir el pago. Intenta otra vez en un momento."},
                            status=status.HTTP_502_BAD_GATEWAY)


class PortalView(APIView):
    @extend_schema(summary="Administrar o cancelar la suscripción")
    def post(self, request):
        try:
            url = pagos.crear_portal(request.user)
        except pagos.PagosNoConfigurados as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not url:
            return Response({"detail": "No tienes una suscripción para administrar."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"url": url})


@method_decorator(csrf_exempt, name="dispatch")
class WebhookStripeView(APIView):
    """Stripe llama aquí cuando alguien paga. Configúralo en Stripe > Desarrolladores > Webhooks."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(exclude=True)
    def post(self, request):
        if not settings.STRIPE_WEBHOOK_SECRET:
            return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            evento = stripe.Webhook.construct_event(
                request.body, request.headers.get("Stripe-Signature", ""), settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.SignatureVerificationError):
            return HttpResponseBadRequest("firma inválida")
        pagos.procesar_evento(evento)
        return Response({"ok": True})


class IrView(APIView):
    """Abre la tienda en línea con el link de afiliado y cuenta el clic."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "ir"

    @extend_schema(exclude=True)
    def get(self, request, token):
        datos = afiliados.leer_token(token)
        if not datos:
            return HttpResponseBadRequest("Link inválido o vencido.")
        texto = str(datos.get("q", ""))[:150]
        if datos.get("s") == afiliados.AMAZON:
            if not settings.AMAZON_AFILIADOS_TAG:
                return HttpResponseBadRequest("Link no disponible.")
            tienda, destino = "Amazon", afiliados.destino_amazon(texto)
        else:
            sup = Supermercado.objects.filter(id=datos.get("s")).first()
            if sup is None:
                return HttpResponseBadRequest("Tienda no encontrada.")
            tienda, destino = sup.nombre, afiliados.destino_tienda(sup, texto)
        ClicAfiliado.objects.create(usuario_id=datos.get("u"), tienda=tienda, producto=texto, destino=destino[:800])
        return HttpResponseRedirect(destino)


class OfertasView(APIView):
    @extend_schema(summary="Ofertas en súper cerca de ti (Pro)")
    def get(self, request):
        bloqueo = requiere_pro(request)
        if bloqueo:
            return bloqueo
        plan = PlanSemanal.objects.filter(usuario=request.user).first()
        return Response(servicios.ofertas_cerca(request.user, plan))


class NutricionView(APIView):
    @extend_schema(summary="Calorías y macros de tu semana (gratis con meta de salud)")
    def get(self, request, pk):
        # Quien tiene meta de salud ve sus calorías gratis; sin meta, es del Plan Pro (si está encendido)
        from despensa.servicios import tiene_meta_salud

        libre = not settings.PRO_ACTIVO or tiene_meta_salud(request.user)
        bloqueo = None if libre else requiere_pro(request)
        if bloqueo:
            return bloqueo
        plan = PlanSemanal.objects.filter(usuario=request.user, pk=pk).first()
        if plan is None:
            return Response({"detail": "No encontrado."}, status=status.HTTP_404_NOT_FOUND)
        return Response(servicios.nutricion_plan(plan))
