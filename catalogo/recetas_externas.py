"""Importa recetas de TheMealDB (https://www.themealdb.com) al catálogo.

TheMealDB está en inglés: los ingredientes comunes se traducen y se ligan a los ingredientes
del catálogo (para que tengan precio); los que no se conocen se crean sin precio y aparecen
en la lista de compras como "sin precio" hasta que alguien les ponga uno en el admin.
"""
import re
from decimal import Decimal
from fractions import Fraction

import requests
from django.conf import settings
from django.db import transaction

from .models import Ingrediente, Platillo, PlatilloIngrediente

# inglés (minúsculas) -> nombre en el catálogo
TRADUCCION = {
    "rice": "Arroz", "white rice": "Arroz", "long grain rice": "Arroz", "basmati rice": "Arroz",
    "black beans": "Frijol", "kidney beans": "Frijol", "pinto beans": "Frijol", "refried beans": "Frijol",
    "vegetable oil": "Aceite", "oil": "Aceite", "sunflower oil": "Aceite", "olive oil": "Aceite de oliva",
    "extra virgin olive oil": "Aceite de oliva", "spaghetti": "Pasta espagueti", "pasta": "Pasta espagueti",
    "penne rigate": "Pasta espagueti", "tomato puree": "Puré de tomate", "passata": "Puré de tomate",
    "tomato sauce": "Puré de tomate", "chopped tomatoes": "Jitomate", "tomatoes": "Jitomate", "tomato": "Jitomate",
    "cherry tomatoes": "Jitomate", "tuna": "Atún en lata", "mayonnaise": "Mayonesa", "oats": "Avena",
    "plain flour": "Harina de trigo", "flour": "Harina de trigo", "self-raising flour": "Harina de trigo",
    "sugar": "Azúcar", "caster sugar": "Azúcar", "brown sugar": "Azúcar", "bread": "Pan de caja",
    "tortillas": "Tortilla de maíz", "corn tortillas": "Tortilla de maíz", "flour tortilla": "Tortilla de harina",
    "eggs": "Huevo", "egg": "Huevo", "milk": "Leche", "whole milk": "Leche", "greek yogurt": "Yogurt natural",
    "yogurt": "Yogurt natural", "sour cream": "Crema", "double cream": "Crema", "heavy cream": "Crema",
    "butter": "Mantequilla", "unsalted butter": "Mantequilla", "cheese": "Queso manchego",
    "cheddar cheese": "Queso manchego", "monterey jack cheese": "Queso manchego", "feta": "Queso fresco",
    "ham": "Jamón", "chicken breast": "Pechuga de pollo", "chicken breasts": "Pechuga de pollo",
    "chicken": "Pechuga de pollo", "chicken thighs": "Pechuga de pollo", "minced beef": "Carne molida de res",
    "beef mince": "Carne molida de res", "ground beef": "Carne molida de res", "beef": "Bistec de res",
    "steak": "Bistec de res", "pork": "Lomo de cerdo", "pork loin": "Lomo de cerdo", "onion": "Cebolla",
    "onions": "Cebolla", "red onion": "Cebolla", "garlic": "Ajo", "garlic clove": "Ajo", "garlic cloves": "Ajo",
    "green chilli": "Chile serrano", "jalapeno": "Chile serrano", "chilli": "Chile serrano",
    "red chilli": "Chile serrano", "potatoes": "Papa", "potato": "Papa", "carrots": "Zanahoria", "carrot": "Zanahoria",
    "courgettes": "Calabacita", "zucchini": "Calabacita", "lettuce": "Lechuga", "lime": "Limón", "limes": "Limón",
    "lemon": "Limón", "avocado": "Aguacate", "banana": "Plátano", "bananas": "Plátano", "strawberries": "Fresa",
    "salt": "Sal", "sea salt": "Sal", "black pepper": "Pimienta", "pepper": "Pimienta", "cumin": "Comino",
    "oregano": "Orégano", "dried oregano": "Orégano", "chicken stock": "Consomé de pollo",
    "chicken stock cube": "Consomé de pollo", "coriander": "Cilantro", "cilantro": "Cilantro",
    "fresh coriander": "Cilantro", "sweetcorn": "Elote", "corn": "Elote", "red pepper": "Pimiento",
    "green pepper": "Pimiento", "bell pepper": "Pimiento", "mushrooms": "Champiñones", "spinach": "Espinaca",
    "prawns": "Camarón", "shrimp": "Camarón", "salmon": "Salmón", "chorizo": "Chorizo", "bacon": "Tocino",
    "cinnamon": "Canela", "honey": "Miel", "lentils": "Lenteja", "chickpeas": "Garbanzo",
}

# unidad en texto -> (gramos o ml aproximados por unidad)
MEDIDAS = {
    "kg": 1000, "g": 1, "gr": 1, "grams": 1, "gram": 1, "l": 1000, "litre": 1000, "liter": 1000, "ml": 1,
    "cup": 240, "cups": 240, "tbsp": 15, "tbs": 15, "tablespoon": 15, "tablespoons": 15, "tblsp": 15,
    "tsp": 5, "teaspoon": 5, "teaspoons": 5, "oz": 28, "lb": 454, "lbs": 454, "pinch": 1, "dash": 1,
    "clove": 5, "cloves": 5, "can": 400, "tin": 400,
}

# Peso aproximado de una pieza, cuando la receta dice "2 onions" o "8 tortillas"
PESO_PIEZA = {
    "Tortilla de maíz": 30, "Tortilla de harina": 40, "Cebolla": 150, "Jitomate": 120, "Papa": 150, "Ajo": 5,
    "Limón": 30, "Aguacate": 200, "Pechuga de pollo": 250, "Plátano": 120, "Zanahoria": 80, "Chile serrano": 10,
    "Pimiento": 150, "Calabacita": 150, "Pan de caja": 30, "Champiñones": 15, "Chile poblano": 120,
}

NUM = re.compile(r"^\s*(\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)\s*([a-zA-Z]*)")


def interpretar_medida(texto, ingrediente):
    """'1 1/2 cups' -> cantidad en la unidad base del ingrediente (aproximada)."""
    texto = (texto or "").strip().lower()
    m = NUM.match(texto)
    if not m:
        # "to taste", "a handful": cantidad pequeña
        if ingrediente.unidad_base == "pieza":
            return Decimal("1")
        return Decimal("5") if ingrediente.es_basico else Decimal("100")
    numero = float(sum(Fraction(p) for p in m.group(1).split()))
    unidad = m.group(2)
    if ingrediente.unidad_base == "pieza":
        return Decimal(str(round(numero, 2)))
    factor = MEDIDAS.get(unidad)
    if factor is None:
        # número sin unidad ("2 onions"): peso de una pieza
        factor = PESO_PIEZA.get(ingrediente.nombre, 150)
    return Decimal(str(round(numero * factor, 2)))


def _dificultad(n_ingredientes, instrucciones):
    pasos = len([p for p in re.split(r"[\r\n]+|\. ", instrucciones or "") if p.strip()])
    if n_ingredientes <= 7 and pasos <= 8:
        return "facil"
    if n_ingredientes <= 12 and pasos <= 16:
        return "intermedio"
    return "complicado"


def _tipo(categoria):
    if categoria == "Breakfast":
        return "desayuno"
    if categoria in ("Side", "Starter", "Pasta", "Vegetarian", "Vegan", "Miscellaneous"):
        return "cena"
    return "comida"


def _ingrediente(nombre_en, medida):
    clave = nombre_en.strip().lower()
    nombre = TRADUCCION.get(clave) or nombre_en.strip().capitalize()
    ing = Ingrediente.objects.filter(nombre__iexact=nombre).first()
    if ing is None:
        es_liquido = any(u in (medida or "").lower() for u in ("ml", "litre", "liter", "cup")) and \
            any(x in clave for x in ("oil", "milk", "stock", "sauce", "water", "vinegar", "juice", "cream"))
        ing = Ingrediente.objects.create(
            nombre=nombre, categoria="Importado", unidad_base="ml" if es_liquido else "g",
            tamano_paquete=Decimal("500"), nombre_paquete="paquete",
        )
    return ing


def _get(ruta, **params):
    resp = requests.get(f"{settings.THEMEALDB_URL}/{ruta}", params=params, timeout=20)
    resp.raise_for_status()
    return resp.json().get("meals") or []


@transaction.atomic
def guardar_receta(meal):
    if meal.get("strCategory") == "Dessert":
        return None
    pares = []
    for i in range(1, 21):
        nombre = (meal.get(f"strIngredient{i}") or "").strip()
        if nombre:
            pares.append((nombre, meal.get(f"strMeasure{i}") or ""))
    platillo, _ = Platillo.objects.update_or_create(
        fuente="themealdb", id_externo=meal["idMeal"],
        defaults={
            "nombre": meal["strMeal"][:150],
            "descripcion": f"Receta {meal.get('strArea', '')} importada de TheMealDB.".replace("  ", " "),
            "tipo_comida": _tipo(meal.get("strCategory")),
            "dificultad": _dificultad(len(pares), meal.get("strInstructions")),
            "estilo": meal.get("strArea") or "",
            "tiempo_minutos": 20 + 5 * len(pares),
            "porciones": 4,
            "pasos": meal.get("strInstructions") or "",
            "imagen_url": meal.get("strMealThumb") or "",
        },
    )
    platillo.ingredientes.all().delete()
    cantidades = {}
    for nombre, medida in pares:
        ing = _ingrediente(nombre, medida)
        cantidades[ing] = cantidades.get(ing, Decimal("0")) + interpretar_medida(medida, ing)
    PlatilloIngrediente.objects.bulk_create(
        [PlatilloIngrediente(platillo=platillo, ingrediente=i, cantidad=c) for i, c in cantidades.items()]
    )
    return platillo


def importar(areas=(), categorias=(), buscar=(), limite=40):
    ids = []
    for area in areas:
        ids += [m["idMeal"] for m in _get("filter.php", a=area)]
    for cat in categorias:
        ids += [m["idMeal"] for m in _get("filter.php", c=cat)]
    for texto in buscar:
        ids += [m["idMeal"] for m in _get("search.php", s=texto)]
    importados = []
    for id_meal in list(dict.fromkeys(ids))[:limite]:
        detalle = _get("lookup.php", i=id_meal)
        if detalle:
            p = guardar_receta(detalle[0])
            if p:
                importados.append(p)
    return importados
