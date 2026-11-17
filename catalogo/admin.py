from django.contrib import admin

from .models import Ingrediente, Platillo, PlatilloIngrediente, Precio, Supermercado


class PlatilloIngredienteInline(admin.TabularInline):
    model = PlatilloIngrediente
    extra = 1


@admin.register(Platillo)
class PlatilloAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo_comida", "dificultad", "estilo", "tiempo_minutos")
    list_filter = ("tipo_comida", "dificultad", "estilo")
    search_fields = ("nombre",)
    inlines = [PlatilloIngredienteInline]


@admin.register(Ingrediente)
class IngredienteAdmin(admin.ModelAdmin):
    list_display = ("nombre", "categoria", "unidad_base", "tamano_paquete", "nombre_paquete")
    search_fields = ("nombre",)


@admin.register(Precio)
class PrecioAdmin(admin.ModelAdmin):
    list_display = ("ingrediente", "supermercado", "producto", "presentacion", "precio", "precio_regular", "actualizado")
    list_filter = ("supermercado",)
    search_fields = ("ingrediente__nombre", "producto")


@admin.register(Supermercado)
class SupermercadoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "requiere_membresia", "activo", "tiene_afiliado")
    fieldsets = (
        (None, {"fields": ("nombre", "sitio_web", "requiere_membresia", "activo", "nombres_mapa", "color")}),
        ("Links de compra y afiliados", {
            "fields": ("url_busqueda", "plantilla_afiliado"),
            "description": "url_busqueda: buscador de la tienda con {q}, por ejemplo https://super.walmart.com.mx/search?q={q}. "
                           "plantilla_afiliado: el link que te da tu red de afiliados con {url} donde va la página "
                           "de la tienda, por ejemplo https://www.awin1.com/cread.php?awinmid=123&awinaffid=456&ued={url}.",
        }),
    )

    @admin.display(boolean=True, description="Afiliado")
    def tiene_afiliado(self, obj):
        return bool(obj.plantilla_afiliado)
