from django.contrib import admin

from .models import ClicAfiliado, Pago


@admin.register(ClicAfiliado)
class ClicAfiliadoAdmin(admin.ModelAdmin):
    list_display = ("creado", "tienda", "producto", "usuario")
    list_filter = ("tienda",)
    date_hierarchy = "creado"


@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ("creado", "usuario", "plan", "monto", "referencia")
    list_filter = ("plan",)
