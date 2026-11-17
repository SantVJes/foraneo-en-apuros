from decimal import Decimal

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("El correo es obligatorio")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra)


class Usuario(AbstractUser):
    """Usuario que inicia sesión con correo (y contraseña o Google)."""

    username = None
    email = models.EmailField("correo", unique=True)
    google_sub = models.CharField(max_length=255, blank=True, null=True, unique=True)
    supabase_uid = models.UUIDField(blank=True, null=True, unique=True, help_text="Id del usuario en Supabase Auth")

    # Preferencias para la despensa
    presupuesto_semanal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    personas = models.PositiveSmallIntegerField(default=1, help_text="Para cuántas personas cocina")

    # Ubicación para buscar supermercados cercanos
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    radio_km = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("5"),
                                   help_text="Hasta qué distancia buscar supermercados")
    modo_compra = models.CharField(
        max_length=10, default="varios",
        choices=[("un_super", "Todo en un solo súper"), ("varios", "Lo más barato en varios súper")],
    )
    membresias = models.ManyToManyField("catalogo.Supermercado", blank=True, related_name="miembros",
                                        help_text="Súper con membresía que sí tiene (Costco, Sam's)")

    # Alergias y gustos
    restricciones = models.JSONField(default=list, blank=True, help_text='Alergias o dieta, ej. ["lacteos", "carne"]')
    ingredientes_excluidos = models.ManyToManyField("catalogo.Ingrediente", blank=True, related_name="+",
                                                    help_text="Ingredientes que no come")

    # Qué comidas hace cada día: {"0": ["desayuno", "cena"], ...} (0 = lunes). Vacío = todas.
    # Ej. si en el trabajo le dan de comer entre semana, de lunes a viernes no lleva "comida".
    rutina_comidas = models.JSONField(default=dict, blank=True)

    # Plan Pro
    pro_hasta = models.DateTimeField(null=True, blank=True, help_text="Hasta cuándo tiene Pro")
    stripe_customer_id = models.CharField(max_length=60, blank=True)

    # Nutrición
    meta_kcal = models.PositiveIntegerField(default=2000, help_text="Calorías al día que quiere comer")
    objetivo = models.CharField(
        max_length=10, default="mantener",
        choices=[("bajar", "Bajar de peso"), ("mantener", "Mantenerme"), ("subir", "Subir masa muscular")],
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UsuarioManager()

    @property
    def es_pro(self):
        from django.utils import timezone

        return self.pro_hasta is not None and self.pro_hasta > timezone.now()

    def __str__(self):
        return self.email
