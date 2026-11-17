import datetime
from decimal import Decimal

from rest_framework import serializers

from .models import PerfilSalud, RegistroPeso


class RegistroPesoSerializer(serializers.ModelSerializer):
    peso_kg = serializers.DecimalField(max_digits=5, decimal_places=1, min_value=Decimal("25"), max_value=Decimal("350"))
    fecha = serializers.DateField(required=False)

    class Meta:
        model = RegistroPeso
        fields = ("fecha", "peso_kg")

    def validate_fecha(self, value):
        if value > datetime.date.today():
            raise serializers.ValidationError("No puede ser una fecha futura.")
        return value


class PerfilSaludSerializer(serializers.ModelSerializer):
    acepto = serializers.BooleanField(write_only=True, help_text="Debe ser true: acepta que guardemos sus datos de salud")
    peso_kg = serializers.DecimalField(max_digits=5, decimal_places=1, min_value=Decimal("25"),
                                       max_value=Decimal("350"), write_only=True, required=False,
                                       help_text="Tu peso de hoy (se guarda en tu registro)")
    estatura_cm = serializers.DecimalField(max_digits=4, decimal_places=1, min_value=Decimal("120"),
                                           max_value=Decimal("230"))
    peso_meta_kg = serializers.DecimalField(max_digits=5, decimal_places=1, min_value=Decimal("30"),
                                            max_value=Decimal("300"), required=False, allow_null=True)

    class Meta:
        model = PerfilSalud
        fields = ("acepto", "consentimiento", "fecha_nacimiento", "sexo", "estatura_cm", "peso_kg", "dia_tipico",
                  "dias_ejercicio", "duracion_ejercicio", "meta", "ritmo", "peso_meta_kg", "embarazo",
                  "condicion_medica")
        read_only_fields = ("consentimiento",)

    def validate_acepto(self, value):
        if not value:
            raise serializers.ValidationError("Necesitamos tu permiso para guardar tus datos de salud.")
        return value

    def validate_fecha_nacimiento(self, value):
        hoy = datetime.date.today()
        if not (datetime.date(hoy.year - 110, 1, 1) <= value <= datetime.date(hoy.year - 10, hoy.month, min(hoy.day, 28))):
            raise serializers.ValidationError("Revisa tu fecha de nacimiento.")
        return value

    def validate(self, attrs):
        if self.instance is None and "peso_kg" not in attrs and not self.context["request"].user.pesos.exists():
            raise serializers.ValidationError({"peso_kg": "Escribe tu peso actual."})
        if attrs.get("sexo", getattr(self.instance, "sexo", "")) == "h":
            attrs["embarazo"] = False
        return attrs
