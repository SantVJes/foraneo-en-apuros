from django.contrib import admin

from .models import ArticuloAlacena, ComidaPlanificada, PlanSemanal


class ComidaInline(admin.TabularInline):
    model = ComidaPlanificada
    extra = 0


@admin.register(PlanSemanal)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("__str__", "usuario", "fecha_inicio", "presupuesto", "personas")
    inlines = [ComidaInline]


@admin.register(ArticuloAlacena)
class AlacenaAdmin(admin.ModelAdmin):
    list_display = ("usuario", "ingrediente", "cantidad", "unidad", "fraccion", "cantidad_base")
    list_filter = ("usuario",)
