"""Supermercados cerca del usuario.

Busca sucursales reales en OpenStreetMap (API Overpass) alrededor de la ubicación del usuario,
las guarda en la tabla Sucursal y calcula la distancia. Si Overpass no responde, usa las
sucursales que ya estén guardadas (también se pueden dar de alta a mano en el admin).
"""
import logging
import math

import requests
from django.conf import settings

from .models import Sucursal, Supermercado

log = logging.getLogger(__name__)


def distancia_km(lat1, lng1, lat2, lng2):
    """Distancia en línea recta (fórmula de haversine)."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _identificar(tags, supers):
    texto = " ".join(tags.get(k, "") for k in ("brand", "name", "operator")).casefold()
    for sup in supers:
        if any(n.casefold() in texto for n in sup.nombres_mapa):
            return sup
    return None


def _direccion(tags):
    partes = [tags.get("addr:street", ""), tags.get("addr:housenumber", ""), tags.get("addr:suburb", ""),
              tags.get("addr:city", "")]
    return " ".join(p for p in partes if p).strip()


def consultar_osm(lat, lng, radio_km):
    """Pide a Overpass las tiendas de autoservicio alrededor del punto. Regresa los elementos crudos."""
    radio_m = int(float(radio_km) * 1000)
    consulta = f"""
    [out:json][timeout:25];
    (
      nwr["shop"~"supermarket|wholesale|department_store|convenience"](around:{radio_m},{lat},{lng});
    );
    out center tags;
    """
    resp = requests.post(
        settings.OVERPASS_URL, data={"data": consulta}, timeout=30,
        headers={"User-Agent": settings.OSM_USER_AGENT},
    )
    resp.raise_for_status()
    return resp.json().get("elements", [])


def actualizar_desde_osm(lat, lng, radio_km):
    supers = [s for s in Supermercado.objects.filter(activo=True) if s.nombres_mapa]
    guardadas = 0
    for el in consultar_osm(lat, lng, radio_km):
        tags = el.get("tags", {})
        sup = _identificar(tags, supers)
        if sup is None:
            continue
        el_lat = el.get("lat") or el.get("center", {}).get("lat")
        el_lng = el.get("lon") or el.get("center", {}).get("lon")
        if el_lat is None or el_lng is None:
            continue
        Sucursal.objects.update_or_create(
            osm_id=f"{el['type']}/{el['id']}",
            defaults={"supermercado": sup, "nombre": tags.get("name") or sup.nombre,
                      "direccion": _direccion(tags), "lat": el_lat, "lng": el_lng},
        )
        guardadas += 1
    return guardadas


def supermercados_cercanos(lat, lng, radio_km, consultar_mapa=True):
    """Regresa {supermercado_id: {"supermercado", "sucursal", "distancia_km"}} con la sucursal más cercana
    de cada cadena dentro del radio, y si la búsqueda en el mapa funcionó."""
    mapa_ok = False
    if consultar_mapa and settings.BUSCAR_SUCURSALES_OSM:
        try:
            actualizar_desde_osm(lat, lng, radio_km)
            mapa_ok = True
        except (requests.RequestException, ValueError) as exc:
            log.warning("No se pudo consultar OpenStreetMap: %s", exc)

    radio = float(radio_km)
    # Filtro rápido por caja (1 grado de latitud ~ 111 km) y luego distancia exacta
    dlat = radio / 111.0
    dlng = radio / (111.0 * max(math.cos(math.radians(lat)), 0.01))
    candidatas = Sucursal.objects.filter(
        lat__range=(lat - dlat, lat + dlat), lng__range=(lng - dlng, lng + dlng), supermercado__activo=True,
    ).select_related("supermercado")

    cercanos = {}
    for suc in candidatas:
        d = distancia_km(lat, lng, suc.lat, suc.lng)
        if d > radio:
            continue
        actual = cercanos.get(suc.supermercado_id)
        if actual is None or d < actual["distancia_km"]:
            cercanos[suc.supermercado_id] = {"supermercado": suc.supermercado, "sucursal": suc,
                                             "distancia_km": round(d, 2)}
    return cercanos, mapa_ok


def buscar_direccion(texto):
    """Convierte 'Colonia Roma, CDMX' en coordenadas con Nominatim (OpenStreetMap)."""
    resp = requests.get(
        settings.NOMINATIM_URL,
        params={"q": texto, "format": "json", "limit": 5, "countrycodes": "mx"},
        headers={"User-Agent": settings.OSM_USER_AGENT}, timeout=15,
    )
    resp.raise_for_status()
    return [{"nombre": r["display_name"], "lat": float(r["lat"]), "lng": float(r["lon"])} for r in resp.json()]
