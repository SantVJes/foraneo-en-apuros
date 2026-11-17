"""Carga ingredientes, platillos, supermercados y precios de ejemplo.

Los precios son de EJEMPLO (aproximados, en pesos mexicanos) para poder probar la API.
Se pueden actualizar desde el admin o reemplazar con otra fuente de precios.
Es seguro correrlo varias veces.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from catalogo.datos_demo import (CON_PIMIENTA, INGREDIENTES, NUTRICION, PLATILLOS, SIN_SAL, SUPERMERCADOS,
                                 URL_BUSQUEDA, VARIACION)
from catalogo.models import Ingrediente, Platillo, PlatilloIngrediente, Precio, Supermercado

# Lo que se cuece con grasa lleva aceite aunque la receta original no lo diga
GRASAS = {"Aceite", "Aceite de oliva", "Mantequilla"}
PERECEDEROS = {"Frutas y verduras", "Carnes", "Pescados y mariscos", "Tortillería", "Panadería"}


def con_basicos(nombre, porciones, items):
    """Agrega sal, pimienta y aceite a las recetas que los usan."""
    items = dict(items)
    if nombre not in SIN_SAL:
        items.setdefault("Sal", 3 * porciones)
    if any(i in items for i in CON_PIMIENTA):
        items.setdefault("Pimienta", 1 * porciones)
    if "Cebolla" in items and not GRASAS & items.keys():
        items["Aceite"] = 15
    return items


def presentacion_legible(cantidad, unidad):
    if unidad == "g" and cantidad >= 1000:
        return f"{(cantidad / 1000).normalize():f} kg"
    if unidad == "ml" and cantidad >= 1000:
        return f"{(cantidad / 1000).normalize():f} L"
    if unidad == "pieza":
        return f"{cantidad.normalize():f} pz"
    return f"{cantidad.normalize():f} {unidad}"


def redondear(valor):
    return (Decimal(str(valor)) * 2).quantize(Decimal("1")) / 2


class Command(BaseCommand):
    help = "Carga ingredientes, platillos, supermercados y precios de ejemplo."

    def add_arguments(self, parser):
        parser.add_argument("--si-vacio", action="store_true",
                            help="Solo carga si todavía no hay supermercados (para arrancar más rápido).")

    @transaction.atomic
    def handle(self, *args, **options):
        if options.get("si_vacio") and Supermercado.objects.exists():
            if options["verbosity"]:
                self.stdout.write("Ya hay datos; no se recargan.")
            return
        ingredientes = {}
        for nombre, (cat, unidad, tam, paquete, _, restr, basico) in INGREDIENTES.items():
            ingredientes[nombre], _ = Ingrediente.objects.update_or_create(
                nombre=nombre,
                defaults={"categoria": cat, "unidad_base": unidad, "tamano_paquete": Decimal(tam),
                          "nombre_paquete": paquete, "restricciones": restr, "es_basico": basico,
                          **dict(zip(("kcal", "proteina", "carbohidratos", "grasa"),
                                     (Decimal(str(v)) for v in NUTRICION.get(nombre, (0, 0, 0, 0)))))},
            )

        for nombre, tipo, dif, estilo, minutos, porciones, desc, pasos, items in PLATILLOS:
            platillo, _ = Platillo.objects.update_or_create(
                nombre=nombre,
                defaults={"tipo_comida": tipo, "dificultad": dif, "estilo": estilo, "tiempo_minutos": minutos,
                          "porciones": porciones, "descripcion": desc, "pasos": pasos, "fuente": "propio"},
            )
            for ing, cant in con_basicos(nombre, porciones, items).items():
                PlatilloIngrediente.objects.update_or_create(
                    platillo=platillo, ingrediente=ingredientes[ing], defaults={"cantidad": Decimal(str(cant))}
                )

        for n, (nombre_super, datos) in enumerate(SUPERMERCADOS.items()):
            web, membresia, nombres_mapa, color, factor, mult, categorias = datos
            sup, _ = Supermercado.objects.update_or_create(
                nombre=nombre_super,
                defaults={"sitio_web": web, "requiere_membresia": membresia, "nombres_mapa": nombres_mapa,
                          "color": color, "url_busqueda": URL_BUSQUEDA.get(nombre_super, "")},
            )
            for i, (nombre, (cat, unidad, tam, paquete, precio, _, _)) in enumerate(INGREDIENTES.items()):
                if categorias is not None and cat not in categorias:
                    Precio.objects.filter(supermercado=sup, ingrediente=ingredientes[nombre]).delete()
                    continue
                # Los de membresía venden presentaciones grandes (lo perecedero, al doble)
                m = min(mult, 2) if cat in PERECEDEROS else mult
                variacion = VARIACION[(i + n * 4) % len(VARIACION)]
                presentacion = Decimal(tam) * m
                # Algunos productos en oferta (de ejemplo): 1 de cada 7, de 15 a 30 % de descuento
                oferta = (i * 3 + n * 5) % 7 == 0
                precio_final = redondear(precio * m * factor * variacion * (0.78 if oferta else 1))
                regular = redondear(precio * m * factor * variacion) if oferta else None
                Precio.objects.update_or_create(
                    supermercado=sup, ingrediente=ingredientes[nombre],
                    defaults={
                        "producto": f"{nombre}, {paquete} {presentacion_legible(presentacion, unidad)}",
                        "presentacion": presentacion,
                        "precio": precio_final,
                        "precio_regular": regular,
                    },
                )

        if options["verbosity"]:
            self.stdout.write(self.style.SUCCESS(
                f"Listo: {len(INGREDIENTES)} ingredientes, {len(PLATILLOS)} platillos, "
                f"{len(SUPERMERCADOS)} supermercados con precios de ejemplo."
            ))
