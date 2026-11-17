"""Unidades y conversiones.

Cada ingrediente guarda sus cantidades en una unidad base: gramos (g), mililitros (ml) o piezas.
El usuario puede escribir kg, l, tazas, etc. y aquí se convierte a la unidad base.
"""
from decimal import Decimal

G, ML, PIEZA = "g", "ml", "pieza"
UNIDADES_BASE = [(G, "gramos"), (ML, "mililitros"), (PIEZA, "piezas")]

# unidad -> (unidad base, factor)
CONVERSIONES = {
    "g": (G, Decimal("1")),
    "kg": (G, Decimal("1000")),
    "ml": (ML, Decimal("1")),
    "l": (ML, Decimal("1000")),
    "pieza": (PIEZA, Decimal("1")),
}
UNIDADES = [
    ("g", "gramos"),
    ("kg", "kilos"),
    ("ml", "mililitros"),
    ("l", "litros"),
    ("pieza", "piezas"),
    ("paquete", "paquetes (botella, bolsa, caja...)"),
]

# Medidas aproximadas: "me queda la mitad", "un cuarto", etc. Se aplican sobre el tamaño del paquete.
FRACCIONES = {
    "lleno": Decimal("1"),
    "tres_cuartos": Decimal("0.75"),
    "mitad": Decimal("0.5"),
    "un_tercio": Decimal("0.3333"),
    "un_cuarto": Decimal("0.25"),
    "casi_nada": Decimal("0.1"),
}
FRACCIONES_CHOICES = [
    ("lleno", "Lleno / completo"),
    ("tres_cuartos", "Tres cuartos"),
    ("mitad", "La mitad"),
    ("un_tercio", "Un tercio"),
    ("un_cuarto", "Un cuarto"),
    ("casi_nada", "Casi nada"),
]


class UnidadIncompatible(ValueError):
    pass


def a_unidad_base(cantidad, unidad, ingrediente):
    """Convierte una cantidad escrita por el usuario a la unidad base del ingrediente."""
    cantidad = Decimal(cantidad)
    if unidad == "paquete":
        return cantidad * ingrediente.tamano_paquete
    base, factor = CONVERSIONES[unidad]
    if base != ingrediente.unidad_base:
        raise UnidadIncompatible(
            f"{ingrediente.nombre} se mide en {ingrediente.unidad_base}, no en {unidad}."
        )
    return cantidad * factor
