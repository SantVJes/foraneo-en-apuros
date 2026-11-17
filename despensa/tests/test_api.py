from decimal import Decimal
from unittest import mock

from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APITestCase

from catalogo.models import Ingrediente, Platillo
from cuentas.models import Usuario


@override_settings(BUSCAR_SUCURSALES_OSM=False)
class BaseAPITest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("cargar_datos_demo", verbosity=0)

    def registrar(self, email="ana@example.com", presupuesto="1500"):
        r = self.client.post("/api/auth/registro/", {
            "email": email, "password": "UnaClaveSegura123", "first_name": "Ana",
            "presupuesto_semanal": presupuesto, "personas": 1,
        }, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return r


class AuthTests(BaseAPITest):
    def test_registro_login_y_perfil(self):
        self.registrar()
        self.client.credentials()
        r = self.client.post("/api/auth/login/", {"email": "ANA@example.com", "password": "UnaClaveSegura123"},
                             format="json")
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        r = self.client.patch("/api/auth/yo/", {"presupuesto_semanal": "900.00"}, format="json")
        self.assertEqual(r.data["presupuesto_semanal"], "900.00")

    def test_login_incorrecto(self):
        self.registrar()
        self.client.credentials()
        r = self.client.post("/api/auth/login/", {"email": "ana@example.com", "password": "mal"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_requiere_sesion(self):
        self.assertEqual(self.client.get("/api/platillos/").status_code, 401)

    @mock.patch("cuentas.google.verificar_id_token")
    def test_google_crea_y_reutiliza_usuario(self, verificar):
        verificar.return_value = {"sub": "g-123", "email": "beto@gmail.com", "first_name": "Beto", "last_name": ""}
        r = self.client.post("/api/auth/google/", {"id_token": "x"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["nuevo"])
        r = self.client.post("/api/auth/google/", {"id_token": "x"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Usuario.objects.filter(email="beto@gmail.com").count(), 1)

    def test_google_sin_client_id(self):
        r = self.client.post("/api/auth/google/", {"id_token": "x"}, format="json")
        self.assertEqual(r.status_code, 400)


class PlatillosTests(BaseAPITest):
    def test_filtrar_por_dificultad_y_tipo(self):
        self.registrar()
        r = self.client.get("/api/platillos/?dificultad=complicado&tipo_comida=comida")
        self.assertGreater(r.data["count"], 0)
        for p in r.data["results"]:
            self.assertEqual(p["dificultad"], "complicado")
            self.assertEqual(p["tipo_comida"], "comida")
        r = self.client.get("/api/platillos/?dificultad=facil,intermedio")
        self.assertTrue(all(p["dificultad"] in ("facil", "intermedio") for p in r.data["results"]))

    def test_detalle_con_ingredientes(self):
        self.registrar()
        p = Platillo.objects.get(nombre="Huevos a la mexicana")
        r = self.client.get(f"/api/platillos/{p.id}/")
        self.assertIn("Huevo", [i["nombre"] for i in r.data["ingredientes"]])

    def test_comparar_precios(self):
        self.registrar()
        arroz = Ingrediente.objects.get(nombre="Arroz")
        r = self.client.get(f"/api/ingredientes/{arroz.id}/precios/")
        # Costco y Sam's requieren membresía pero el catálogo de precios sí los muestra
        self.assertEqual(len(r.data), 9)


class AlacenaTests(BaseAPITest):
    def test_medidas_exactas_y_aproximadas(self):
        self.registrar()
        arroz = Ingrediente.objects.get(nombre="Arroz")
        aceite = Ingrediente.objects.get(nombre="Aceite")
        r = self.client.post("/api/alacena/", {"ingrediente_id": arroz.id, "cantidad": "1", "unidad": "kg"},
                             format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Decimal(r.data["cantidad_base"]), Decimal("1000"))
        r = self.client.post("/api/alacena/", {"ingrediente_id": aceite.id, "fraccion": "mitad"}, format="json")
        self.assertEqual(Decimal(r.data["cantidad_base"]), Decimal("450"))  # media botella de 900 ml
        r = self.client.patch(f"/api/alacena/{r.data['id']}/", {"fraccion": "un_cuarto"}, format="json")
        self.assertEqual(Decimal(r.data["cantidad_base"]), Decimal("225"))

    def test_unidad_incompatible(self):
        self.registrar()
        aceite = Ingrediente.objects.get(nombre="Aceite")
        r = self.client.post("/api/alacena/", {"ingrediente_id": aceite.id, "cantidad": "2", "unidad": "kg"},
                             format="json")
        self.assertEqual(r.status_code, 400)

    def test_cada_usuario_ve_su_alacena(self):
        self.registrar()
        arroz = Ingrediente.objects.get(nombre="Arroz")
        self.client.post("/api/alacena/", {"ingrediente_id": arroz.id, "cantidad": 500, "unidad": "g"}, format="json")
        self.registrar(email="otro@example.com")
        self.assertEqual(self.client.get("/api/alacena/").data, [])


class PlanYListaTests(BaseAPITest):
    def crear_plan(self, **extra):
        datos = {"comidas": ["comida", "cena"], **extra}
        r = self.client.post("/api/planes/", datos, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def test_plan_variado_y_con_las_comidas_elegidas(self):
        self.registrar(presupuesto="0")
        plan = self.crear_plan()
        self.assertEqual(len(plan["menu"]), 14)
        self.assertEqual({c["tipo_comida"] for c in plan["menu"]}, {"comida", "cena"})
        comidas = [c["platillo"]["id"] for c in plan["menu"] if c["tipo_comida"] == "comida"]
        self.assertEqual(len(set(comidas)), 7)  # hay 9 platillos de comida: no se repite ninguno

    def test_filtra_por_dificultad(self):
        self.registrar(presupuesto="0")
        plan = self.crear_plan(dificultades=["facil"], comidas=["desayuno"])
        self.assertTrue(all(c["platillo"]["dificultad"] == "facil" for c in plan["menu"]))

    def test_lista_de_compras_resta_alacena_y_elige_super_barato(self):
        self.registrar(presupuesto="0")
        plan = self.crear_plan()
        lista = self.client.get(f"/api/planes/{plan['id']}/lista-compras/").data
        self.assertGreater(len(lista["comprar"]), 0)
        for item in lista["comprar"]:
            costos = [c["costo"] for c in item["comparacion"]]
            self.assertEqual(item["comprar_en"]["costo"], min(costos))
            # Sin membresía no se usan Costco ni Sam's
            self.assertNotIn(item["comprar_en"]["supermercado"], {"Costco", "Sam's Club"})
        total = sum(Decimal(i["comprar_en"]["costo"]) for i in lista["comprar"])
        self.assertEqual(Decimal(lista["total"]), total)

        # Con 5 kg de un ingrediente en la alacena, ya no hay que comprarlo
        ing_id = lista["comprar"][0]["ingrediente_id"]
        ing = Ingrediente.objects.get(id=ing_id)
        self.client.post("/api/alacena/", {"ingrediente_id": ing_id, "cantidad": 50, "unidad": "paquete"},
                         format="json")
        lista2 = self.client.get(f"/api/planes/{plan['id']}/lista-compras/").data
        self.assertNotIn(ing_id, [i["ingrediente_id"] for i in lista2["comprar"]])
        self.assertIn(ing.nombre, [i["ingrediente"] for i in lista2["ya_tienes_en_alacena"]])

    def test_ajusta_al_presupuesto(self):
        self.registrar(presupuesto="0")
        caro = self.crear_plan(dificultades=["complicado"], comidas=["comida"], ajustar_presupuesto=False)
        total_caro = Decimal(self.client.get(f"/api/planes/{caro['id']}/lista-compras/").data["total"])
        plan = self.crear_plan(comidas=["comida"], presupuesto=str(total_caro / 2))
        lista = self.client.get(f"/api/planes/{plan['id']}/lista-compras/").data
        self.assertLess(Decimal(lista["total"]), total_caro)

    def test_cambiar_platillo(self):
        self.registrar(presupuesto="0")
        plan = self.crear_plan()
        mole = Platillo.objects.get(nombre="Mole poblano con pollo")
        r = self.client.post(f"/api/planes/{plan['id']}/cambiar-platillo/",
                             {"dia": 2, "tipo_comida": "comida", "platillo_id": mole.id}, format="json")
        self.assertEqual(r.status_code, 200)
        miercoles = [c for c in r.data["menu"] if c["dia"] == 2 and c["tipo_comida"] == "comida"][0]
        self.assertEqual(miercoles["platillo"]["nombre"], "Mole poblano con pollo")
        # Un platillo de cena no se puede poner en la comida
        quesadillas = Platillo.objects.get(nombre="Quesadillas")
        r = self.client.post(f"/api/planes/{plan['id']}/cambiar-platillo/",
                             {"dia": 2, "tipo_comida": "comida", "platillo_id": quesadillas.id}, format="json")
        self.assertEqual(r.status_code, 400)
