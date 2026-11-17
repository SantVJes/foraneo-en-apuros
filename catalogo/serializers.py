from decimal import Decimal

from rest_framework import serializers

from .models import Ingrediente, Platillo, PlatilloIngrediente, Precio, Supermercado


class IngredienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingrediente
        fields = ("id", "nombre", "categoria", "unidad_base", "tamano_paquete", "nombre_paquete",
                  "restricciones", "es_basico")


class PlatilloIngredienteSerializer(serializers.ModelSerializer):
    ingrediente_id = serializers.IntegerField(source="ingrediente.id")
    nombre = serializers.CharField(source="ingrediente.nombre")
    unidad = serializers.CharField(source="ingrediente.unidad_base")
    es_basico = serializers.BooleanField(source="ingrediente.es_basico")

    class Meta:
        model = PlatilloIngrediente
        fields = ("ingrediente_id", "nombre", "cantidad", "unidad", "es_basico")


class PlatilloListaSerializer(serializers.ModelSerializer):
    dificultad_display = serializers.CharField(source="get_dificultad_display", read_only=True)
    contiene = serializers.SerializerMethodField(help_text="Alergenos o restricciones que tiene el platillo")
    nutricion_porcion = serializers.SerializerMethodField(help_text="kcal y proteína (g) aproximadas de una porción")

    class Meta:
        model = Platillo
        fields = ("id", "nombre", "tipo_comida", "dificultad", "dificultad_display", "estilo",
                  "tiempo_minutos", "porciones", "imagen_url", "fuente", "contiene", "nutricion_porcion")

    def get_contiene(self, obj):
        return sorted({r for pi in obj.ingredientes.all() for r in (pi.ingrediente.restricciones or [])})

    def get_nutricion_porcion(self, obj):
        kcal = proteina = Decimal(0)
        porciones = obj.porciones or 1
        for pi in obj.ingredientes.all():
            ing = pi.ingrediente
            factor = pi.cantidad / porciones if ing.unidad_base == "pieza" else pi.cantidad / porciones / 100
            kcal += ing.kcal * factor
            proteina += ing.proteina * factor
        return {"kcal": round(float(kcal)), "proteina": round(float(proteina))}


class PlatilloDetalleSerializer(PlatilloListaSerializer):
    ingredientes = PlatilloIngredienteSerializer(many=True, read_only=True)

    class Meta(PlatilloListaSerializer.Meta):
        fields = PlatilloListaSerializer.Meta.fields + ("descripcion", "pasos", "ingredientes")


class SupermercadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supermercado
        fields = ("id", "nombre", "sitio_web", "requiere_membresia", "color")


class PrecioSerializer(serializers.ModelSerializer):
    supermercado = serializers.CharField(source="supermercado.nombre")
    precio_por_unidad = serializers.DecimalField(max_digits=12, decimal_places=4, read_only=True)

    class Meta:
        model = Precio
        fields = ("supermercado", "producto", "presentacion", "precio", "precio_por_unidad", "url", "actualizado")


# ---------------------------------------------------------------- recetas de la gente

class RecetaIngredienteEntrada(serializers.Serializer):
    ingrediente_id = serializers.PrimaryKeyRelatedField(queryset=Ingrediente.objects.all())
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))


class RecetaSerializer(PlatilloDetalleSerializer):
    """Receta que escribió alguien. Para crearla mandas ingredientes como [{ingrediente_id, cantidad}]."""

    autor_nombre = serializers.SerializerMethodField()
    es_mia = serializers.SerializerMethodField()
    guardada = serializers.SerializerMethodField()
    guardados = serializers.SerializerMethodField()
    cocinada = serializers.SerializerMethodField()
    cocinadas = serializers.SerializerMethodField()
    ingredientes_entrada = RecetaIngredienteEntrada(many=True, write_only=True, source="nuevos_ingredientes")

    class Meta(PlatilloDetalleSerializer.Meta):
        fields = PlatilloDetalleSerializer.Meta.fields + (
            "publica", "codigo", "autor_id", "autor_nombre", "es_mia", "guardada", "guardados", "cocinada", "cocinadas",
            "creado", "ingredientes_entrada")
        read_only_fields = ("codigo", "creado", "fuente", "autor_id")

    def _yo(self):
        r = self.context.get("request")
        return r.user if r and r.user.is_authenticated else None

    def get_autor_nombre(self, obj):
        if obj.autor_id is None:
            return "Foráneo en apuros"
        return (obj.autor.first_name or "Anónimo").split(" ")[0]

    def get_es_mia(self, obj):
        yo = self._yo()
        return bool(yo and obj.autor_id == yo.id)

    def get_guardada(self, obj):
        yo = self._yo()
        return bool(yo and obj.guardada_por.filter(id=yo.id).exists())

    def get_guardados(self, obj):
        return obj.guardada_por.count()

    def get_cocinada(self, obj):
        yo = self._yo()
        return bool(yo and obj.cocinada_por.filter(id=yo.id).exists())

    def get_cocinadas(self, obj):
        return obj.cocinada_por.count()

    def validate_nombre(self, v):
        v = v.strip()
        if len(v) < 3:
            raise serializers.ValidationError("Ponle un nombre de al menos 3 letras.")
        return v

    def validate_ingredientes_entrada(self, v):
        if not v:
            raise serializers.ValidationError("Agrega al menos un ingrediente.")
        ids = [x["ingrediente_id"].id for x in v]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Hay un ingrediente repetido.")
        return v

    def _guardar_ingredientes(self, platillo, lista):
        platillo.ingredientes.all().delete()
        PlatilloIngrediente.objects.bulk_create(
            PlatilloIngrediente(platillo=platillo, ingrediente=x["ingrediente_id"], cantidad=x["cantidad"]) for x in lista)

    def create(self, data):
        import secrets

        lista = data.pop("nuevos_ingredientes")
        data["autor"] = self._yo()
        data["fuente"] = "comunidad"
        data["codigo"] = secrets.token_urlsafe(6)[:8]
        p = Platillo.objects.create(**data)
        self._guardar_ingredientes(p, lista)
        return p

    def update(self, p, data):
        lista = data.pop("nuevos_ingredientes", None)
        for k, v in data.items():
            setattr(p, k, v)
        p.save()
        if lista is not None:
            self._guardar_ingredientes(p, lista)
        return p
