from django.db import transaction
from django.utils import timezone

from .calculos import calcular
from .models import PerfilSalud, RegistroPeso


def peso_actual(usuario):
    r = RegistroPeso.objects.filter(usuario=usuario).first()
    return r.peso_kg if r else None


def guardar_peso(usuario, peso_kg, fecha=None):
    fecha = fecha or timezone.localdate()
    RegistroPeso.objects.update_or_create(usuario=usuario, fecha=fecha, defaults={"peso_kg": peso_kg})


def resumen(usuario):
    perfil = PerfilSalud.objects.filter(usuario=usuario).first()
    pesos = list(RegistroPeso.objects.filter(usuario=usuario)[:52])
    datos = {"perfil": None, "calculo": None,
             "pesos": [{"fecha": p.fecha.isoformat(), "peso_kg": float(p.peso_kg)} for p in reversed(pesos)]}
    if perfil is None:
        return datos
    from .serializers import PerfilSaludSerializer

    datos["perfil"] = PerfilSaludSerializer(perfil).data
    if pesos:
        datos["calculo"] = calcular(perfil, pesos[0].peso_kg, timezone.localdate())
        primero = pesos[-1].peso_kg
        datos["calculo"]["cambio_total"] = round(float(pesos[0].peso_kg - primero), 1)
        dias = (timezone.localdate() - pesos[0].fecha).days
        datos["calculo"]["toca_pesarse"] = dias >= 7
    return datos


@transaction.atomic
def aplicar_meta(usuario):
    """Pasa las calorías de la meta al perfil: el menú y la nutrición las usan."""
    r = resumen(usuario)
    c = r["calculo"]
    if c and c.get("disponible"):
        usuario.meta_kcal = c["kcal_meta"]
        usuario.objetivo = c["meta"]
        usuario.save(update_fields=["meta_kcal", "objetivo"])
    return r


@transaction.atomic
def borrar_todo(usuario):
    PerfilSalud.objects.filter(usuario=usuario).delete()
    RegistroPeso.objects.filter(usuario=usuario).delete()
    usuario.meta_kcal = 2000
    usuario.objetivo = "mantener"
    usuario.save(update_fields=["meta_kcal", "objetivo"])
