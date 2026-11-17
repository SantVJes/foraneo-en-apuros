from decimal import Decimal

from django.conf import settings
from django.db import models

from .unidades import UNIDADES_BASE

DESAYUNO, COMIDA, CENA = "desayuno", "comida", "cena"
TIPOS_COMIDA = [(DESAYUNO, "Desayuno"), (COMIDA, "Comida"), (CENA, "Cena")]

FACIL, INTERMEDIO, COMPLICADO = "facil", "intermedio", "complicado"
DIFICULTADES = [(FACIL, "Fácil"), (INTERMEDIO, "Intermedio"), (COMPLICADO, "Complicado")]


# Alergias y restricciones que el usuario puede marcar; cada ingrediente dice cuáles tiene.
RESTRICCIONES = [
    ("gluten", "Gluten"),
    ("lacteos", "Lácteos"),
    ("huevo", "Huevo"),
    ("pescado", "Pescado"),
    ("mariscos", "Mariscos"),
    ("cacahuate", "Cacahuate"),
    ("nueces", "Nueces"),
    ("soya", "Soya"),
    ("carne", "Carne (vegetariano)"),
    ("cerdo", "Cerdo"),
    ("picante", "Picante"),
]


class Ingrediente(models.Model):
    """Un producto que se compra en el súper (arroz, aceite, huevo...)."""

    nombre = models.CharField(max_length=120, unique=True)
    categoria = models.CharField(max_length=60, blank=True, help_text="Abarrotes, lácteos, verdura...")
    unidad_base = models.CharField(max_length=10, choices=UNIDADES_BASE)
    tamano_paquete = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Cuánto trae la presentación típica, en la unidad base (ej. aceite 900 ml)",
    )
    nombre_paquete = models.CharField(max_length=40, default="paquete", help_text="botella, bolsa, caja...")
    restricciones = models.JSONField(default=list, blank=True, help_text='Ej. ["lacteos"] o ["gluten"]')
    es_basico = models.BooleanField(
        default=False, help_text="Básico de cocina que casi siempre hay en casa (sal, aceite, pimienta)"
    )
    # Nutrición por 100 g / 100 ml, o por pieza si la unidad base es pieza (valores aproximados)
    kcal = models.DecimalField(max_digits=7, decimal_places=1, default=0)
    proteina = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    carbohidratos = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    grasa = models.DecimalField(max_digits=6, decimal_places=1, default=0)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Platillo(models.Model):
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True)
    tipo_comida = models.CharField(max_length=10, choices=TIPOS_COMIDA)
    dificultad = models.CharField(max_length=12, choices=DIFICULTADES)
    estilo = models.CharField(max_length=60, blank=True, help_text="Mexicana, italiana, saludable...")
    tiempo_minutos = models.PositiveIntegerField(default=30)
    porciones = models.PositiveSmallIntegerField(default=2, help_text="Para cuántas personas rinde la receta")
    pasos = models.TextField(blank=True)
    imagen_url = models.URLField(blank=True)
    fuente = models.CharField(max_length=20, default="propio", help_text="propio o el nombre de la API de recetas")
    id_externo = models.CharField(max_length=40, blank=True)
    # Recetas que escribe la gente. Las del catálogo no tienen autor.
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="recetas")
    publica = models.BooleanField(default=False, help_text="Se ve en Comunidad y la puede guardar cualquiera")
    codigo = models.CharField(max_length=12, unique=True, null=True, blank=True, help_text="Para compartir con un enlace")
    guardada_por = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="recetas_guardadas")
    cocinada_por = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="recetas_cocinadas",
                                          help_text="Quién dijo «La cociné»")
    reportes = models.PositiveSmallIntegerField(default=0, help_text="Con 3 reportes se esconde de Comunidad")
    creado = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        ordering = ["nombre"]
        constraints = [models.UniqueConstraint(fields=["nombre"], condition=models.Q(autor__isnull=True), name="platillo_catalogo_nombre_unico")]

    def __str__(self):
        return self.nombre


OCULTAR_CON_REPORTES = 3


def platillos_visibles(usuario):
    """Catálogo + recetas públicas sin reportes + las tuyas (aunque sean privadas)."""
    q = models.Q(autor__isnull=True) | models.Q(publica=True, reportes__lt=OCULTAR_CON_REPORTES)
    if usuario is not None and usuario.is_authenticated:
        q |= models.Q(autor=usuario)
    return Platillo.objects.filter(q)


def platillos_para_planear(usuario):
    """Lo que puede salir en tu semana: catálogo, tus recetas y las que guardaste."""
    return Platillo.objects.filter(models.Q(autor__isnull=True) | models.Q(autor=usuario) | models.Q(guardada_por=usuario)).distinct()


class PlatilloIngrediente(models.Model):
    platillo = models.ForeignKey(Platillo, on_delete=models.CASCADE, related_name="ingredientes")
    ingrediente = models.ForeignKey(Ingrediente, on_delete=models.PROTECT, related_name="en_platillos")
    cantidad = models.DecimalField(
        max_digits=10, decimal_places=2, help_text="En la unidad base del ingrediente, para las porciones del platillo"
    )

    class Meta:
        unique_together = ("platillo", "ingrediente")

    def __str__(self):
        return f"{self.cantidad} {self.ingrediente.unidad_base} {self.ingrediente}"


class Supermercado(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    sitio_web = models.URLField(blank=True)
    activo = models.BooleanField(default=True)
    requiere_membresia = models.BooleanField(default=False, help_text="Costco, Sam's Club...")
    nombres_mapa = models.JSONField(
        default=list, blank=True,
        help_text="Cómo aparece en OpenStreetMap, para encontrar sucursales cercanas. Ej. [\"Bodega Aurrera\"]",
    )
    color = models.CharField(max_length=7, default="#2b6cb0", help_text="Color para la app")
    url_busqueda = models.CharField(
        max_length=255, blank=True,
        help_text="Búsqueda en la tienda en línea, con {q} donde va el producto. Ej. https://super.walmart.com.mx/search?q={q}",
    )
    plantilla_afiliado = models.CharField(
        max_length=500, blank=True,
        help_text="Tu link de afiliado, con {url} donde va la página de la tienda. Vacío = link normal",
    )

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Sucursal(models.Model):
    supermercado = models.ForeignKey(Supermercado, on_delete=models.CASCADE, related_name="sucursales")
    nombre = models.CharField(max_length=150)
    direccion = models.CharField(max_length=255, blank=True)
    lat = models.FloatField()
    lng = models.FloatField()
    osm_id = models.CharField(max_length=40, blank=True, null=True, unique=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "sucursales"

    def __str__(self):
        return self.nombre


class Precio(models.Model):
    """Precio de una presentación de un ingrediente en un supermercado."""

    supermercado = models.ForeignKey(Supermercado, on_delete=models.CASCADE, related_name="precios")
    ingrediente = models.ForeignKey(Ingrediente, on_delete=models.CASCADE, related_name="precios")
    producto = models.CharField(max_length=150, help_text="Nombre como aparece en la tienda")
    presentacion = models.DecimalField(max_digits=10, decimal_places=2, help_text="Contenido en la unidad base")
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    precio_regular = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, help_text="Si está en oferta: el precio de antes"
    )
    url = models.URLField(blank=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["ingrediente__nombre", "precio"]

    @property
    def en_oferta(self):
        return self.precio_regular is not None and self.precio_regular > self.precio

    @property
    def precio_por_unidad(self):
        return (self.precio / self.presentacion).quantize(Decimal("0.0001"))

    def __str__(self):
        return f"{self.producto} @ {self.supermercado}: ${self.precio}"
