import datetime
import uuid
from unittest import mock

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from django.test import override_settings
from rest_framework.test import APITestCase

from cuentas.models import Usuario

URL = "https://demo.supabase.co"
LLAVE = ec.generate_private_key(ec.SECP256R1())


def token(sub=None, email="ana@uni.mx", **extra):
    ahora = datetime.datetime.now(datetime.timezone.utc)
    datos = {"sub": str(sub or uuid.uuid4()), "email": email, "aud": "authenticated", "iss": f"{URL}/auth/v1",
             "exp": ahora + datetime.timedelta(hours=1), "user_metadata": {"full_name": "Ana López"}, **extra}
    return jwt.encode(datos, LLAVE, algorithm="ES256", headers={"kid": "k1"})


class LlaveFalsa:
    key = LLAVE.public_key()


@override_settings(SUPABASE_URL=URL)
@mock.patch("cuentas.supabase._cliente_jwks")
class SupabaseAuthTests(APITestCase):
    def pedir(self, t):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {t}")
        return self.client.get("/api/auth/yo/")

    def test_crea_el_usuario_la_primera_vez(self, jwks):
        jwks.return_value.get_signing_key_from_jwt.return_value = LlaveFalsa
        uid = uuid.uuid4()
        r = self.pedir(token(uid))
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["email"], "ana@uni.mx")
        self.assertEqual(r.data["first_name"], "Ana")
        self.assertEqual(self.pedir(token(uid)).data["id"], r.data["id"])
        self.assertEqual(Usuario.objects.get().supabase_uid, uid)

    def test_enlaza_una_cuenta_que_ya_existia(self, jwks):
        jwks.return_value.get_signing_key_from_jwt.return_value = LlaveFalsa
        viejo = Usuario.objects.create_user(email="ana@uni.mx", password="x")
        verificado = {"user_metadata": {"full_name": "Ana", "email_verified": True}}
        self.assertEqual(self.pedir(token(**verificado)).data["id"], viejo.id)

    def test_no_enlaza_si_el_correo_no_esta_verificado(self, jwks):
        jwks.return_value.get_signing_key_from_jwt.return_value = LlaveFalsa
        Usuario.objects.create_user(email="ana@uni.mx", password="x")
        self.assertEqual(self.pedir(token()).status_code, 401)
        self.assertIsNone(Usuario.objects.get().supabase_uid)

    def test_rechaza_alg_none_y_hs256_sin_secreto(self, jwks):
        jwks.return_value.get_signing_key_from_jwt.return_value = LlaveFalsa
        datos = {"sub": str(uuid.uuid4()), "aud": "authenticated", "iss": f"{URL}/auth/v1", "email": "x@y.mx",
                 "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)}
        self.assertEqual(self.pedir(jwt.encode(datos, None, algorithm="none")).status_code, 401)
        self.assertEqual(self.pedir(jwt.encode(datos, "adivinado" * 4, algorithm="HS256")).status_code, 401)
        self.assertEqual(Usuario.objects.count(), 0)


    def test_rechaza_firma_falsa_y_token_vencido(self, jwks):
        jwks.return_value.get_signing_key_from_jwt.return_value = LlaveFalsa
        otra = ec.generate_private_key(ec.SECP256R1())
        falso = jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated", "iss": f"{URL}/auth/v1",
                            "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)},
                           otra, algorithm="ES256")
        self.assertEqual(self.pedir(falso).status_code, 401)
        vencido = token(exp=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1))
        self.assertEqual(self.pedir(vencido).status_code, 401)
        self.assertEqual(Usuario.objects.count(), 0)

    def test_rechaza_otro_audience(self, jwks):
        jwks.return_value.get_signing_key_from_jwt.return_value = LlaveFalsa
        self.assertEqual(self.pedir(token(aud="anon")).status_code, 401)


class LimiteDeIntentosTests(APITestCase):
    def test_frena_a_quien_adivina_contrasenas(self):
        from django.core.cache import cache
        from rest_framework.throttling import ScopedRateThrottle

        cache.clear()
        with mock.patch.object(ScopedRateThrottle, "THROTTLE_RATES", {"login": "3/min"}):
            codigos = [self.client.post("/api/auth/login/", {"email": "ana@uni.mx", "password": f"x{i}"}).status_code
                       for i in range(5)]
        cache.clear()
        self.assertEqual(codigos[:3], [400, 400, 400])
        self.assertEqual(codigos[3:], [429, 429])


@override_settings(SUPABASE_URL=URL, LOGIN_LOCAL=False)
class SinLoginLocalTests(APITestCase):
    def test_registro_y_login_de_django_no_existen(self):
        datos = {"email": "otro@uni.mx", "password": "Una-clave-larga-123"}
        self.assertEqual(self.client.post("/api/auth/registro/", datos).status_code, 404)
        self.assertEqual(self.client.post("/api/auth/login/", datos).status_code, 404)
        self.assertEqual(self.client.post("/api/auth/refresh/", {"refresh": "x"}).status_code, 404)
        self.assertEqual(Usuario.objects.count(), 0)
