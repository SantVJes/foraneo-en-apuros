"""Manda por correo las ofertas cerca a cada usuario Pro.

Córrelo una vez por semana (por ejemplo los viernes) con cron o el programador de tu hosting:
    python manage.py enviar_alertas_ofertas
"""
from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.utils import timezone

from cuentas.models import Usuario
from despensa.models import PlanSemanal
from pro.servicios import ofertas_cerca


def texto_alerta(usuario, ofertas):
    lineas = [f"Hola {usuario.first_name or ''}".strip() + ",", "",
              "Estas son las ofertas de esta semana en los súper que tienes cerca:", ""]
    for o in ofertas:
        marca = " (lo usas esta semana)" if o["para_tu_semana"] else ""
        lineas.append(f"- {o['producto']} en {o['supermercado']}: ${o['precio']} (antes ${o['precio_regular']}, "
                      f"-{o['ahorro_pct']} %){marca}")
    lineas += ["", f"Arma tu lista en {settings.APP_URL}", "", "Foráneo en apuros"]
    return "\n".join(lineas)


class Command(BaseCommand):
    help = "Manda por correo las ofertas cerca a los usuarios Pro."

    def add_arguments(self, parser):
        parser.add_argument("--maximo", type=int, default=10, help="Ofertas por correo.")
        parser.add_argument("--prueba", action="store_true", help="Solo muestra cuántos correos saldrían.")

    def handle(self, *args, maximo, prueba, **options):
        enviados = 0
        for u in Usuario.objects.filter(pro_hasta__gt=timezone.now(), is_active=True):
            ofertas = ofertas_cerca(u, PlanSemanal.objects.filter(usuario=u).first(), limite=maximo)
            if not ofertas:
                continue
            if not prueba:
                send_mail(f"{len(ofertas)} ofertas cerca de ti esta semana", texto_alerta(u, ofertas),
                          settings.DEFAULT_FROM_EMAIL, [u.email])
            enviados += 1
        self.stdout.write(self.style.SUCCESS(f"Correos {'por mandar' if prueba else 'mandados'}: {enviados}"))
