"""Configuración de Cartwise."""
import os
import sys
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).lower() in ("1", "true", "yes", "si")


_CLAVE_DEV = "dev-inseguro-cambia-esto-en-produccion-por-favor-123"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", _CLAVE_DEV)
# Apagado por defecto: en tu compu pon DJANGO_DEBUG=1 (docker-compose y .env.example ya lo hacen)
DEBUG = env_bool("DJANGO_DEBUG", False)
if not DEBUG and (SECRET_KEY == _CLAVE_DEV or len(SECRET_KEY) < 32):
    raise RuntimeError("Pon DJANGO_SECRET_KEY con una clave larga y secreta (Render la genera sola).")
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "*" if DEBUG else "localhost").split(",")
                 if h.strip()]
# Render pone aquí el dominio público (cartwise.onrender.com)
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])
CSRF_TRUSTED_ORIGINS = [f"https://{h}" for h in ALLOWED_HOSTS if h not in ("*", "localhost", "127.0.0.1")]
# Detrás del proxy de la nube la app sabe que la conexión es https
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"
if not DEBUG:
    # Solo https: cookies seguras, redirigir http a https y HSTS de un año
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SECURE_REDIRECT_EXEMPT = [r"^$"]  # la revisión de salud de Render entra por http a /
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "cuentas",
    "catalogo",
    "despensa",
    "pro",
    "salud",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Base de datos: PostgreSQL por defecto. DB_ENGINE=sqlite solo para pruebas rápidas.
if os.environ.get("DATABASE_URL"):
    # Una sola URL, como la que dan Neon, Render o Railway: postgresql://usuario:clave@host/base?sslmode=require
    from urllib.parse import parse_qsl, unquote, urlparse

    _u = urlparse(os.environ["DATABASE_URL"])
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _u.path.lstrip("/"),
            "USER": unquote(_u.username or ""),
            "PASSWORD": unquote(_u.password or ""),
            "HOST": _u.hostname or "",
            "PORT": str(_u.port or 5432),
            "OPTIONS": dict(parse_qsl(_u.query)),
            "CONN_MAX_AGE": 60,
            # En Supabase las tablas de Cartwise van en un esquema privado (ver supabase/setup.sql)
            "CONN_HEALTH_CHECKS": True,
        }
    }
    if os.environ.get("DB_SCHEMA"):
        # Para conexiones directas; con el pooler de Supabase usa el rol cartwise_app (setup.sql)
        DATABASES["default"]["OPTIONS"]["options"] = f"-c search_path={os.environ['DB_SCHEMA']}"
elif os.environ.get("DB_ENGINE", "postgres") == "sqlite":
    DATABASES = {
        "default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "cartwise"),
            "USER": os.environ.get("POSTGRES_USER", "cartwise"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "cartwise"),
            "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }

AUTH_USER_MODEL = "cuentas.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-mx"
TIME_ZONE = "America/Mexico_City"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------- Supabase (login de la web)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")  # https://<proyecto>.supabase.co
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")  # solo si tu proyecto usa el secreto HS256 anterior
# Login propio de Django (correo y contraseña) y la web vieja en "/". Con Supabase se apaga solo:
# así nadie puede crear una cuenta con el correo de otra persona sin verificarlo.
LOGIN_LOCAL = env_bool("LOGIN_LOCAL", not SUPABASE_URL)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["cuentas.supabase.SupabaseAuthentication"] + (
        ["rest_framework_simplejwt.authentication.JWTAuthentication"] if LOGIN_LOCAL else []),
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Límite de peticiones por minuto: frena a quien quiera adivinar contraseñas o saturar la API
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("LIMITE_ANONIMO", "60/min"),
        "user": os.environ.get("LIMITE_USUARIO", "300/min"),
        "login": os.environ.get("LIMITE_LOGIN", "10/min"),
        "direcciones": "20/min",
        "ir": "60/min",
    },
}
if "test" in sys.argv[1:2]:
    # Las pruebas hacen cientos de peticiones seguidas; el límite se prueba aparte (cuentas/tests.py)
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {k: "10000/min" for k in REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]}


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=2),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Foráneo en apuros API",
    "DESCRIPTION": "Planea tus comidas de la semana, revisa tu alacena y obtén la lista de compras "
                   "con el supermercado más barato para cada producto, dentro de tu presupuesto.",
    "VERSION": "1.0.0",
}

# Client ID de Google (OAuth) para validar el id_token que manda la app.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# Fuente de precios de supermercados (intercambiable).
FUENTE_PRECIOS = os.environ.get("FUENTE_PRECIOS", "catalogo.fuentes_precios.FuenteBaseDatos")

# Búsqueda de supermercados cercanos con OpenStreetMap (Overpass) y búsqueda de direcciones (Nominatim).
BUSCAR_SUCURSALES_OSM = env_bool("BUSCAR_SUCURSALES_OSM", True)
OVERPASS_URL = os.environ.get("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org/search")
OSM_USER_AGENT = os.environ.get("OSM_USER_AGENT", "ForaneoEnApuros/2.0 (app de despensa)")

# API de recetas externa (TheMealDB). La llave "1" es la de pruebas gratuita.
THEMEALDB_URL = os.environ.get("THEMEALDB_URL", "https://www.themealdb.com/api/json/v1/1")

# ---- Monetización
# Dirección pública de la app (para regresar después de pagar)
APP_URL = os.environ.get("APP_URL") or os.environ.get("RENDER_EXTERNAL_URL", "http://localhost:8000")
# Stripe: llaves y precios (Dashboard > Productos). El anual es un pago único que permite tarjeta u OXXO.
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRECIO_MENSUAL = os.environ.get("STRIPE_PRECIO_MENSUAL", "")
STRIPE_PRECIO_ANUAL = os.environ.get("STRIPE_PRECIO_ANUAL", "")
PRO_ACTIVO = env_bool("PRO_ACTIVO", True)  # 0 = versión básica: sin Plan Pro ni límite de semanas
PRO_PRECIO_MENSUAL = int(os.environ.get("PRO_PRECIO_MENSUAL", "19"))
PRO_PRECIO_ANUAL = int(os.environ.get("PRO_PRECIO_ANUAL", "200"))
PLANES_GRATIS = int(os.environ.get("PLANES_GRATIS", "5"))
# Tag de Amazon Afiliados México (ej. cartwise-20). Vacío = no se muestra el link de Amazon.
AMAZON_AFILIADOS_TAG = os.environ.get("AMAZON_AFILIADOS_TAG", "")

# Correo para las alertas de ofertas
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Foráneo en apuros <no-responder@localhost>")


# ---------- CORS: la web en Next.js vive en otro dominio
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
CORS_ALLOW_HEADERS = ("authorization", "content-type")
