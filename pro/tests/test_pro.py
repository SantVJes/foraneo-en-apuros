import datetime
from unittest import mock

from django.core import mail
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone

from catalogo.models import Supermercado
from cuentas.models import Usuario
from despensa.tests.test_api import BaseAPITest
from pro import afiliados, pagos
from pro.models import ClicAfiliado, Pago


class ProTests(BaseAPITest):
    def setUp(self):
        self.registrar(presupuesto="0")
        self.u = Usuario.objects.get(email="ana@example.com")

    def hacer_pro(self, dias=30):
        self.u.pro_hasta = timezone.now() + datetime.timedelta(days=dias)
        self.u.save()

    def crear_plan(self):
        return self.client.post("/api/planes/", {"comidas": ["comida", "cena"]}, format="json")

    def test_limite_de_planes_gratis(self):
        for _ in range(5):
            self.assertEqual(self.crear_plan().status_code, 201)
        r = self.crear_plan()
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["codigo"], "limite_planes")
        self.hacer_pro()
        self.assertEqual(self.crear_plan().status_code, 201)

    def test_borrar_libera_lugar(self):
        ids = [self.crear_plan().data["id"] for _ in range(5)]
        self.client.delete(f"/api/planes/{ids[0]}/")
        self.assertEqual(self.crear_plan().status_code, 201)

    def test_estado_pro(self):
        r = self.client.get("/api/pro/")
        self.assertEqual(r.data["precios"], {"mensual": 19, "anual": 200})
        self.assertFalse(r.data["es_pro"])
        self.assertFalse(r.data["pagos_configurados"])
        self.assertFalse(self.client.get("/api/auth/yo/").data["es_pro"])

    def test_checkout_sin_stripe(self):
        r = self.client.post("/api/pro/checkout/", {"plan": "anual"}, format="json")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(self.client.post("/api/pro/checkout/", {"plan": "x"}, format="json").status_code, 400)

    @override_settings(STRIPE_SECRET_KEY="sk_test_x", STRIPE_PRECIO_MENSUAL="price_m", STRIPE_PRECIO_ANUAL="price_a")
    def test_checkout_anual_con_oxxo(self):
        with mock.patch("stripe.Customer.create", return_value={"id": "cus_1"}), \
             mock.patch("stripe.checkout.Session.create", return_value={"url": "https://checkout.stripe.com/x"}) as crear:
            r = self.client.post("/api/pro/checkout/", {"plan": "anual"}, format="json")
        self.assertEqual(r.data["url"], "https://checkout.stripe.com/x")
        kwargs = crear.call_args.kwargs
        self.assertEqual(kwargs["mode"], "payment")
        self.assertIn("oxxo", kwargs["payment_method_types"])
        self.u.refresh_from_db()
        self.assertEqual(self.u.stripe_customer_id, "cus_1")

    def test_pago_anual_oxxo_activa_al_pagar(self):
        sesion = {"id": "cs_1", "mode": "payment", "payment_status": "unpaid", "amount_total": 20000,
                  "metadata": {"usuario_id": str(self.u.id), "plan": "anual"}}
        pagos.procesar_evento({"type": "checkout.session.completed", "data": {"object": sesion}})
        self.u.refresh_from_db()
        self.assertFalse(self.u.es_pro)
        sesion["payment_status"] = "paid"
        pagos.procesar_evento({"type": "checkout.session.async_payment_succeeded", "data": {"object": sesion}})
        pagos.procesar_evento({"type": "checkout.session.async_payment_succeeded", "data": {"object": sesion}})
        self.u.refresh_from_db()
        self.assertTrue(self.u.es_pro)
        self.assertGreater(self.u.pro_hasta, timezone.now() + datetime.timedelta(days=360))
        self.assertLess(self.u.pro_hasta, timezone.now() + datetime.timedelta(days=370))  # no se suma dos veces
        self.assertEqual(Pago.objects.get().monto, 200)

    def test_renovacion_mensual(self):
        self.u.stripe_customer_id = "cus_9"
        self.u.save()
        fin = int((timezone.now() + datetime.timedelta(days=30)).timestamp())
        pagos.procesar_evento({"type": "invoice.paid", "data": {"object": {
            "id": "in_1", "customer": "cus_9", "amount_paid": 1900, "lines": {"data": [{"period": {"end": fin}}]}}}})
        self.u.refresh_from_db()
        self.assertTrue(self.u.es_pro)
        self.assertEqual(Pago.objects.get().plan, "mensual")

    @override_settings(STRIPE_WEBHOOK_SECRET="whsec_x")
    def test_webhook_firma_invalida(self):
        r = self.client.post("/api/pro/webhook/", data="{}", content_type="application/json",
                             HTTP_STRIPE_SIGNATURE="t=1,v1=mala")
        self.assertEqual(r.status_code, 400)

    @override_settings(AMAZON_AFILIADOS_TAG="cartwise-20")
    def test_links_de_afiliado_en_la_lista(self):
        walmart = Supermercado.objects.get(nombre="Walmart")
        walmart.plantilla_afiliado = "https://afiliados.example/r?u={url}"
        walmart.save()
        plan = self.crear_plan().data
        lista = self.client.get(f"/api/planes/{plan['id']}/lista-compras/?modo=un_super&supermercado={walmart.id}").data
        item = lista["comprar"][0]
        self.assertTrue(item["comprar_en"]["url_compra"].startswith("/api/ir/"))
        self.client.credentials()
        r = self.client.get(item["comprar_en"]["url_compra"])
        self.assertEqual(r.status_code, 302)
        self.assertTrue(r["Location"].startswith("https://afiliados.example/r?u=https%3A%2F%2Fsuper.walmart.com.mx"))
        r = self.client.get(item["url_amazon"])
        self.assertIn("tag=cartwise-20", r["Location"])
        self.assertEqual(ClicAfiliado.objects.count(), 2)
        self.assertEqual(ClicAfiliado.objects.first().usuario_id, self.u.id)

    def test_link_alterado_no_redirige(self):
        token = afiliados.link_compra(Supermercado.objects.first(), "Arroz", self.u).split("/")[3]
        self.assertEqual(self.client.get(f"/api/ir/{token[:-2]}xx/").status_code, 400)

    def test_ofertas_y_nutricion_son_pro(self):
        plan = self.crear_plan().data
        self.assertEqual(self.client.get("/api/ofertas/").data["codigo"], "requiere_pro")
        self.assertEqual(self.client.get(f"/api/planes/{plan['id']}/nutricion/").status_code, 403)
        self.hacer_pro()
        ofertas = self.client.get("/api/ofertas/").data
        self.assertTrue(ofertas)
        self.assertTrue(all(o["precio"] < o["precio_regular"] for o in ofertas))
        self.assertTrue(ofertas[0]["para_tu_semana"])
        n = self.client.get(f"/api/planes/{plan['id']}/nutricion/").data
        self.assertEqual(len(n["dias"]), 7)
        self.assertGreater(n["promedio"]["kcal"], 300)
        self.assertTrue(n["consejos"])

    def test_alertas_por_correo(self):
        self.crear_plan()
        call_command("enviar_alertas_ofertas", verbosity=0)
        self.assertEqual(len(mail.outbox), 0)
        self.hacer_pro()
        call_command("enviar_alertas_ofertas", stdout=open("/dev/null", "w"))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("ofertas", mail.outbox[0].subject)


class VersionBasicaTests(BaseAPITest):
    """Con PRO_ACTIVO=0 no hay límite de semanas ni funciones Pro."""

    @override_settings(PRO_ACTIVO=False)
    def test_sin_pro(self):
        self.registrar(presupuesto="0")
        for _ in range(6):
            self.assertEqual(self.client.post("/api/planes/", {"comidas": ["cena"]}, format="json").status_code, 201)
        self.assertFalse(self.client.get("/api/opciones/").data["pro_activo"])
        self.assertEqual(self.client.get("/api/pro/").status_code, 404)
        self.assertEqual(self.client.get("/api/ofertas/").status_code, 404)
        self.assertEqual(self.client.post("/api/pro/checkout/", {"plan": "anual"}, format="json").status_code, 404)
