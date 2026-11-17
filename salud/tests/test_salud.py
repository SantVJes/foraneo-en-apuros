import datetime
from types import SimpleNamespace

from django.test import SimpleTestCase, override_settings

from despensa.models import PlanSemanal
from despensa.tests.test_api import BaseAPITest
from salud.calculos import calcular, factor_actividad

HOY = datetime.date(2026, 11, 13)


def perfil(**extra):
    datos = dict(fecha_nacimiento=datetime.date(2003, 5, 1), sexo="h", estatura_cm=175, dia_tipico="sentado",
                 dias_ejercicio="3_4", duracion_ejercicio="medio", meta="bajar", ritmo="normal", peso_meta_kg=None,
                 embarazo=False, condicion_medica=False)
    datos.update(extra)
    return SimpleNamespace(**datos)


class CalculosTests(SimpleTestCase):
    def test_hombre_con_sobrepeso_que_quiere_bajar(self):
        r = calcular(perfil(), 85, HOY)
        self.assertEqual(r["edad"], 23)
        self.assertEqual(r["imc"], 27.8)
        self.assertEqual(r["categoria"], "sobrepeso")
        self.assertEqual(r["rango_saludable"], {"min": 56.5, "max": 76.5})
        self.assertEqual(r["peso_sugerido"], 67.5)
        # Mifflin: 10*85 + 6.25*175 - 5*23 + 5 = 1833.75; x1.4 = 2567; -500
        self.assertEqual(r["kcal_basal"], 1834)
        self.assertEqual(r["kcal_gasto"], 2567)
        self.assertEqual(r["kcal_meta"], 2070)
        self.assertEqual(r["peso_meta"], 76.5)
        self.assertEqual(r["semanas"], 17)
        self.assertEqual(r["proteina_g"], 135)

    def test_no_baja_del_minimo_seguro(self):
        r = calcular(perfil(sexo="m", estatura_cm=152, fecha_nacimiento=datetime.date(1960, 1, 1),
                            dias_ejercicio="0"), 62, HOY)
        self.assertEqual(r["kcal_meta"], 1200)

    def test_menores_y_embarazo_sin_deficit(self):
        joven = calcular(perfil(fecha_nacimiento=datetime.date(2010, 1, 1)), 80, HOY)
        self.assertEqual(joven["meta"], "mantener")
        self.assertEqual(joven["kcal_meta"], joven["kcal_gasto"] // 10 * 10 + (10 if joven["kcal_gasto"] % 10 >= 5 else 0))
        emb = calcular(perfil(sexo="m", embarazo=True), 80, HOY)
        self.assertEqual(emb["meta"], "mantener")
        nino = calcular(perfil(fecha_nacimiento=datetime.date(2014, 1, 1)), 50, HOY)
        self.assertFalse(nino["disponible"])

    def test_peso_bajo_no_puede_bajar_mas(self):
        r = calcular(perfil(), 54, HOY)
        self.assertEqual(r["meta"], "mantener")
        r = calcular(perfil(peso_meta_kg=45), 70, HOY)
        self.assertGreaterEqual(r["peso_meta"], r["rango_saludable"]["min"])

    def test_factor_del_cuestionario(self):
        self.assertEqual(factor_actividad("sentado", "0", "medio"), 1.2)
        self.assertEqual(factor_actividad("fisico", "5_mas", "largo"), 1.9)
        self.assertEqual(factor_actividad("de_pie", "1_2", "corto"), 1.425)


@override_settings(PRO_ACTIVO=False)
class SaludAPITests(BaseAPITest):
    CUESTIONARIO = {"acepto": True, "fecha_nacimiento": "2003-05-01", "sexo": "h", "estatura_cm": "175",
                    "peso_kg": "85", "dia_tipico": "sentado", "dias_ejercicio": "3_4",
                    "duracion_ejercicio": "medio", "meta": "bajar", "ritmo": "normal"}

    def test_pide_permiso_y_calcula(self):
        self.registrar()
        self.assertIsNone(self.client.get("/api/salud/").data["perfil"])
        r = self.client.put("/api/salud/", {**self.CUESTIONARIO, "acepto": False}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.put("/api/salud/", self.CUESTIONARIO, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["calculo"]["kcal_meta"], 2070)
        self.assertEqual(self.client.get("/api/auth/yo/").data["meta_kcal"], 2070)
        r = self.client.post("/api/salud/pesos/", {"peso_kg": "84.2", "fecha": "2026-11-01"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(len(r.data["pesos"]), 2)

    def test_cada_quien_ve_solo_lo_suyo_y_puede_borrarlo(self):
        self.registrar()
        self.client.put("/api/salud/", self.CUESTIONARIO, format="json")
        self.registrar("beto@example.com")
        self.assertIsNone(self.client.get("/api/salud/").data["perfil"])
        self.registrar("cata@example.com")
        self.client.put("/api/salud/", self.CUESTIONARIO, format="json")
        self.assertEqual(self.client.delete("/api/salud/").status_code, 204)
        r = self.client.get("/api/salud/")
        self.assertIsNone(r.data["perfil"])
        self.assertEqual(r.data["pesos"], [])
        self.assertEqual(self.client.get("/api/auth/yo/").data["meta_kcal"], 2000)

    def test_menu_se_acerca_a_las_calorias(self):
        self.registrar()
        self.client.put("/api/salud/", self.CUESTIONARIO, format="json")
        plan = self.client.post("/api/planes/", {"comidas": ["desayuno", "comida", "cena"],
                                                 "ajustar_presupuesto": False}, format="json").data
        r = self.client.get(f"/api/planes/{plan['id']}/nutricion/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["meta_kcal"], 2070)

    def test_borrar_mi_cuenta(self):
        self.registrar()
        self.client.put("/api/salud/", self.CUESTIONARIO, format="json")
        self.assertEqual(self.client.delete("/api/auth/yo/").status_code, 204)
        from cuentas.models import Usuario
        from salud.models import RegistroPeso

        self.assertFalse(Usuario.objects.filter(email="ana@example.com").exists())
        self.assertEqual(RegistroPeso.objects.count(), 0)


class RutinaTests(BaseAPITest):
    def test_comedor_entre_semana(self):
        self.registrar()
        lv = {str(d): ["desayuno", "cena"] for d in range(5)}
        r = self.client.patch("/api/auth/yo/", {"rutina_comidas": lv}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        plan = self.client.post("/api/planes/", {"comidas": ["desayuno", "comida", "cena"]}, format="json").data
        comidas = {(c["dia"], c["tipo_comida"]) for c in plan["menu"]}
        self.assertNotIn((0, "comida"), comidas)
        self.assertIn((5, "comida"), comidas)
        self.assertEqual(len(comidas), 5 * 2 + 2 * 3)
        lista = self.client.get(f"/api/planes/{plan['id']}/lista-compras/").data
        self.assertGreater(len(lista["supermercados"] if "supermercados" in lista else lista), 0)

    def test_saltar_y_volver_a_agregar_una_comida(self):
        self.registrar()
        plan = self.client.post("/api/planes/", {"comidas": ["comida", "cena"]}, format="json").data
        url = f"/api/planes/{plan['id']}/cambiar-platillo/"
        r = self.client.post(url, {"dia": 4, "tipo_comida": "cena", "platillo_id": None}, format="json")
        self.assertNotIn((4, "cena"), {(c["dia"], c["tipo_comida"]) for c in r.data["menu"]})
        self.assertEqual(r.data["comidas_por_dia"]["4"], ["comida"])
        # Volver a generar respeta que ese viernes no cena en casa
        r = self.client.post(f"/api/planes/{plan['id']}/generar/", {}, format="json")
        self.assertNotIn((4, "cena"), {(c["dia"], c["tipo_comida"]) for c in r.data["menu"]})
        # Un desayuno solo el sábado
        from catalogo.models import Platillo

        desayuno = Platillo.objects.filter(tipo_comida="desayuno").first()
        r = self.client.post(url, {"dia": 5, "tipo_comida": "desayuno", "platillo_id": desayuno.id}, format="json")
        menu = {(c["dia"], c["tipo_comida"]) for c in r.data["menu"]}
        self.assertIn((5, "desayuno"), menu)
        self.assertNotIn((0, "desayuno"), menu)
        self.assertEqual(PlanSemanal.objects.get(pk=plan["id"]).comidas_del_dia(0), ["comida", "cena"])

    def test_rutina_invalida(self):
        self.registrar()
        r = self.client.patch("/api/auth/yo/", {"rutina_comidas": {"9": ["cena"]}}, format="json")
        self.assertEqual(r.status_code, 400)


@override_settings(PRO_ACTIVO=True)
class NutricionConMetaTests(BaseAPITest):
    def test_con_meta_la_nutricion_es_gratis_aunque_haya_pro(self):
        self.registrar()
        plan = self.client.post("/api/planes/", {"comidas": ["comida", "cena"], "ajustar_presupuesto": False},
                                format="json").data
        self.assertEqual(self.client.get(f"/api/planes/{plan['id']}/nutricion/").status_code, 403)
        self.client.put("/api/salud/", SaludAPITests.CUESTIONARIO, format="json")
        r = self.client.get(f"/api/planes/{plan['id']}/nutricion/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["dias"][0]["meta_dia"], int(2070 * 0.75))
