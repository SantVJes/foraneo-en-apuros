import requests
from django.core.management.base import BaseCommand, CommandError

from catalogo.recetas_externas import importar


class Command(BaseCommand):
    help = "Importa recetas de TheMealDB. Ej: importar_recetas --area Mexican --categoria Breakfast --limite 40"

    def add_arguments(self, parser):
        parser.add_argument("--area", action="append", default=None, help="Mexican, Spanish, Italian...")
        parser.add_argument("--categoria", action="append", default=None, help="Breakfast, Chicken, Pasta...")
        parser.add_argument("--buscar", action="append", default=[], help="Texto a buscar, ej. taco")
        parser.add_argument("--limite", type=int, default=40)
        parser.add_argument("--si-vacio", action="store_true", help="Solo importa si no hay recetas de TheMealDB.")

    def handle(self, *args, **o):
        from catalogo.models import Platillo

        if o["si_vacio"] and Platillo.objects.exclude(fuente="propio").exists():
            self.stdout.write("Ya hay recetas de TheMealDB; no se importan otra vez.")
            return
        areas = o["area"] if o["area"] is not None else ["Mexican", "Spanish"]
        categorias = o["categoria"] if o["categoria"] is not None else ["Breakfast", "Chicken", "Vegetarian"]
        try:
            recetas = importar(areas, categorias, o["buscar"], o["limite"])
        except requests.RequestException as exc:
            raise CommandError(f"No se pudo conectar con TheMealDB: {exc}")
        self.stdout.write(self.style.SUCCESS(f"Importadas {len(recetas)} recetas de TheMealDB."))
