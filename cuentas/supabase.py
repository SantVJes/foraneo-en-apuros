"""Inicio de sesión con Supabase Auth.

La web (Next.js) hace el login con Supabase (Google o correo) y manda a Django el token
de acceso de Supabase en el encabezado `Authorization: Bearer <token>`. Aquí se revisa
la firma del token con las llaves públicas de tu proyecto de Supabase y se busca (o crea)
el usuario de Cartwise que le corresponde.
"""
import uuid

import jwt
from django.conf import settings
from django.db import transaction
from rest_framework import authentication, exceptions

from .models import Usuario

_jwks = None


def _cliente_jwks():
    global _jwks
    if _jwks is None:
        _jwks = jwt.PyJWKClient(f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True,
                                lifespan=3600, timeout=10)
    return _jwks


def leer_token(token):
    """Regresa los datos (claims) del token si la firma es válida; si no, lanza jwt.PyJWTError."""
    alg = jwt.get_unverified_header(token).get("alg")
    if alg == "HS256":
        # Proyectos con el "JWT secret" anterior de Supabase
        if not settings.SUPABASE_JWT_SECRET:
            raise jwt.InvalidTokenError("Falta SUPABASE_JWT_SECRET")
        llave, algoritmos = settings.SUPABASE_JWT_SECRET, ["HS256"]
    else:
        llave, algoritmos = _cliente_jwks().get_signing_key_from_jwt(token).key, ["ES256", "RS256"]
    return jwt.decode(token, llave, algorithms=algoritmos, audience="authenticated",
                      issuer=f"{settings.SUPABASE_URL}/auth/v1", options={"require": ["exp", "sub"]})


def correo_verificado(claims):
    """Supabase marca email_verified cuando el correo se confirmó o viene de Google."""
    meta = claims.get("user_metadata") or {}
    return meta.get("email_verified") is True or claims.get("email_verified") is True


@transaction.atomic
def usuario_de(claims):
    uid = uuid.UUID(claims["sub"])
    usuario = Usuario.objects.filter(supabase_uid=uid).first()
    if usuario:
        return usuario
    email = (claims.get("email") or "").strip().lower()
    if not email:
        raise exceptions.AuthenticationFailed("Tu cuenta no tiene correo.")
    meta = claims.get("user_metadata") or {}
    nombre = (meta.get("full_name") or meta.get("name") or "").strip()
    usuario = Usuario.objects.filter(email=email).first()
    if usuario is not None and not correo_verificado(claims):
        # Sin esto, alguien podría registrarse en Supabase con el correo de otra persona (sin confirmarlo)
        # y quedarse con su cuenta de Cartwise.
        raise exceptions.AuthenticationFailed("Confirma tu correo para entrar a tu cuenta.")
    if usuario is None:
        usuario = Usuario.objects.create_user(email=email, first_name=nombre.split(" ")[0][:150] if nombre else "")
    usuario.supabase_uid = uid
    usuario.save(update_fields=["supabase_uid"])
    return usuario


class SupabaseAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        if not settings.SUPABASE_URL:
            return None
        partes = authentication.get_authorization_header(request).split()
        if len(partes) != 2 or partes[0].decode().lower() != "bearer":
            return None
        token = partes[1].decode()
        try:
            iss = jwt.decode(token, options={"verify_signature": False}).get("iss", "")
        except jwt.PyJWTError:
            return None
        if not iss.startswith(settings.SUPABASE_URL):
            return None  # no es de Supabase: que lo revise el siguiente método
        try:
            claims = leer_token(token)
        except jwt.PyJWTError:
            raise exceptions.AuthenticationFailed("Tu sesión no es válida o ya venció. Entra otra vez.")
        usuario = usuario_de(claims)
        if not usuario.is_active:
            raise exceptions.AuthenticationFailed("Cuenta desactivada.")
        return usuario, claims

    def authenticate_header(self, request):
        return self.keyword
