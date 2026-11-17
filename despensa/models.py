from decimal import Decimal

from django.conf import settings
from django.db import models

from catalogo.models import TIPOS_COMIDA, Ingrediente, Platillo
from catalogo.unidades import FRACCIONES, FRACCIONES_CHOICES, UNIDADES, a_unidad_base

DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


class ArticuloAlacena(models.Model):
    """Lo que el usuario ya tiene en casa.

    Se puede anotar de forma exacta (750 ml de aceite, 1 kg de arroz) o aproximada
    (la mitad de la botella de aceite, un cuarto de la bolsa de arroz).
    """

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="alacena")
    ingrediente = models.ForeignKey(Ingrediente, on_delete=models.CASCADE)
    cantidad = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("1"),
        help_text="Número en la unidad elegida. Con fracción, es cuántos paquetes (normalmente 1).",
    )
    unidad = models.CharField(max_length=10, choices=UNIDADES, default="paquete")
    fraccion = models.CharField(
        max_length=15, choices=FRACCIONES_CHOICES, blank=True, default="",
        help_text="Opcional: cuánto queda del paquete (mitad, un cuarto...)",
    )
    cantidad_base = models.DecimalField(
        max_digits=12, decimal_places=2, editable=False, default=Decimal("0"),
        help_text="Cantidad real en la unidad base del ingrediente (g, ml o piezas)",
    )
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("usuario", "ingrediente")
        ordering = ["ingrediente__nombre"]

    def calcular_cantidad_base(self):
        if self.fraccion:
            # "la mitad" de N paquetes (si no dice otra cosa, de 1 paquete)
            paquetes = self.cantidad if self.unidad == "paquete" else Decimal("1")
            return paquetes * self.ingrediente.tamano_paquete * FRACCIONES[self.fraccion]
        return a_unidad_base(self.cantidad, self.unidad, self.ingrediente)

    def save(self, *args, **kwargs):
        self.cantidad_base = self.calcular_cantidad_base().quantize(Decimal("0.01"))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ingrediente}: {self.cantidad_base} {self.ingrediente.unidad_base}"


class PlanSemanal(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="planes")
    nombre = models.CharField(max_length=100, blank=True)
    fecha_inicio = models.DateField()
    presupuesto = models.DecimalField(max_digits=10, decimal_places=2)
    personas = models.PositiveSmallIntegerField(default=1)
    comidas = models.JSONField(default=list, help_text='Qué comidas planear, ej. ["comida", "cena"]')
    dificultades = models.JSONField(default=list, help_text='Dificultades permitidas, ej. ["facil"]. Vacío = todas')
    comidas_por_dia = models.JSONField(default=dict, blank=True,
                                       help_text='Comidas que sí hace cada día, ej. {"0": ["cena"]}. Falta un día = todas')
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha_inicio", "-creado"]

    def comidas_del_dia(self, dia):
        """Las comidas del plan que sí se hacen ese día (0 = lunes)."""
        permitidas = self.comidas_por_dia.get(str(dia))
        return [t for t in self.comidas if permitidas is None or t in permitidas]

    def __str__(self):
        return self.nombre or f"Semana del {self.fecha_inicio}"


class ComidaPlanificada(models.Model):
    plan = models.ForeignKey(PlanSemanal, on_delete=models.CASCADE, related_name="comidas_planificadas")
    dia = models.PositiveSmallIntegerField(help_text="0 = lunes ... 6 = domingo")
    tipo_comida = models.CharField(max_length=10, choices=TIPOS_COMIDA)
    platillo = models.ForeignKey(Platillo, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ("plan", "dia", "tipo_comida")
        ordering = ["dia", "tipo_comida"]

    @property
    def nombre_dia(self):
        return DIAS[self.dia]


class Sustitucion(models.Model):
    """Cambia un ingrediente por otro en todas las recetas del usuario.
    Ej. Aceite -> Aceite de oliva, Leche -> Leche deslactosada."""

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sustituciones")
    original = models.ForeignKey(Ingrediente, on_delete=models.CASCADE, related_name="+")
    reemplazo = models.ForeignKey(Ingrediente, on_delete=models.CASCADE, related_name="+")

    class Meta:
        unique_together = ("usuario", "original")

    def __str__(self):
        return f"{self.original} -> {self.reemplazo}"
