"""Cobro del Plan Pro con Stripe.

- Mensual: suscripción con tarjeta que se renueva sola.
- Anual: un solo pago con tarjeta u OXXO que da 365 días de Pro.
Stripe avisa por webhook cuando se paga, y ahí se activa el Pro.
"""
import datetime
from decimal import Decimal

import stripe
from django.conf import settings
from django.utils import timezone

from cuentas.models import Usuario

from .models import Pago


class PagosNoConfigurados(Exception):
    pass


def configurados():
    return bool(settings.STRIPE_SECRET_KEY and settings.STRIPE_PRECIO_MENSUAL and settings.STRIPE_PRECIO_ANUAL)


def _cliente():
    if not configurados():
        raise PagosNoConfigurados("Los pagos todavía no están configurados en el servidor.")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def crear_checkout(usuario, plan):
    s = _cliente()
    if not usuario.stripe_customer_id:
        cliente = s.Customer.create(email=usuario.email, metadata={"usuario_id": usuario.id})
        usuario.stripe_customer_id = cliente["id"]
        usuario.save(update_fields=["stripe_customer_id"])
    comun = {
        "customer": usuario.stripe_customer_id,
        "client_reference_id": str(usuario.id),
        "metadata": {"usuario_id": usuario.id, "plan": plan},
        "success_url": f"{settings.APP_URL}/#pro",
        "cancel_url": f"{settings.APP_URL}/#pro",
        "locale": "es",
    }
    if plan == "mensual":
        sesion = s.checkout.Session.create(
            mode="subscription", line_items=[{"price": settings.STRIPE_PRECIO_MENSUAL, "quantity": 1}],
            subscription_data={"metadata": {"usuario_id": usuario.id}}, **comun,
        )
    else:
        sesion = s.checkout.Session.create(
            mode="payment", line_items=[{"price": settings.STRIPE_PRECIO_ANUAL, "quantity": 1}],
            payment_method_types=["card", "oxxo"], **comun,
        )
    return sesion["url"]


def crear_portal(usuario):
    s = _cliente()
    if not usuario.stripe_customer_id:
        return None
    return s.billing_portal.Session.create(customer=usuario.stripe_customer_id, return_url=f"{settings.APP_URL}/#pro")["url"]


def extender_pro(usuario, hasta=None, dias=None):
    ahora = timezone.now()
    if dias:
        inicio = max(ahora, usuario.pro_hasta or ahora)
        hasta = inicio + datetime.timedelta(days=dias)
    if hasta and (usuario.pro_hasta is None or hasta > usuario.pro_hasta):
        usuario.pro_hasta = hasta
        usuario.save(update_fields=["pro_hasta"])


def _registrar_pago(usuario, plan, centavos, referencia):
    _, nuevo = Pago.objects.get_or_create(
        referencia=referencia, defaults={"usuario": usuario, "plan": plan, "monto": Decimal(centavos or 0) / 100}
    )
    return nuevo


def procesar_evento(evento):
    """Activa o renueva el Pro según el aviso de Stripe. Regresa True si hizo algo."""
    tipo = evento["type"]
    obj = evento["data"]["object"]

    if tipo in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        usuario = Usuario.objects.filter(id=(obj.get("metadata") or {}).get("usuario_id")).first()
        if usuario is None:
            return False
        if obj.get("mode") == "payment":
            # Con OXXO el pago llega después (async_payment_succeeded); solo se activa ya pagado
            if obj.get("payment_status") != "paid":
                return False
            if _registrar_pago(usuario, "anual", obj.get("amount_total"), obj["id"]):
                extender_pro(usuario, dias=365)
            return True
        # Suscripción mensual: se activa ya (sin sumar si invoice.paid llegó antes);
        # las renovaciones llegan con invoice.paid
        extender_pro(usuario, hasta=timezone.now() + datetime.timedelta(days=32))
        return True

    if tipo == "invoice.paid":
        usuario = Usuario.objects.filter(stripe_customer_id=obj.get("customer")).first()
        if usuario is None:
            return False
        lineas = (obj.get("lines") or {}).get("data") or []
        fin = lineas[0]["period"]["end"] if lineas else None
        _registrar_pago(usuario, "mensual", obj.get("amount_paid"), obj["id"])
        if fin:
            hasta = datetime.datetime.fromtimestamp(fin, tz=datetime.timezone.utc) + datetime.timedelta(days=1)
            extender_pro(usuario, hasta=hasta)
        else:
            extender_pro(usuario, dias=32)
        return True
    return False
