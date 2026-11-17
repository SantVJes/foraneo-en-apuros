import datetime

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from catalogo.models import DIFICULTADES, TIPOS_COMIDA, Ingrediente, Platillo
from catalogo.serializers import PlatilloListaSerializer
from catalogo.unidades import UnidadIncompatible

from .models import ArticuloAlacena, ComidaPlanificada, PlanSemanal


class ArticuloAlacenaSerializer(serializers.ModelSerializer):
    ingrediente_id = serializers.PrimaryKeyRelatedField(source="ingrediente", queryset=Ingrediente.objects.all())
    ingrediente = serializers.CharField(source="ingrediente.nombre", read_only=True)
    unidad_base = serializers.CharField(source="ingrediente.unidad_base", read_only=True)
    descripcion = serializers.SerializerMethodField()

    class Meta:
        model = ArticuloAlacena
        fields = ("id", "ingrediente_id", "ingrediente", "cantidad", "unidad", "fraccion",
                  "cantidad_base", "unidad_base", "descripcion", "actualizado")
        read_only_fields = ("cantidad_base", "actualizado")

    def get_descripcion(self, obj):
        ing = obj.ingrediente
        if obj.fraccion:
            return f"{obj.get_fraccion_display()} de {ing.nombre_paquete} ≈ {obj.cantidad_base} {ing.unidad_base}"
        return f"{obj.cantidad} {obj.unidad} = {obj.cantidad_base} {ing.unidad_base}"

    def validate(self, attrs):
        usuario = self.context["request"].user
        ing = attrs.get("ingrediente") or self.instance.ingrediente
        if self.instance is None and ArticuloAlacena.objects.filter(usuario=usuario, ingrediente=ing).exists():
            raise serializers.ValidationError(
                {"ingrediente_id": "Ya tienes este ingrediente en tu alacena; actualízalo en lugar de crearlo."}
            )
        if attrs.get("cantidad", 1) < 0:
            raise serializers.ValidationError({"cantidad": "No puede ser negativa."})
        tmp = ArticuloAlacena(
            ingrediente=ing,
            cantidad=attrs.get("cantidad", getattr(self.instance, "cantidad", 1)),
            unidad=attrs.get("unidad", getattr(self.instance, "unidad", "paquete")),
            fraccion=attrs.get("fraccion", getattr(self.instance, "fraccion", "")),
        )
        try:
            tmp.calcular_cantidad_base()
        except UnidadIncompatible as exc:
            raise serializers.ValidationError({"unidad": str(exc)})
        return attrs


class ComidaPlanificadaSerializer(serializers.ModelSerializer):
    nombre_dia = serializers.CharField(read_only=True)
    platillo = PlatilloListaSerializer(read_only=True)

    class Meta:
        model = ComidaPlanificada
        fields = ("id", "dia", "nombre_dia", "tipo_comida", "platillo")


class PlanSemanalSerializer(serializers.ModelSerializer):
    comidas = serializers.ListField(
        child=serializers.ChoiceField(choices=TIPOS_COMIDA), allow_empty=False,
        help_text='Qué comidas quieres al día, ej. ["desayuno","comida","cena"] o ["comida","cena"]',
    )
    dificultades = serializers.ListField(
        child=serializers.ChoiceField(choices=DIFICULTADES), required=False,
        help_text='Vacío = cualquier dificultad. Ej. ["facil","intermedio"]',
    )
    presupuesto = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=0,
                                           max_value=100000,
                                           help_text="Si no se manda, se usa el presupuesto del perfil")
    personas = serializers.IntegerField(min_value=1, max_value=20, required=False)
    fecha_inicio = serializers.DateField(required=False)
    generar = serializers.BooleanField(write_only=True, default=True,
                                       help_text="Llenar la semana automáticamente con platillos variados")
    ajustar_presupuesto = serializers.BooleanField(write_only=True, default=True)
    comidas_por_dia = serializers.JSONField(
        required=False, help_text='Qué comidas sí haces cada día, ej. {"0": ["cena"]}. Si no se manda, se usa tu rutina')
    menu = serializers.SerializerMethodField()

    class Meta:
        model = PlanSemanal
        fields = ("id", "nombre", "fecha_inicio", "presupuesto", "personas", "comidas", "dificultades",
                  "comidas_por_dia", "generar", "ajustar_presupuesto", "menu", "creado")
        read_only_fields = ("creado",)

    @extend_schema_field(ComidaPlanificadaSerializer(many=True))
    def get_menu(self, obj):
        orden = {t: i for i, (t, _) in enumerate(TIPOS_COMIDA)}
        comidas = sorted(obj.comidas_planificadas.all(), key=lambda c: (c.dia, orden[c.tipo_comida]))
        return ComidaPlanificadaSerializer(comidas, many=True).data

    def validate_comidas(self, value):
        return list(dict.fromkeys(value))

    def validate_comidas_por_dia(self, value):
        from cuentas.serializers import limpiar_rutina

        return limpiar_rutina(value)

    def create(self, validated_data):
        usuario = self.context["request"].user
        validated_data.pop("generar", None)
        validated_data.pop("ajustar_presupuesto", None)
        validated_data.setdefault("presupuesto", usuario.presupuesto_semanal)
        validated_data.setdefault("personas", usuario.personas)
        validated_data.setdefault("dificultades", [])
        validated_data.setdefault("comidas_por_dia", usuario.rutina_comidas or {})
        if "fecha_inicio" not in validated_data:
            hoy = datetime.date.today()
            validated_data["fecha_inicio"] = hoy - datetime.timedelta(days=hoy.weekday())
        return PlanSemanal.objects.create(usuario=usuario, **validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("generar", None)
        validated_data.pop("ajustar_presupuesto", None)
        return super().update(instance, validated_data)


class CambiarPlatilloSerializer(serializers.Serializer):
    dia = serializers.IntegerField(min_value=0, max_value=6, help_text="0 = lunes ... 6 = domingo")
    tipo_comida = serializers.ChoiceField(choices=TIPOS_COMIDA)
    platillo_id = serializers.PrimaryKeyRelatedField(
        queryset=Platillo.objects.all(), allow_null=True, help_text="null = ese día no hago esta comida (evento, comedor del trabajo)"
    )


class GenerarSerializer(serializers.Serializer):
    ajustar_presupuesto = serializers.BooleanField(default=True)
