from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import servicios
from .models import PerfilSalud
from .serializers import PerfilSaludSerializer, RegistroPesoSerializer


class SaludView(APIView):
    """Tu meta de salud: cuestionario, cálculo de peso saludable y calorías, y tu registro de peso."""

    @extend_schema(summary="Ver mi meta de salud")
    def get(self, request):
        return Response(servicios.resumen(request.user))

    @extend_schema(request=PerfilSaludSerializer, summary="Guardar el cuestionario de mi meta")
    def put(self, request):
        perfil = PerfilSalud.objects.filter(usuario=request.user).first()
        ser = PerfilSaludSerializer(perfil, data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        datos = dict(ser.validated_data)
        datos.pop("acepto")
        peso = datos.pop("peso_kg", None)
        if perfil is None:
            PerfilSalud.objects.create(usuario=request.user, consentimiento=timezone.now(), **datos)
        else:
            for k, v in datos.items():
                setattr(perfil, k, v)
            perfil.save()
        if peso is not None:
            servicios.guardar_peso(request.user, peso)
        return Response(servicios.aplicar_meta(request.user))

    @extend_schema(summary="Borrar todos mis datos de salud")
    def delete(self, request):
        servicios.borrar_todo(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PesosView(APIView):
    @extend_schema(request=RegistroPesoSerializer, summary="Anotar mi peso (uno por día)")
    def post(self, request):
        if not PerfilSalud.objects.filter(usuario=request.user).exists():
            return Response({"detail": "Primero llena el cuestionario de tu meta."}, status=status.HTTP_400_BAD_REQUEST)
        ser = RegistroPesoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        servicios.guardar_peso(request.user, ser.validated_data["peso_kg"], ser.validated_data.get("fecha"))
        return Response(servicios.aplicar_meta(request.user), status=status.HTTP_201_CREATED)
