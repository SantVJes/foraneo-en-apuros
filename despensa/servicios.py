"""Lógica del plan semanal y de la lista de compras."""
import math
import random
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from catalogo.fuentes_precios import obtener_fuente
from catalogo.models import TIPOS_COMIDA, Platillo, Supermercado
from catalogo.sucursales import supermercados_cercanos

from pro.afiliados import link_amazon, link_compra

from .models import ComidaPlanificada, Sustitucion

ORDEN_COMIDAS = [t for t, _ in TIPOS_COMIDA]
# Qué parte de las calorías del día va en cada comida
PARTE_DEL_DIA = {"desayuno": Decimal("0.25"), "comida": Decimal("0.40"), "cena": Decimal("0.35")}
DOS = Decimal("0.01")
VARIOS, UN_SUPER = "varios", "un_super"


def _dinero(valor):
    return Decimal(valor).quantize(DOS, rounding=ROUND_HALF_UP)


# ------------------------------------------------------------- gustos del usuario

class Gustos:
    """Alergias, ingredientes que no come y cambios (aceite -> aceite de oliva) de un usuario."""

    def __init__(self, usuario):
        self.restricciones = set(usuario.restricciones or [])
        self.excluidos = set(usuario.ingredientes_excluidos.values_list("id", flat=True))
        self.cambios = {s.original_id: s.reemplazo for s in
                        Sustitucion.objects.filter(usuario=usuario).select_related("reemplazo")}

    def resolver(self, ingrediente):
        return self.cambios.get(ingrediente.id, ingrediente)

    def permite(self, platillo):
        for pi in platillo.ingredientes.all():
            ing = self.resolver(pi.ingrediente)
            if ing.id in self.excluidos or self.restricciones & set(ing.restricciones or []):
                return False
        return True


def platillos_permitidos(usuario, qs=None):
    gustos = Gustos(usuario)
    qs = (qs if qs is not None else Platillo.objects.all()).prefetch_related("ingredientes__ingrediente")
    if not (gustos.restricciones or gustos.excluidos):
        return list(qs)
    return [p for p in qs if gustos.permite(p)]


# ---------------------------------------------------------------- plan semanal

def candidatos(plan, tipo):
    from catalogo.models import platillos_para_planear

    qs = platillos_para_planear(plan.usuario).filter(tipo_comida=tipo)
    if plan.dificultades:
        qs = qs.filter(dificultad__in=plan.dificultades)
    return platillos_permitidos(plan.usuario, qs)


def nutrientes_ingrediente(ingrediente, cantidad):
    factor = cantidad if ingrediente.unidad_base == "pieza" else cantidad / 100
    return {k: getattr(ingrediente, k) * factor for k in ("kcal", "proteina", "carbohidratos", "grasa")}


def kcal_platillo(platillo, gustos):
    """Calorías de una porción del platillo."""
    return sum((nutrientes_ingrediente(gustos.resolver(pi.ingrediente), pi.cantidad / platillo.porciones)["kcal"]
                for pi in platillo.ingredientes.all()), Decimal(0))


def tiene_meta_salud(usuario):
    from salud.models import PerfilSalud

    return PerfilSalud.objects.filter(usuario=usuario).exists()


def generar_plan(plan, ajustar_presupuesto=True, rng=None):
    """Llena la semana con platillos variados (sin repetir mientras haya opciones).

    Solo llena las comidas que el usuario sí hace cada día (por ejemplo, sin "comida" entre semana
    si se la dan en el trabajo). Si tiene meta de salud, prefiere platillos cuyas calorías se acercan
    a lo que le toca en esa comida. Si ajustar_presupuesto es True y la lista sale más cara que el
    presupuesto, cambia los platillos más caros por otros más baratos del mismo tipo hasta que quepa.
    """
    rng = rng or random.Random()
    plan.comidas_planificadas.all().delete()
    con_meta = tiene_meta_salud(plan.usuario)
    gustos = Gustos(plan.usuario) if con_meta else None
    nuevas = []
    for tipo in [t for t in ORDEN_COMIDAS if t in plan.comidas]:
        dias = [d for d in range(7) if tipo in plan.comidas_del_dia(d)]
        opciones = candidatos(plan, tipo)
        rng.shuffle(opciones)
        if con_meta and opciones:
            objetivo = plan.usuario.meta_kcal * PARTE_DEL_DIA[tipo]
            opciones.sort(key=lambda p: abs(kcal_platillo(p, gustos) - objetivo))
            # los más cercanos a la meta, pero con variedad para toda la semana
            opciones = opciones[:max(len(dias), min(len(opciones), 8))]
            rng.shuffle(opciones)
        for i, dia in enumerate(dias):
            platillo = opciones[i % len(opciones)] if opciones else None
            nuevas.append(ComidaPlanificada(plan=plan, dia=dia, tipo_comida=tipo, platillo=platillo))
    ComidaPlanificada.objects.bulk_create(nuevas)

    if ajustar_presupuesto and plan.presupuesto > 0:
        _ajustar_a_presupuesto(plan)
    return plan


def _costo_platillo(platillo, personas, fuente, cache, gustos):
    """Costo aproximado de un platillo (precio por unidad más barato x cantidad)."""
    if platillo.id in cache:
        return cache[platillo.id]
    total = Decimal("0")
    for pi in platillo.ingredientes.all():
        ofertas = fuente.ofertas(gustos.resolver(pi.ingrediente))
        if ofertas:
            por_unidad = min(o.precio / o.presentacion for o in ofertas)
            total += por_unidad * pi.cantidad * personas / platillo.porciones
    cache[platillo.id] = total
    return total


def _ajustar_a_presupuesto(plan, max_cambios=30, max_repeticiones=2):
    fuente = obtener_fuente()
    gustos = Gustos(plan.usuario)
    cache = {}

    def costo(p):
        return _costo_platillo(p, plan.personas, fuente, cache, gustos)

    for _ in range(max_cambios):
        if lista_de_compras(plan, fuente)["total"] <= plan.presupuesto:
            return
        comidas = list(plan.comidas_planificadas.select_related("platillo").exclude(platillo=None))
        veces = defaultdict(int)
        for c in comidas:
            veces[c.platillo_id] += 1
        cambiado = False
        comidas.sort(key=lambda c: costo(c.platillo), reverse=True)  # la más cara primero
        for comida in comidas:
            actual = costo(comida.platillo)
            # Para no perder variedad: primero platillos que no están en la semana,
            # y ninguno más de max_repeticiones veces.
            mas_baratos = sorted(
                (p for p in candidatos(plan, comida.tipo_comida)
                 if veces[p.id] < max_repeticiones and costo(p) < actual),
                key=lambda p: (veces[p.id], costo(p)),
            )
            if mas_baratos:
                comida.platillo = mas_baratos[0]
                comida.save(update_fields=["platillo"])
                cambiado = True
                break
        if not cambiado:
            return


# --------------------------------------------------------- supermercados posibles

def supermercados_para(usuario):
    """Qué súper puede usar el usuario: los activos, los de membresía solo si la tiene,
    y si dio su ubicación, solo los que tienen sucursal dentro de su radio."""
    membresias = set(usuario.membresias.values_list("id", flat=True))
    supers = [s for s in Supermercado.objects.filter(activo=True)
              if not s.requiere_membresia or s.id in membresias]
    info = {"usa_ubicacion": False, "radio_km": float(usuario.radio_km), "aviso": ""}
    cercanos = {}
    if usuario.lat is not None and usuario.lng is not None:
        info["usa_ubicacion"] = True
        cercanos, _ = supermercados_cercanos(usuario.lat, usuario.lng, usuario.radio_km, consultar_mapa=False)
        if not cercanos:
            cercanos, _ = supermercados_cercanos(usuario.lat, usuario.lng, usuario.radio_km, consultar_mapa=True)
        cerca = [s for s in supers if s.id in cercanos]
        if cerca:
            supers = cerca
        else:
            info["aviso"] = (f"No encontramos supermercados a menos de {usuario.radio_km} km. "
                             "Te mostramos precios de todas las cadenas; prueba con una distancia mayor.")
    return supers, cercanos, info


def _info_super(sup, cercanos):
    c = cercanos.get(sup.id)
    datos = {"supermercado_id": sup.id, "supermercado": sup.nombre, "color": sup.color,
             "requiere_membresia": sup.requiere_membresia, "distancia_km": None, "sucursal": None}
    if c:
        suc = c["sucursal"]
        datos.update(distancia_km=c["distancia_km"],
                     sucursal={"nombre": suc.nombre, "direccion": suc.direccion, "lat": suc.lat, "lng": suc.lng})
    return datos


# ------------------------------------------------------------- lista de compras

def necesidades(plan, gustos):
    """Cantidad total de cada ingrediente para la semana, en unidad base (con los cambios del usuario)."""
    total = defaultdict(Decimal)
    ingredientes = {}
    comidas = plan.comidas_planificadas.exclude(platillo=None).select_related("platillo")
    for comida in comidas:
        platillo = comida.platillo
        for pi in platillo.ingredientes.select_related("ingrediente"):
            ing = gustos.resolver(pi.ingrediente)
            total[ing.id] += pi.cantidad * plan.personas / platillo.porciones
            ingredientes[ing.id] = ing
    return total, ingredientes


def _cotizar(oferta, falta):
    paquetes = max(1, math.ceil(falta / oferta.presentacion))
    return {
        "supermercado": oferta.supermercado,
        "producto": oferta.producto,
        "presentacion": oferta.presentacion,
        "precio_unitario": _dinero(oferta.precio),
        "paquetes": paquetes,
        "costo": _dinero(oferta.precio * paquetes),
        "url": oferta.url,
        "actualizado": oferta.actualizado.date().isoformat() if getattr(oferta, "actualizado", None) else None,
    }


def lista_de_compras(plan, fuente=None, modo=None, supermercado_id=None):
    """Arma la lista: lo que piden los platillos, menos lo que hay en la alacena.

    modo "varios": cada producto en el súper donde sale más barato.
    modo "un_super": todo en un solo súper (el más barato que tenga todo, o el que se pida
    con supermercado_id).
    """
    fuente = fuente or obtener_fuente()
    usuario = plan.usuario
    modo = modo or usuario.modo_compra or VARIOS
    gustos = Gustos(usuario)
    supers, cercanos, ubicacion = supermercados_para(usuario)
    por_nombre = {s.nombre: s for s in supers}

    total_necesario, ingredientes = necesidades(plan, gustos)
    alacena = {a.ingrediente_id: a.cantidad_base
               for a in usuario.alacena.filter(ingrediente_id__in=total_necesario.keys())}

    faltantes, ya_tienes, sin_precio = [], [], []
    for ing_id, necesito in sorted(total_necesario.items(), key=lambda kv: ingredientes[kv[0]].nombre):
        ing = ingredientes[ing_id]
        tengo = alacena.get(ing_id, Decimal("0"))
        falta = max(Decimal("0"), necesito - tengo)
        base = {
            "ingrediente_id": ing.id, "ingrediente": ing.nombre, "categoria": ing.categoria,
            "es_basico": ing.es_basico, "unidad": ing.unidad_base,
            "necesitas": _dinero(necesito), "tienes": _dinero(tengo), "falta": _dinero(falta),
        }
        if falta <= 0:
            ya_tienes.append(base)
            continue
        cotizaciones = sorted(
            (_cotizar(o, falta) for o in fuente.ofertas(ing) if o.supermercado in por_nombre),
            key=lambda c: (c["costo"], c["precio_unitario"]),
        )
        if not cotizaciones:
            sin_precio.append(base)
            continue
        faltantes.append((base, cotizaciones))

    # Cuánto saldría comprar todo en cada súper
    por_super_total = defaultdict(lambda: {"total": Decimal("0"), "disponibles": 0})
    for _, cotizaciones in faltantes:
        vistos = set()
        for c in cotizaciones:
            if c["supermercado"] not in vistos:
                vistos.add(c["supermercado"])
                por_super_total[c["supermercado"]]["total"] += c["costo"]
                por_super_total[c["supermercado"]]["disponibles"] += 1
    comparar_tiendas = sorted(
        ({**_info_super(por_nombre[n], cercanos), "total": _dinero(d["total"]),
          "tiene_todo": d["disponibles"] == len(faltantes), "productos_disponibles": d["disponibles"]}
         for n, d in por_super_total.items()),
        key=lambda t: (not t["tiene_todo"], -t["productos_disponibles"], t["total"]),
    )

    elegido = None
    if modo == UN_SUPER and comparar_tiendas:
        if supermercado_id is not None:
            elegido = next((t["supermercado"] for t in comparar_tiendas
                            if t["supermercado_id"] == int(supermercado_id)), None)
        elegido = elegido or comparar_tiendas[0]["supermercado"]

    comprar = []
    por_tienda = defaultdict(lambda: {"productos": [], "subtotal": Decimal("0")})
    for base, cotizaciones in faltantes:
        mejor = cotizaciones[0]
        en_otro = False
        if elegido:
            en_elegido = [c for c in cotizaciones if c["supermercado"] == elegido]
            if en_elegido:
                mejor = en_elegido[0]
            else:
                en_otro = True  # no lo venden ahí: va al más barato de los demás
        mejor = {**mejor, "url_compra": link_compra(por_nombre[mejor["supermercado"]], base["ingrediente"], usuario)}
        comprar.append({**base, "comprar_en": mejor, "en_otro_super": en_otro, "comparacion": cotizaciones,
                        "url_amazon": link_amazon(base["ingrediente"], usuario)})
        tienda = por_tienda[mejor["supermercado"]]
        tienda["productos"].append({"ingrediente": base["ingrediente"], "producto": mejor["producto"],
                                    "paquetes": mejor["paquetes"], "costo": mejor["costo"]})
        tienda["subtotal"] += mejor["costo"]

    total = sum((i["comprar_en"]["costo"] for i in comprar), Decimal("0"))
    presupuesto = plan.presupuesto
    return {
        "plan_id": plan.id,
        "modo": modo,
        "supermercado_elegido": elegido,
        "ubicacion": ubicacion,
        "presupuesto": _dinero(presupuesto),
        "total": _dinero(total),
        "restante": _dinero(presupuesto - total),
        "dentro_del_presupuesto": total <= presupuesto,
        "comprar": comprar,
        "por_supermercado": [
            {**_info_super(por_nombre[n], cercanos), "subtotal": _dinero(d["subtotal"]), "productos": d["productos"]}
            for n, d in sorted(por_tienda.items(), key=lambda kv: -kv[1]["subtotal"])
        ],
        "todo_en_un_solo_supermercado": comparar_tiendas,
        "ya_tienes_en_alacena": ya_tienes,
        "sin_precio": sin_precio,
    }
