from catalogo.models import Ingrediente, Platillo
from despensa.tests.test_api import BaseAPITest


class RecetasTests(BaseAPITest):
    def nueva(self, **extra):
        huevo, tortilla = Ingrediente.objects.all()[:2]
        datos = {"nombre": "Chilaquiles de la abuela", "tipo_comida": "desayuno", "dificultad": "facil",
                 "tiempo_minutos": 20, "porciones": 2, "pasos": "1. Fríe\n2. Sirve", "publica": True,
                 "ingredientes_entrada": [{"ingrediente_id": huevo.id, "cantidad": "2"},
                                          {"ingrediente_id": tortilla.id, "cantidad": "100"}]}
        datos.update(extra)
        return self.client.post("/api/recetas/", datos, format="json")

    def test_crear_compartir_y_guardar(self):
        self.registrar("ana@example.com")
        r = self.nueva()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["es_mia"])
        self.assertEqual(len(r.data["ingredientes"]), 2)
        codigo, rid = r.data["codigo"], r.data["id"]
        self.assertEqual(self.client.get("/api/recetas/?de=mias").data["count"], 1)

        self.registrar("beto@example.com")
        comunidad = self.client.get("/api/recetas/").data
        self.assertEqual([x["nombre"] for x in comunidad["results"]], ["Chilaquiles de la abuela"])
        self.assertEqual(comunidad["results"][0]["autor_nombre"], "Ana")
        self.assertFalse(comunidad["results"][0]["es_mia"])
        self.assertEqual(self.client.get(f"/api/recetas/codigo/{codigo}/").data["id"], rid)
        r = self.client.post(f"/api/recetas/{rid}/guardar/")
        self.assertEqual(r.data, {"guardada": True, "guardados": 1})
        self.assertEqual(self.client.get("/api/recetas/?de=guardadas").data["count"], 1)
        # Beto no puede editar ni borrar la de Ana
        self.assertEqual(self.client.patch(f"/api/recetas/{rid}/", {"nombre": "Mía"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/recetas/{rid}/").status_code, 404)

    def test_privada_no_sale_en_comunidad_pero_si_con_enlace(self):
        self.registrar("ana@example.com")
        r = self.nueva(publica=False)
        codigo, rid = r.data["codigo"], r.data["id"]
        self.registrar("beto@example.com")
        self.assertEqual(self.client.get("/api/recetas/").data["count"], 0)
        self.assertEqual(self.client.get(f"/api/platillos/{rid}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/recetas/codigo/{codigo}/").status_code, 200)

    def test_tres_reportes_la_esconden(self):
        self.registrar("ana@example.com")
        rid = self.nueva().data["id"]
        for i in range(3):
            self.registrar(f"r{i}@example.com")
            self.assertEqual(self.client.post(f"/api/recetas/{rid}/reportar/").status_code, 200)
        self.assertEqual(self.client.get("/api/recetas/").data["count"], 0)

    def test_validaciones(self):
        self.registrar()
        r = self.nueva(nombre="Ab", ingredientes_entrada=[])
        self.assertEqual(r.status_code, 400)
        self.assertIn("nombre", r.data)
        self.assertIn("ingredientes_entrada", r.data)

    def test_tus_recetas_entran_a_tu_semana_y_no_a_la_de_otros(self):
        from catalogo.models import platillos_para_planear

        self.registrar("ana@example.com")
        rid = self.nueva().data["id"]
        from cuentas.models import Usuario
        ana = Usuario.objects.get(email="ana@example.com")
        self.assertIn(rid, platillos_para_planear(ana).values_list("id", flat=True))
        self.registrar("beto@example.com")
        beto = Usuario.objects.get(email="beto@example.com")
        self.assertNotIn(rid, platillos_para_planear(beto).values_list("id", flat=True))
        self.client.post(f"/api/recetas/{rid}/guardar/")
        self.assertIn(rid, platillos_para_planear(beto).values_list("id", flat=True))
        self.assertEqual(Platillo.objects.filter(id=rid).count(), 1)

    def test_la_cocine_y_perfil_de_quien_cocina(self):
        self.registrar("ana@example.com")
        r = self.nueva()
        rid, autor = r.data["id"], r.data["autor_id"]
        self.nueva(nombre="Mi receta secreta", publica=False)
        self.assertIn("kcal", r.data["nutricion_porcion"])
        self.assertEqual(self.client.get(f"/api/recetas/?autor={autor}").data["count"], 2)  # la autora ve todas
        self.registrar("beto@example.com")
        self.assertEqual(self.client.get(f"/api/recetas/?autor={autor}").data["count"], 1)  # otros, solo públicas
        r = self.client.post(f"/api/recetas/{rid}/cocinada/")
        self.assertEqual(r.data, {"cocinada": True, "cocinadas": 1})
        self.assertTrue(self.client.get(f"/api/recetas/{rid}/").data["cocinada"])
        self.assertEqual(self.client.post(f"/api/recetas/{rid}/cocinada/").data, {"cocinada": False, "cocinadas": 0})
