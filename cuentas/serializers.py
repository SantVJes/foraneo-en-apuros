from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from catalogo.models import RESTRICCIONES, TIPOS_COMIDA, Ingrediente, Supermercado

from .models import Usuario


def limpiar_rutina(value):
    """Valida {"0": ["desayuno", "cena"], ...} (0 = lunes) y ordena las comidas."""
    error = serializers.ValidationError('Usa {"0": ["desayuno", "cena"], ...} con 0 = lunes.')
    if not isinstance(value, dict):
        raise error
    tipos = {t for t, _ in TIPOS_COMIDA}
    limpio = {}
    for dia, comidas in value.items():
        if str(dia) not in {str(d) for d in range(7)} or not isinstance(comidas, list) or set(comidas) - tipos:
            raise error
        limpio[str(dia)] = [t for t, _ in TIPOS_COMIDA if t in comidas]
    return limpio


def tokens_para(usuario):
    refresh = RefreshToken.for_user(usuario)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class SustitucionSerializer(serializers.Serializer):
    original_id = serializers.PrimaryKeyRelatedField(queryset=Ingrediente.objects.all())
    reemplazo_id = serializers.PrimaryKeyRelatedField(queryset=Ingrediente.objects.all())
    original = serializers.CharField(read_only=True)
    reemplazo = serializers.CharField(read_only=True)


class UsuarioSerializer(serializers.ModelSerializer):
    membresias = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=Supermercado.objects.filter(requiere_membresia=True),
        help_text="Ids de los súper con membresía que tienes (Costco, Sam's)",
    )
    ingredientes_excluidos = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=Ingrediente.objects.all(), help_text="Ids de ingredientes que no comes"
    )
    restricciones = serializers.ListField(
        child=serializers.ChoiceField(choices=RESTRICCIONES), required=False,
        help_text='Alergias o dieta, ej. ["lacteos", "mariscos", "carne"]',
    )
    sustituciones = serializers.SerializerMethodField()
    es_pro = serializers.BooleanField(read_only=True)
    cambios = SustitucionSerializer(many=True, write_only=True, required=False,
                                    help_text='Ej. [{"original_id": 3, "reemplazo_id": 4}] para usar aceite de oliva')

    class Meta:
        model = Usuario
        fields = ("id", "email", "first_name", "last_name", "presupuesto_semanal", "personas",
                  "lat", "lng", "radio_km", "modo_compra", "membresias", "restricciones",
                  "ingredientes_excluidos", "sustituciones", "cambios", "meta_kcal", "objetivo",
                  "rutina_comidas", "es_pro", "pro_hasta")
        read_only_fields = ("id", "email", "es_pro", "pro_hasta")

    def get_sustituciones(self, obj):
        return [{"original_id": s.original_id, "original": s.original.nombre,
                 "reemplazo_id": s.reemplazo_id, "reemplazo": s.reemplazo.nombre}
                for s in obj.sustituciones.select_related("original", "reemplazo")]

    def validate_rutina_comidas(self, value):
        return limpiar_rutina(value)

    def validate_personas(self, value):
        if not (1 <= value <= 20):
            raise serializers.ValidationError("Entre 1 y 20 personas.")
        return value

    def validate_presupuesto_semanal(self, value):
        if not (0 <= value <= 100000):
            raise serializers.ValidationError("Pon un presupuesto entre 0 y 100,000.")
        return value

    def validate_radio_km(self, value):
        if not (0.5 <= value <= 50):
            raise serializers.ValidationError("Elige una distancia entre 0.5 y 50 km.")
        return value

    def update(self, instance, validated_data):
        cambios = validated_data.pop("cambios", None)
        instance = super().update(instance, validated_data)
        if cambios is not None:
            from despensa.models import Sustitucion

            instance.sustituciones.all().delete()
            for c in cambios:
                if c["original_id"] != c["reemplazo_id"]:
                    Sustitucion.objects.update_or_create(
                        usuario=instance, original=c["original_id"], defaults={"reemplazo": c["reemplazo_id"]}
                    )
        return instance


class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = Usuario
        fields = ("email", "password", "first_name", "last_name", "presupuesto_semanal", "personas")

    def validate_email(self, value):
        value = value.lower()
        if Usuario.objects.filter(email=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return value

    def validate(self, attrs):
        validate_password(attrs["password"], Usuario(email=attrs["email"]))
        return attrs

    def create(self, validated_data):
        return Usuario.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(style={"input_type": "password"})

    def validate(self, attrs):
        usuario = authenticate(
            request=self.context.get("request"),
            email=attrs["email"].lower(),
            password=attrs["password"],
        )
        if not usuario:
            raise serializers.ValidationError("Correo o contraseña incorrectos.")
        attrs["usuario"] = usuario
        return attrs


class GoogleLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField(help_text="id_token que regresa Google Sign-In en la app")
