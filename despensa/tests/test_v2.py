from decimal import Decimal
from unittest import mock

from catalogo.models import Ingrediente, Platillo, Sucursal, Supermercado
from catalogo import recetas_externas, sucursales

from .test_api import BaseAPITest

# Un punto en la colonia Roma, CDMX
LAT, LNG = 19.4180, -99.1620


class PreferenciasTests(BaseAPITest):
    def crear_plan(self, **extra):
        r = self.client.post("/api/planes/", {"comidas": ["desayuno", "comida", "cena"], **extra}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def test_recetas_llevan_sal_y_aceite(self):
        p = Platillo.objects.get(nombre="Picadillo")
        nombres = set(p.ingredientes.values_list("ingrediente__nombre", flat=True))
        self.assertTrue({"Sal", "Aceite", "Pimienta"} <= nombres)
        self.assertNotIn("Sal", set(Platillo.objects.get(nombre="Avena con plátano")
                                    .ingredientes.values_list("ingrediente__nombre", flat=True)))
        self.assertGreaterEqual(Platillo.objects.count(), 50)

    def test_alergias_y_dieta(self):
        self.registrar(presupuesto="0")
        self.client.patch("/api/auth/yo/", {"restricciones": ["lacteos", "carne"]}, format="json")
        plan = self.crear_plan()
        for c in plan["menu"]:
            if c["platillo"]:
                self.assertFalse({"lacteos", "carne"} & set(c["platillo"]["contiene"]), c["platillo"]["nombre"])
        r = self.client.get("/api/platillos/?para_mi=1&page_size=100")
        self.assertTrue(all(not ({"lacteos", "carne"} & set(p["contiene"])) for p in r.data["results"]))

    def test_ingrediente_excluido(self):
        self.registrar(presupuesto="0")
        huevo = Ingrediente.objects.get(nombre="Huevo")
        self.client.patch("/api/auth/yo/", {"ingredientes_excluidos": [huevo.id]}, format="json")
        plan = self.crear_plan(comidas=["desayuno"])
        nombres = {c["platillo"]["nombre"] for c in plan["menu"] if c["platillo"]}
        self.assertNotIn("Huevos a la mexicana", nombres)

    def test_aceite_de_oliva(self):
        self.registrar(presupuesto="0")
        aceite = Ingrediente.objects.get(nombre="Aceite")
        oliva = Ingrediente.objects.get(nombre="Aceite de oliva")
        r = self.client.patch("/api/auth/yo/", {"cambios": [{"original_id": aceite.id, "reemplazo_id": oliva.id}]},
                              format="json")
        self.assertEqual(r.data["sustituciones"][0]["reemplazo"], "Aceite de oliva")
        plan = self.crear_plan(comidas=["comida"])
        lista = self.client.get(f"/api/planes/{plan['id']}/lista-compras/").data
        nombres = [i["ingrediente"] for i in lista["comprar"]]
        self.assertIn("Aceite de oliva", nombres)
        self.assertNotIn("Aceite", nombres)

    def test_opciones(self):
        self.registrar()
        r = self.client.get("/api/opciones/")
        self.assertIn("lacteos", [o["valor"] for o in r.data["restricciones"]])


class SupermercadosTests(BaseAPITest):
    def setUp(self):
        self.walmart = Supermercado.objects.get(nombre="Walmart")
        self.costco = Supermercado.objects.get(nombre="Costco")
        self.soriana = Supermercado.objects.get(nombre="Soriana")
        # Sucursales de prueba: Walmart a ~1 km, Costco a ~2 km, Soriana a ~15 km
        Sucursal.objects.create(supermercado=self.walmart, nombre="Walmart prueba", lat=LAT + 0.009, lng=LNG)
        Sucursal.objects.create(supermercado=self.costco, nombre="Costco prueba", lat=LAT, lng=LNG + 0.019)
        Sucursal.objects.create(supermercado=self.soriana, nombre="Soriana prueba", lat=LAT + 0.135, lng=LNG)

    def plan_con_ubicacion(self, radio="5", membresias=()):
        self.registrar(presupuesto="0")
        self.client.patch("/api/auth/yo/", {"lat": LAT, "lng": LNG, "radio_km": radio,
                                            "membresias": list(membresias)}, format="json")
        r = self.client.post("/api/planes/", {"comidas": ["comida", "cena"]}, format="json")
        return r.data["id"]

    def test_distancia(self):
        d = sucursales.distancia_km(LAT, LNG, LAT + 0.009, LNG)
        self.assertAlmostEqual(d, 1.0, delta=0.05)

    def test_cercanos_respeta_radio(self):
        self.registrar()
        r = self.client.get(f"/api/supermercados/cercanos/?lat={LAT}&lng={LNG}&radio_km=5")
        cerca = {s["nombre"]: s["distancia_km"] for s in r.data["supermercados"] if s["cerca"]}
        self.assertEqual(set(cerca), {"Walmart", "Costco"})
        self.assertAlmostEqual(cerca["Walmart"], 1.0, delta=0.05)

    def test_lista_solo_super_cercanos_y_sin_membresia(self):
        plan_id = self.plan_con_ubicacion()
        lista = self.client.get(f"/api/planes/{plan_id}/lista-compras/").data
        tiendas = {i["comprar_en"]["supermercado"] for i in lista["comprar"]}
        self.assertEqual(tiendas, {"Walmart"})  # Costco está cerca pero no tiene membresía
        self.assertEqual(lista["por_supermercado"][0]["distancia_km"], 1.0)

    def test_con_membresia_usa_costco(self):
        plan_id = self.plan_con_ubicacion(membresias=[self.costco.id])
        lista = self.client.get(f"/api/planes/{plan_id}/lista-compras/").data
        tiendas = {t["supermercado"] for t in lista["todo_en_un_solo_supermercado"]}
        self.assertEqual(tiendas, {"Walmart", "Costco"})

    def test_radio_mas_grande_incluye_mas(self):
        plan_id = self.plan_con_ubicacion(radio="20")
        lista = self.client.get(f"/api/planes/{plan_id}/lista-compras/").data
        tiendas = {t["supermercado"] for t in lista["todo_en_un_solo_supermercado"]}
        self.assertEqual(tiendas, {"Walmart", "Soriana"})

    def test_sin_super_cerca_avisa(self):
        Sucursal.objects.all().delete()
        plan_id = self.plan_con_ubicacion()
        lista = self.client.get(f"/api/planes/{plan_id}/lista-compras/").data
        self.assertTrue(lista["ubicacion"]["aviso"])
        self.assertGreater(len(lista["comprar"]), 0)

    def test_modo_un_super(self):
        self.registrar(presupuesto="0")
        r = self.client.post("/api/planes/", {"comidas": ["comida", "cena"]}, format="json")
        plan_id = r.data["id"]
        lista = self.client.get(f"/api/planes/{plan_id}/lista-compras/?modo=un_super").data
        elegido = lista["supermercado_elegido"]
        self.assertTrue(elegido)
        self.assertEqual({i["comprar_en"]["supermercado"] for i in lista["comprar"] if not i["en_otro_super"]},
                         {elegido})
        varios = self.client.get(f"/api/planes/{plan_id}/lista-compras/?modo=varios").data
        self.assertLessEqual(Decimal(varios["total"]), Decimal(lista["total"]))
        # Elegir un súper en particular
        lista = self.client.get(
            f"/api/planes/{plan_id}/lista-compras/?modo=un_super&supermercado={self.soriana.id}").data
        self.assertEqual(lista["supermercado_elegido"], "Soriana")

    @mock.patch("catalogo.sucursales.consultar_osm")
    def test_importa_sucursales_de_openstreetmap(self, consultar):
        Sucursal.objects.all().delete()
        consultar.return_value = [
            {"type": "node", "id": 1, "lat": LAT + 0.01, "lon": LNG, "tags": {"name": "Bodega Aurrera Roma"}},
            {"type": "way", "id": 2, "center": {"lat": LAT, "lon": LNG + 0.01}, "tags": {"brand": "Sam's Club"}},
            {"type": "node", "id": 3, "lat": LAT, "lon": LNG, "tags": {"name": "Tienda de la esquina"}},
        ]
        with self.settings(BUSCAR_SUCURSALES_OSM=True):
            cercanos, ok = sucursales.supermercados_cercanos(LAT, LNG, 3)
        self.assertTrue(ok)
        nombres = {c["supermercado"].nombre for c in cercanos.values()}
        self.assertEqual(nombres, {"Bodega Aurrera", "Sam's Club"})


class RecetasExternasTests(BaseAPITest):
    def test_medidas(self):
        arroz = Ingrediente.objects.get(nombre="Arroz")
        huevo = Ingrediente.objects.get(nombre="Huevo")
        self.assertEqual(recetas_externas.interpretar_medida("1 1/2 cups", arroz), Decimal("360.0"))
        self.assertEqual(recetas_externas.interpretar_medida("200g", arroz), Decimal("200.0"))
        self.assertEqual(recetas_externas.interpretar_medida("3", huevo), Decimal("3.0"))

    def test_guardar_receta_de_themealdb(self):
        meal = {"idMeal": "999", "strMeal": "Chicken Enchiladas", "strCategory": "Chicken", "strArea": "Mexican",
                "strInstructions": "Cook chicken. Fill tortillas. Bake.", "strMealThumb": "https://x/y.jpg",
                "strIngredient1": "Chicken Breast", "strMeasure1": "500g",
                "strIngredient2": "Corn Tortillas", "strMeasure2": "8",
                "strIngredient3": "Salt", "strMeasure3": "to taste",
                "strIngredient4": "Enchilada sauce", "strMeasure4": "1 cup"}
        p = recetas_externas.guardar_receta(meal)
        nombres = set(p.ingredientes.values_list("ingrediente__nombre", flat=True))
        self.assertTrue({"Pechuga de pollo", "Tortilla de maíz", "Sal", "Enchilada sauce"} <= nombres)
        self.assertEqual(p.fuente, "themealdb")
        self.assertEqual(p.dificultad, "facil")
