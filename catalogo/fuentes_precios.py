"""Fuentes de precios intercambiables.

La API no compra nada: solo necesita saber cuánto cuesta cada ingrediente en cada súper.
Por defecto se leen los precios guardados en la base de datos (tabla Precio), que se pueden
cargar a mano, desde el admin o con un proceso externo. Si algún supermercado ofrece una API
o un feed de precios, se crea otra clase que herede de FuentePrecios y se activa con la
variable de entorno FUENTE_PRECIOS.
"""
from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings
from django.utils.module_loading import import_string


@dataclass
class Oferta:
    supermercado: str
    producto: str
    presentacion: Decimal  # en la unidad base del ingrediente
    precio: Decimal
    url: str = ""
    actualizado: object = None  # datetime de cuándo se revisó el precio (para decir "revisado hace 2 días")


class FuentePrecios:
    def ofertas(self, ingrediente):
        """Regresa una lista de Oferta para el ingrediente, en todos los súper disponibles."""
        raise NotImplementedError


class FuenteBaseDatos(FuentePrecios):
    def ofertas(self, ingrediente):
        precios = ingrediente.precios.filter(supermercado__activo=True).select_related("supermercado")
        return [
            Oferta(p.supermercado.nombre, p.producto, p.presentacion, p.precio, p.url, p.actualizado)
            for p in precios
        ]


def obtener_fuente():
    return import_string(settings.FUENTE_PRECIOS)()
