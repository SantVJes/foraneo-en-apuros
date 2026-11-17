"""Funciones del Plan Pro: ofertas cerca y nutrición."""
from collections import defaultdict
from decimal import Decimal

from catalogo.models import Precio
from despensa.servicios import PARTE_DEL_DIA, Gustos, necesidades, nutrientes_ingrediente, supermercados_para

UNO = Decimal("0.1")


def ofertas_cerca(usuario, plan=None, limite=40):
    """Productos en oferta en los súper que el usuario puede usar (cerca y con membresía),
    primero los que necesita para su semana."""
    supers, cercanos, _ = supermercados_para(usuario)
    gustos = Gustos(usuario)
    necesito = set()
    if plan is not None:
        necesito = set(necesidades(plan, gustos)[0].keys())
    precios = (Precio.objects.filter(supermercado__in=supers, precio_regular__isnull=False)
               .select_related("ingrediente", "supermercado"))
    salida = []
    for p in precios:
        if not p.en_oferta or p.ingrediente_id in gustos.excluidos:
            continue
        if gustos.restricciones & set(p.ingrediente.restricciones or []):
            continue
        c = cercanos.get(p.supermercado_id)
        salida.append({
            "ingrediente_id": p.ingrediente_id, "ingrediente": p.ingrediente.nombre,
            "supermercado_id": p.supermercado_id, "supermercado": p.supermercado.nombre, "color": p.supermercado.color,
            "producto": p.producto, "precio": p.precio, "precio_regular": p.precio_regular,
            "ahorro": p.precio_regular - p.precio,
            "ahorro_pct": int(((p.precio_regular - p.precio) / p.precio_regular * 100).quantize(Decimal("1"))),
            "distancia_km": c["distancia_km"] if c else None,
            "para_tu_semana": p.ingrediente_id in necesito,
        })
    salida.sort(key=lambda o: (not o["para_tu_semana"], -o["ahorro_pct"]))
    return salida[:limite]


_nutrientes = nutrientes_ingrediente


def nutricion_plan(plan):
    """Calorías y macros por persona, por comida y por día, comparado con la meta del usuario."""
    usuario = plan.usuario
    gustos = Gustos(usuario)
    meta = usuario.meta_kcal
    dias = defaultdict(lambda: {"comidas": [], "kcal": Decimal(0), "proteina": Decimal(0),
                                "carbohidratos": Decimal(0), "grasa": Decimal(0)})
    for comida in plan.comidas_planificadas.exclude(platillo=None).select_related("platillo"):
        p = comida.platillo
        tot = defaultdict(Decimal)
        for pi in p.ingredientes.select_related("ingrediente"):
            for k, v in _nutrientes(gustos.resolver(pi.ingrediente), pi.cantidad / p.porciones).items():
                tot[k] += v
        d = dias[comida.dia]
        d["comidas"].append({"tipo_comida": comida.tipo_comida, "platillo": p.nombre,
                             **{k: v.quantize(UNO) for k, v in tot.items()}})
        for k, v in tot.items():
            d[k] += v
    nombres = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    lista = []
    for n in range(7):
        d = dias[n]
        # Si ese día no hace alguna comida (comedor del trabajo), su meta es solo la parte que sí planea
        meta_dia = int(meta * sum(PARTE_DEL_DIA[t] for t in plan.comidas_del_dia(n))) if meta else 0
        lista.append({"dia": n, "nombre_dia": nombres[n], "comidas": d["comidas"],
                      **{k: d[k].quantize(UNO) for k in ("kcal", "proteina", "carbohidratos", "grasa")},
                      "meta_dia": meta_dia,
                      "pct_meta": int(d["kcal"] / meta_dia * 100) if meta_dia else None})
    con_comida = [d for d in lista if d["comidas"]] or lista
    prom = {k: (sum(d[k] for d in con_comida) / len(con_comida)).quantize(UNO)
            for k in ("kcal", "proteina", "carbohidratos", "grasa")}

    consejos = []
    comidas_dia = len(plan.comidas)
    meta_prom = Decimal(sum(d["meta_dia"] for d in con_comida) / len(con_comida)).quantize(Decimal(1))
    if prom["kcal"] < meta_prom * Decimal("0.85"):
        extra = "" if comidas_dia == 3 else " Prueba agregar el desayuno a tu plan."
        consejos.append(f"Comes menos de lo que buscas ({prom['kcal']:.0f} de {meta_prom} kcal al día en lo que planeas).{extra} "
                        "También puedes agregar fruta, yogurt o cacahuates entre comidas.")
    elif prom["kcal"] > meta_prom * Decimal("1.15"):
        consejos.append(f"Te pasas de tu meta ({prom['kcal']:.0f} de {meta_prom} kcal al día en lo que planeas). "
                        "Elige platillos con menos crema, queso o fritura.")
    else:
        consejos.append("Tus calorías van bien con tu meta.")
    if prom["kcal"] and prom["proteina"] * 4 / prom["kcal"] < Decimal("0.15"):
        consejos.append("Te falta proteína: suma huevo, frijol, lenteja, pollo o atún.")
    if usuario.objetivo == "subir" and prom["kcal"] and prom["proteina"] * 4 / prom["kcal"] < Decimal("0.2"):
        consejos.append("Para subir masa muscular conviene que al menos 20 % de tus calorías vengan de proteína.")
    return {"plan_id": plan.id, "meta_kcal": meta, "objetivo": usuario.objetivo, "personas": plan.personas,
            "promedio": prom, "dias": lista, "consejos": consejos,
            "nota": "Valores aproximados por persona, calculados con tablas generales de alimentos."}
