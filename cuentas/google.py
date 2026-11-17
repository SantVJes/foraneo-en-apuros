"""Validación del id_token de Google Sign-In."""
from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


class GoogleTokenInvalido(Exception):
    pass


def verificar_id_token(token):
    """Regresa los datos del usuario de Google (sub, email, nombre) o lanza GoogleTokenInvalido."""
    if not settings.GOOGLE_CLIENT_ID:
        raise GoogleTokenInvalido("GOOGLE_CLIENT_ID no está configurado en el servidor.")
    try:
        info = id_token.verify_oauth2_token(token, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
    except ValueError as exc:
        raise GoogleTokenInvalido(str(exc)) from exc
    if not info.get("email_verified"):
        raise GoogleTokenInvalido("El correo de Google no está verificado.")
    return {
        "sub": info["sub"],
        "email": info["email"].lower(),
        "first_name": info.get("given_name", ""),
        "last_name": info.get("family_name", ""),
    }
