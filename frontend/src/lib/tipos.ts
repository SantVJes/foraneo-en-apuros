export type Opcion = { valor: string; nombre: string };
export type Opciones = {
  restricciones: Opcion[]; dificultades: Opcion[]; tipos_comida: Opcion[]; unidades: Opcion[];
  fracciones: Opcion[]; modos_compra: Opcion[]; pro_activo?: boolean; planes_gratis?: number;
};
export type Usuario = {
  id: number; email: string; first_name: string; presupuesto_semanal: string; personas: number;
  lat: number | null; lng: number | null; radio_km: string; modo_compra: "varios" | "un_super";
  membresias: number[]; restricciones: string[]; ingredientes_excluidos: number[];
  sustituciones: { original_id: number; original: string; reemplazo_id: number; reemplazo: string }[];
  meta_kcal: number; objetivo: string; es_pro: boolean; rutina_comidas: Record<string, string[]>;
};
export type Supermercado = { id: number; nombre: string; sitio_web: string; requiere_membresia: boolean; color: string };
export type Ingrediente = {
  id: number; nombre: string; categoria: string; unidad_base: "g" | "ml" | "pieza"; tamano_paquete: string;
  nombre_paquete: string; restricciones: string[]; es_basico: boolean;
};
export type PlatilloCorto = {
  id: number; nombre: string; tipo_comida: string; dificultad: string; estilo: string; tiempo_minutos: number;
  porciones: number; imagen_url: string; contiene: string[]; nutricion_porcion?: { kcal: number; proteina: number };
};
export type Platillo = PlatilloCorto & {
  descripcion: string; pasos: string;
  ingredientes: { ingrediente_id: number; nombre: string; cantidad: string; unidad: string; es_basico: boolean }[];
};
export type Comida = { id: number; dia: number; nombre_dia: string; tipo_comida: string; platillo: PlatilloCorto | null };
export type Plan = {
  id: number; nombre: string; fecha_inicio: string; presupuesto: string; personas: number;
  comidas: string[]; dificultades: string[]; comidas_por_dia: Record<string, string[]>; menu: Comida[];
};
export type ArticuloAlacena = {
  id: number; ingrediente_id: number; ingrediente: string; cantidad: string; unidad: string; fraccion: string;
  cantidad_base: string; unidad_base: string; descripcion: string;
};
export type Sucursal = { nombre: string; direccion: string; lat: number; lng: number };
export type InfoSuper = {
  supermercado_id: number; supermercado: string; color: string; requiere_membresia: boolean;
  distancia_km: number | null; sucursal: Sucursal | null;
};
export type Cotizacion = {
  supermercado: string; producto: string; paquetes: number; precio_unitario: string; costo: string; url_compra?: string;
};
export type ItemLista = {
  ingrediente_id: number; ingrediente: string; es_basico: boolean; unidad: string; falta: string;
  comprar_en: Cotizacion & { actualizado?: string | null }; en_otro_super: boolean; url_amazon: string | null;
};
export type ListaCompras = {
  modo: string; supermercado_elegido: string | null; presupuesto: string; total: string; restante: string;
  dentro_del_presupuesto: boolean; ubicacion: { usa_ubicacion: boolean; radio_km: number; aviso: string };
  comprar: ItemLista[];
  por_supermercado: (InfoSuper & { subtotal: string })[];
  todo_en_un_solo_supermercado: (InfoSuper & { total: string; tiene_todo: boolean; productos_disponibles: number })[];
  ya_tienes_en_alacena: { ingrediente: string }[];
  sin_precio: { ingrediente: string; falta: string; unidad: string }[];
};

export type PerfilSalud = {
  consentimiento: string; fecha_nacimiento: string; sexo: "m" | "h"; estatura_cm: string;
  dia_tipico: string; dias_ejercicio: string; duracion_ejercicio: string; meta: "bajar" | "mantener" | "subir";
  ritmo: "tranquilo" | "normal"; peso_meta_kg: string | null; embarazo: boolean; condicion_medica: boolean;
};
export type CalculoSalud = {
  disponible: boolean; edad: number; avisos: string[]; peso_kg?: number; imc?: number; categoria?: string;
  categoria_nombre?: string; rango_saludable?: { min: number; max: number }; peso_sugerido?: number;
  meta?: string; peso_meta?: number; kg_por_cambiar?: number; semanas?: number; fecha_estimada?: string | null;
  factor_actividad?: number; nivel_actividad?: string; kcal_basal?: number; kcal_gasto?: number; kcal_meta?: number;
  proteina_g?: number; cambio_total?: number; toca_pesarse?: boolean;
};
export type Salud = { perfil: PerfilSalud | null; calculo: CalculoSalud | null; pesos: { fecha: string; peso_kg: number }[] };
export type DiaNutricion = { dia: number; nombre_dia: string; kcal: string; proteina: string; meta_dia: number; pct_meta: number | null };
export type Nutricion = { meta_kcal: number; dias: DiaNutricion[]; consejos: string[]; promedio: { kcal: string; proteina: string } };
export type Receta = Platillo & {
  publica: boolean; codigo: string | null; autor_id: number | null; autor_nombre: string; es_mia: boolean; guardada: boolean; guardados: number;
  cocinada: boolean; cocinadas: number; creado: string | null;
};
