"""Links de compra con tu código de afiliado.

En la lista de compras cada producto lleva un link corto /api/ir/<token>/. Al abrirlo se
guarda el clic (para que sepas cuántas compras mandas a cada tienda) y se redirige a la
tienda en línea con tu link de afiliado. El token va firmado para que nadie pueda usar
el redireccionador para mandar gente a otras páginas.
"""
from urllib.parse import quote, quote_plus, urlparse

from django.conf import settings
from django.core import signing

SAL = "cartwise.ir"
AMAZON = "amazon"


def _token(destino_id, texto, usuario):
    return signing.dumps({"s": destino_id, "q": texto, "u": usuario.id if usuario else None}, salt=SAL, compress=True)


def link_compra(supermercado, texto, usuario):
    return f"/api/ir/{_token(supermercado.id, texto, usuario)}/"


def link_amazon(texto, usuario):
    if not settings.AMAZON_AFILIADOS_TAG:
        return None
    return f"/api/ir/{_token(AMAZON, texto, usuario)}/"


def leer_token(token):
    """Regresa el contenido del token o None si es inválido o muy viejo (60 días)."""
    try:
        return signing.loads(token, salt=SAL, max_age=60 * 60 * 24 * 60)
    except signing.BadSignature:
        return None


def destino_tienda(supermercado, texto):
    if supermercado.url_busqueda:
        url = supermercado.url_busqueda.replace("{q}", quote_plus(texto))
    else:
        dominio = urlparse(supermercado.sitio_web).netloc or supermercado.nombre
        url = f"https://www.google.com/search?q={quote_plus(texto + ' site:' + dominio)}"
    if supermercado.plantilla_afiliado:
        url = supermercado.plantilla_afiliado.replace("{url}", quote(url, safe=""))
    return url


def destino_amazon(texto):
    return f"https://www.amazon.com.mx/s?k={quote_plus(texto)}&tag={quote_plus(settings.AMAZON_AFILIADOS_TAG)}"
