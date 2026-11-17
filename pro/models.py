from django.conf import settings
from django.db import models


class ClicAfiliado(models.Model):
    """Cada vez que alguien abre un link de compra desde la lista (para medir comisiones)."""

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    tienda = models.CharField(max_length=80)
    producto = models.CharField(max_length=150)
    destino = models.URLField(max_length=800)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado"]
        verbose_name = "clic de afiliado"
        verbose_name_plural = "clics de afiliado"


class Pago(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pagos")
    plan = models.CharField(max_length=10, choices=[("mensual", "Mensual"), ("anual", "Anual")])
    monto = models.DecimalField(max_digits=8, decimal_places=2)
    referencia = models.CharField(max_length=120, unique=True, help_text="Id del pago en Stripe")
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado"]
