from drf_spectacular.utils import extend_schema
from django.conf import settings
from django.http import Http404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from . import google
from .models import Usuario
from .serializers import (
    GoogleLoginSerializer,
    LoginSerializer,
    RegistroSerializer,
    UsuarioSerializer,
    tokens_para,
)


class LoginLocalMixin:
    """Registro y login propios de Django. Con Supabase (LOGIN_LOCAL=0) no existen: todo pasa por Supabase."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def initial(self, request, *args, **kwargs):
        if not settings.LOGIN_LOCAL:
            raise Http404
        super().initial(request, *args, **kwargs)


class RegistroView(LoginLocalMixin, APIView):

    @extend_schema(request=RegistroSerializer, summary="Registro con correo y contraseña")
    def post(self, request):
        ser = RegistroSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        usuario = ser.save()
        return Response(
            {"usuario": UsuarioSerializer(usuario).data, **tokens_para(usuario)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(LoginLocalMixin, APIView):

    @extend_schema(request=LoginSerializer, summary="Inicio de sesión con correo y contraseña")
    def post(self, request):
        ser = LoginSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        usuario = ser.validated_data["usuario"]
        return Response({"usuario": UsuarioSerializer(usuario).data, **tokens_para(usuario)})


class GoogleLoginView(LoginLocalMixin, APIView):

    @extend_schema(request=GoogleLoginSerializer, summary="Registro / inicio de sesión con Google")
    def post(self, request):
        ser = GoogleLoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            datos = google.verificar_id_token(ser.validated_data["id_token"])
        except google.GoogleTokenInvalido as exc:
            return Response({"detail": f"Token de Google inválido: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        usuario = Usuario.objects.filter(google_sub=datos["sub"]).first()
        creado = False
        if usuario is None:
            usuario = Usuario.objects.filter(email=datos["email"]).first()
            if usuario is None:
                usuario = Usuario.objects.create_user(
                    email=datos["email"],
                    first_name=datos["first_name"],
                    last_name=datos["last_name"],
                )
                creado = True
            usuario.google_sub = datos["sub"]
            usuario.save(update_fields=["google_sub"])
        return Response(
            {"usuario": UsuarioSerializer(usuario).data, "nuevo": creado, **tokens_para(usuario)},
            status=status.HTTP_201_CREATED if creado else status.HTTP_200_OK,
        )


class RefreshView(LoginLocalMixin, TokenRefreshView):
    pass


class YoView(generics.RetrieveUpdateDestroyAPIView):
    """Perfil del usuario: presupuesto, personas, rutina de comidas... DELETE borra la cuenta y todos sus datos."""

    serializer_class = UsuarioSerializer

    def get_object(self):
        return self.request.user
