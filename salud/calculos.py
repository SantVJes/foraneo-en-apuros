"""Cálculos de la meta de salud.

- Peso saludable: rango de IMC 18.5 a 24.9 para tu estatura; el peso sugerido es un IMC de 22.
- Gasto de energía: fórmula de Mifflin-St Jeor por el factor de actividad del cuestionario.
- Para bajar se quitan 250 o 500 kcal al día (¼ o ½ kg por semana), sin bajar de 1,200 kcal (mujer)
  o 1,500 kcal (hombre). Para subir se suman 250 o 400 kcal.
- Proteína: 1.2 g por kg para mantener y 1.6 g por kg para bajar o subir.
- Menores de 18, embarazo o lactancia: sin déficit. Menores de 15: sin meta (los adultos no aplican).
Es una guía general, no sustituye a un médico o nutriólogo.
"""
import datetime
import math
from decimal import Decimal

BASE_DIA = {"sentado": 1.2, "de_pie": 1.375, "fisico": 1.55}
EXTRA_EJERCICIO = {"0": 0.0, "1_2": 0.1, "3_4": 0.2, "5_mas": 0.3}
POR_DURACION = {"corto": 0.5, "medio": 1.0, "largo": 1.3}
NIVELES = [(1.3, "Poco activo"), (1.5, "Algo activo"), (1.7, "Activo"), (9, "Muy activo")]
RITMO_KG = {"tranquilo": 0.25, "normal": 0.5}
CAMBIO_KCAL = {("bajar", "tranquilo"): -250, ("bajar", "normal"): -500,
               ("subir", "tranquilo"): 250, ("subir", "normal"): 400}
MINIMO_KCAL = {"m": 1200, "h": 1500}
AVISO = "Es una guía general. Si tienes alguna enfermedad o tomas medicamentos, consulta a tu médico o nutriólogo."


def edad(fecha_nacimiento, hoy=None):
    hoy = hoy or datetime.date.today()
    return hoy.year - fecha_nacimiento.year - ((hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day))


def factor_actividad(dia_tipico, dias_ejercicio, duracion):
    f = BASE_DIA.get(dia_tipico, 1.2) + EXTRA_EJERCICIO.get(dias_ejercicio, 0) * POR_DURACION.get(duracion, 1)
    return round(min(f, 1.9), 3)


def categoria_imc(imc):
    if imc < 18.5:
        return "bajo", "Peso bajo"
    if imc < 25:
        return "saludable", "Peso saludable"
    if imc < 30:
        return "sobrepeso", "Sobrepeso"
    return "obesidad", "Obesidad"


def _medio_kilo(x):
    return round(x * 2) / 2


def calcular(perfil, peso_kg, hoy=None):
    """Regresa el diccionario con todo el resultado. peso_kg es el peso más reciente."""
    hoy = hoy or datetime.date.today()
    peso = float(peso_kg)
    est_m = float(perfil.estatura_cm) / 100
    anios = edad(perfil.fecha_nacimiento, hoy)
    avisos = [AVISO]

    imc = peso / est_m ** 2
    cat, cat_nombre = categoria_imc(imc)
    rango = (_medio_kilo(18.5 * est_m ** 2), _medio_kilo(24.9 * est_m ** 2))
    sugerido = _medio_kilo(22 * est_m ** 2)

    if anios < 15:
        return {"disponible": False, "edad": anios,
                "avisos": ["Para menores de 15 años no damos metas de peso: el crecimiento cambia todo. "
                           "Pregúntale a tu pediatra."]}

    factor = factor_actividad(perfil.dia_tipico, perfil.dias_ejercicio, perfil.duracion_ejercicio)
    nivel = next(n for limite, n in NIVELES if factor < limite)
    basal = 10 * peso + 6.25 * float(perfil.estatura_cm) - 5 * anios + (5 if perfil.sexo == "h" else -161)
    gasto = basal * factor

    meta = perfil.meta
    if meta == "bajar" and imc < 18.5:
        meta = "mantener"
        avisos.insert(0, "Tu peso ya está por debajo del rango saludable, así que no te ponemos meta para bajar. "
                         "Te armamos el plan para mantenerte o subir poco a poco.")
    if meta == "bajar" and (anios < 18 or perfil.embarazo):
        meta = "mantener"
        avisos.insert(0, "Por tu edad o por embarazo/lactancia no quitamos calorías: el plan es para comer bien "
                         "y mantenerte. Un médico te puede dar una meta segura.")
    if perfil.condicion_medica:
        avisos.insert(0, "Como tienes una condición médica, revisa esta meta con tu médico antes de empezar.")

    cambio = CAMBIO_KCAL.get((meta, perfil.ritmo), 0)
    kcal = gasto + cambio
    if meta == "bajar" and kcal < MINIMO_KCAL[perfil.sexo]:
        kcal = min(gasto, MINIMO_KCAL[perfil.sexo])
        avisos.append(f"Bajamos tu meta solo hasta {MINIMO_KCAL[perfil.sexo]:,} kcal al día: menos que eso no es seguro sin médico.")
    kcal = int(round(kcal / 10) * 10)

    # Peso meta: el que eligió (sin bajar del rango saludable) o la orilla más cercana del rango
    if meta == "mantener":
        peso_meta = peso
    elif perfil.peso_meta_kg:
        peso_meta = max(float(perfil.peso_meta_kg), rango[0])
    elif meta == "bajar":
        peso_meta = rango[1] if imc >= 25 else max(rango[0], peso - 2)
    else:
        peso_meta = max(peso + 2, rango[0]) if imc < 18.5 else peso + 2
    peso_meta = _medio_kilo(peso_meta)
    if meta == "bajar" and peso_meta >= peso:
        peso_meta = peso
    diferencia = abs(peso - peso_meta)
    ritmo = RITMO_KG[perfil.ritmo]
    semanas = math.ceil(diferencia / ritmo) if meta != "mantener" and diferencia > 0 else 0

    proteina_por_kg = 1.2 if meta == "mantener" else 1.6
    peso_proteina = min(peso, rango[1]) if imc >= 30 else peso  # con obesidad, sobre un peso más sano
    proteina = int(round(proteina_por_kg * peso_proteina / 5) * 5)

    return {
        "disponible": True,
        "edad": anios,
        "peso_kg": round(peso, 1),
        "imc": round(imc, 1),
        "categoria": cat,
        "categoria_nombre": cat_nombre,
        "rango_saludable": {"min": rango[0], "max": rango[1]},
        "peso_sugerido": sugerido,
        "meta": meta,
        "peso_meta": peso_meta,
        "kg_por_cambiar": round(diferencia, 1),
        "semanas": semanas,
        "fecha_estimada": (hoy + datetime.timedelta(weeks=semanas)).isoformat() if semanas else None,
        "factor_actividad": factor,
        "nivel_actividad": nivel,
        "kcal_basal": int(round(basal)),
        "kcal_gasto": int(round(gasto)),
        "kcal_meta": kcal,
        "proteina_g": proteina,
        "avisos": avisos,
    }
