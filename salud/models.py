"""Meta de salud: datos sensibles (peso, estatura, edad), separados del perfil para poder borrarlos de un jalón."""
from django.conf import settings
from django.db import models

SEXOS = [("m", "Mujer"), ("h", "Hombre")]
DIAS_TIPICOS = [
    ("sentado", "Casi todo el día sentado (oficina, escuela, compu)"),
    ("de_pie", "De pie o caminando buena parte del día"),
    ("fisico", "Trabajo físico pesado (cargar, construir, repartir)"),
]
DIAS_EJERCICIO = [("0", "No hago ejercicio"), ("1_2", "1 o 2 días"), ("3_4", "3 o 4 días"), ("5_mas", "5 días o más")]
DURACION = [("corto", "Menos de 30 minutos"), ("medio", "De 30 a 60 minutos"), ("largo", "Más de una hora")]
METAS = [("bajar", "Bajar de peso"), ("mantener", "Mantenerme"), ("subir", "Subir de peso / masa muscular")]
RITMOS = [("tranquilo", "Tranquilo (¼ kg por semana)"), ("normal", "Normal (½ kg por semana)")]


class PerfilSalud(models.Model):
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="salud")
    consentimiento = models.DateTimeField(help_text="Cuándo aceptó que guardemos sus datos de salud")
    fecha_nacimiento = models.DateField()
    sexo = models.CharField(max_length=1, choices=SEXOS, help_text="Sexo biológico: cambia el cálculo de calorías")
    estatura_cm = models.DecimalField(max_digits=4, decimal_places=1)
    dia_tipico = models.CharField(max_length=10, choices=DIAS_TIPICOS, default="sentado")
    dias_ejercicio = models.CharField(max_length=5, choices=DIAS_EJERCICIO, default="0")
    duracion_ejercicio = models.CharField(max_length=5, choices=DURACION, default="medio")
    meta = models.CharField(max_length=10, choices=METAS, default="mantener")
    ritmo = models.CharField(max_length=10, choices=RITMOS, default="tranquilo")
    peso_meta_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True,
                                       help_text="Vacío = el que sugiere la app")
    embarazo = models.BooleanField(default=False, help_text="Embarazo o lactancia: no se calcula déficit")
    condicion_medica = models.BooleanField(default=False, help_text="Diabetes, riñón, corazón u otra: se recomienda médico")
    actualizado = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Salud de {self.usuario}"


class RegistroPeso(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="pesos")
    fecha = models.DateField()
    peso_kg = models.DecimalField(max_digits=5, decimal_places=1)

    class Meta:
        unique_together = ("usuario", "fecha")
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.usuario} {self.fecha}: {self.peso_kg} kg"
