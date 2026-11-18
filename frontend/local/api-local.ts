/* La API de Foráneo en apuros, completa, corriendo dentro del navegador.
   Es la misma lógica que el servidor Django (catalogo, despensa, salud, pro), pasada a TypeScript.
   Todo se guarda en este navegador (localStorage); el catálogo de platillos, ingredientes y precios va incluido.
   Lo único que sale a internet es opcional: buscar súper cercanos (OpenStreetMap) y direcciones (Nominatim). */

import CATALOGO from "./catalogo.json";

type Num = number;
type Ing = { id: Num; nombre: string; categoria: string; unidad_base: "g" | "ml" | "pieza"; tamano_paquete: Num; nombre_paquete: string;
  restricciones: string[]; es_basico: boolean; kcal: Num; proteina: Num; carbohidratos: Num; grasa: Num };
type Plat = { id: Num; nombre: string; descripcion: string; tipo_comida: string; dificultad: string; estilo: string; tiempo_minutos: Num;
  porciones: Num; pasos: string; imagen_url: string; ing: [Num, Num][];
  // solo recetas de la gente:
  autor?: "yo" | string; publica?: boolean; codigo?: string | null; creado?: string; guardados_extra?: Num; cocinadas_extra?: Num };
type Sup = { id: Num; nombre: string; sitio_web: string; requiere_membresia: boolean; color: string; nombres_mapa: string[]; url_busqueda: string };
type PrecioRow = [Num, Num, string, Num, Num, Num | null, string, string];
type Sucursal = { supermercado_id: Num; nombre: string; direccion: string; lat: Num; lng: Num; osm_id: string };
type PlanDB = { id: Num; nombre: string; fecha_inicio: string; presupuesto: Num; personas: Num; comidas: string[]; dificultades: string[];
  comidas_por_dia: Record<string, string[]>; creado: string; menu: { id: Num; dia: Num; tipo_comida: string; platillo_id: Num | null }[] };
type Articulo = { id: Num; ingrediente_id: Num; cantidad: Num; unidad: string; fraccion: string; actualizado: string };
type DB = {
  v: 1; seq: Num;
  usuario: {
    first_name: string; email: string; presupuesto_semanal: Num; personas: Num; lat: Num | null; lng: Num | null; radio_km: Num;
    modo_compra: "varios" | "un_super"; membresias: Num[]; restricciones: string[]; ingredientes_excluidos: Num[]; meta_kcal: Num;
    objetivo: string; rutina_comidas: Record<string, string[]>;
  };
  sustituciones: { original_id: Num; reemplazo_id: Num }[];
  alacena: Articulo[]; planes: PlanDB[]; recetas: Plat[]; guardadas: Num[]; cocinadas: Num[]; reportadas: Num[];
  salud: { perfil: Record<string, unknown> | null; pesos: { fecha: string; peso_kg: Num }[] };
  sucursales: Sucursal[]; zonas: string[];
};

const ING: Ing[] = (CATALOGO as { ingredientes: Ing[] }).ingredientes;
const PLATILLOS: Plat[] = (CATALOGO as unknown as { platillos: Plat[] }).platillos;
const SUPERS: Sup[] = (CATALOGO as { supermercados: Sup[] }).supermercados;
const PRECIOS: PrecioRow[] = (CATALOGO as unknown as { precios: PrecioRow[] }).precios;
const ingPorId = new Map(ING.map((i) => [i.id, i]));
const supPorId = new Map(SUPERS.map((s) => [s.id, s]));
const preciosPorIng = new Map<Num, PrecioRow[]>();
for (const p of PRECIOS) { if (!preciosPorIng.has(p[1])) preciosPorIng.set(p[1], []); preciosPorIng.get(p[1])!.push(p); }

const TIPOS_COMIDA: [string, string][] = [["desayuno", "Desayuno"], ["comida", "Comida"], ["cena", "Cena"]];
const ORDEN = TIPOS_COMIDA.map(([t]) => t);
const DIFICULTADES: [string, string][] = [["facil", "Fácil"], ["intermedio", "Intermedio"], ["complicado", "Complicado"]];
const RESTRICCIONES: [string, string][] = [["gluten", "Gluten"], ["lacteos", "Lácteos"], ["huevo", "Huevo"], ["pescado", "Pescado"],
  ["mariscos", "Mariscos"], ["cacahuate", "Cacahuate"], ["nueces", "Nueces"], ["soya", "Soya"], ["carne", "Carne (vegetariano)"],
  ["cerdo", "Cerdo"], ["picante", "Picante"]];
const UNIDADES: [string, string][] = [["g", "gramos"], ["kg", "kilos"], ["ml", "mililitros"], ["l", "litros"], ["pieza", "piezas"],
  ["paquete", "paquetes (botella, bolsa, caja...)"]];
const FRACCIONES: Record<string, Num> = { lleno: 1, tres_cuartos: 0.75, mitad: 0.5, un_tercio: 0.3333, un_cuarto: 0.25, casi_nada: 0.1 };
const FRACCIONES_CHOICES: [string, string][] = [["lleno", "Lleno / completo"], ["tres_cuartos", "Tres cuartos"], ["mitad", "La mitad"],
  ["un_tercio", "Un tercio"], ["un_cuarto", "Un cuarto"], ["casi_nada", "Casi nada"]];
const CONVERSIONES: Record<string, [string, Num]> = { g: ["g", 1], kg: ["g", 1000], ml: ["ml", 1], l: ["ml", 1000], pieza: ["pieza", 1] };
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const PARTE_DEL_DIA: Record<string, Num> = { desayuno: 0.25, comida: 0.4, cena: 0.35 };
const ID_RECETAS = 100000;

// ------------------------------------------------------------------ errores y formato

export class ErrorLocal extends Error {
  constructor(public status: number, public data: Record<string, unknown>) { super(String(data.detail ?? Object.values(data).flat().join(" "))); }
}
const falla = (status: number, data: Record<string, unknown> | string): never => {
  throw new ErrorLocal(status, typeof data === "string" ? { detail: data } : data);
};
const d2 = (x: Num) => (Math.round((x + Number.EPSILON) * 100) / 100).toFixed(2);
const d1 = (x: Num) => (Math.round((x + Number.EPSILON) * 10) / 10).toFixed(1);
const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const ahora = () => new Date().toISOString();

// ------------------------------------------------------------------ almacenamiento

const CLAVE = "fa_local_v1";
function nueva(): DB {
  return {
    v: 1, seq: 1,
    usuario: { first_name: "", email: "", presupuesto_semanal: 0, personas: 1, lat: null, lng: null, radio_km: 5, modo_compra: "varios",
      membresias: [], restricciones: [], ingredientes_excluidos: [], meta_kcal: 2000, objetivo: "mantener", rutina_comidas: {} },
    sustituciones: [], alacena: [], planes: [], recetas: [], guardadas: [], cocinadas: [], reportadas: [],
    salud: { perfil: null, pesos: [] }, sucursales: [], zonas: [],
  };
}
let memoria: DB | null = null;
function db(): DB {
  if (memoria) return memoria;
  try { memoria = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch { memoria = null; }
  if (!memoria || memoria.v !== 1) memoria = nueva();
  return memoria;
}
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(db())); } catch { /* sin espacio o modo privado: vive en memoria */ } }
const nuevoId = () => db().seq++;
export function yaEmpezo() { return db().planes.length > 0 || db().usuario.presupuesto_semanal > 0; }
export function borrarTodo() { memoria = nueva(); try { localStorage.removeItem(CLAVE); } catch { /* nada */ } }

// ------------------------------------------------------------------ platillos

function todosLosPlatillos(): Plat[] { return [...PLATILLOS, ...db().recetas]; }
function platillo(id: Num): Plat | undefined { return id >= ID_RECETAS ? db().recetas.find((r) => r.id === id) : PLATILLOS.find((p) => p.id === id); }
const esComunidad = (p: Plat) => p.autor !== undefined;
const visible = (p: Plat) => !esComunidad(p) || p.autor === "yo" || (p.publica && !db().reportadas.includes(p.id)) || db().guardadas.includes(p.id);
const paraPlanear = (p: Plat) => !esComunidad(p) || p.autor === "yo" || db().guardadas.includes(p.id);

function contiene(p: Plat) { return [...new Set(p.ing.flatMap(([i]) => ingPorId.get(i)?.restricciones || []))].sort(); }
function nutricionPorcion(p: Plat) {
  let kcal = 0, prot = 0;
  const porc = p.porciones || 1;
  for (const [id, cant] of p.ing) {
    const i = ingPorId.get(id); if (!i) continue;
    const f = i.unidad_base === "pieza" ? cant / porc : cant / porc / 100;
    kcal += i.kcal * f; prot += i.proteina * f;
  }
  return { kcal: Math.round(kcal), proteina: Math.round(prot) };
}
function corto(p: Plat) {
  return { id: p.id, nombre: p.nombre, tipo_comida: p.tipo_comida, dificultad: p.dificultad,
    dificultad_display: DIFICULTADES.find(([v]) => v === p.dificultad)?.[1] || p.dificultad, estilo: p.estilo,
    tiempo_minutos: p.tiempo_minutos, porciones: p.porciones, imagen_url: p.imagen_url || "",
    fuente: esComunidad(p) ? "comunidad" : "propio", contiene: contiene(p), nutricion_porcion: nutricionPorcion(p) };
}
function detalle(p: Plat) {
  return { ...corto(p), descripcion: p.descripcion || "", pasos: p.pasos || "",
    ingredientes: p.ing.map(([id, cant]) => { const i = ingPorId.get(id)!; return { ingrediente_id: id, nombre: i.nombre, cantidad: d2(cant), unidad: i.unidad_base, es_basico: i.es_basico }; }) };
}
function receta(p: Plat) {
  const d = db();
  const guardada = d.guardadas.includes(p.id), cocinada = d.cocinadas.includes(p.id);
  return { ...detalle(p), publica: !!p.publica, codigo: p.codigo ?? null, autor_id: p.autor === "yo" ? 1 : esComunidad(p) ? 2 : null,
    autor_nombre: !esComunidad(p) ? "Foráneo en apuros" : p.autor === "yo" ? ((d.usuario.first_name || "Tú").split(" ")[0]) : String(p.autor),
    es_mia: p.autor === "yo", guardada, guardados: (p.guardados_extra || 0) + (guardada ? 1 : 0),
    cocinada, cocinadas: (p.cocinadas_extra || 0) + (cocinada ? 1 : 0), creado: p.creado ?? null };
}

/** ?dificultad=facil,intermedio&tipo_comida=cena&max_minutos=30&search=...  */
function filtrar(lista: Plat[], q: URLSearchParams) {
  const vals = (k: string) => q.getAll(k).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  const dif = vals("dificultad"), tipo = vals("tipo_comida"), max = Number(q.get("max_minutos")) || 0, estilo = q.get("estilo");
  const busca = (q.get("search") || "").trim().toLowerCase();
  return lista.filter((p) => (!dif.length || dif.includes(p.dificultad)) && (!tipo.length || tipo.includes(p.tipo_comida))
    && (!max || p.tiempo_minutos <= max) && (!estilo || p.estilo.toLowerCase() === estilo.toLowerCase())
    && (!busca || [p.nombre, p.descripcion, ...p.ing.map(([i]) => ingPorId.get(i)?.nombre || "")].some((t) => t.toLowerCase().includes(busca))));
}

// ------------------------------------------------------------------ gustos

class Gustos {
  restricciones: Set<string>; excluidos: Set<Num>; cambios: Map<Num, Ing>;
  constructor() {
    const u = db().usuario;
    this.restricciones = new Set(u.restricciones);
    this.excluidos = new Set(u.ingredientes_excluidos);
    this.cambios = new Map(db().sustituciones.map((s) => [s.original_id, ingPorId.get(s.reemplazo_id)!]).filter(([, r]) => r) as [Num, Ing][]);
  }
  resolver(i: Ing) { return this.cambios.get(i.id) || i; }
  permite(p: Plat) {
    return p.ing.every(([id]) => { const i = this.resolver(ingPorId.get(id)!); return !this.excluidos.has(i.id) && !i.restricciones.some((r) => this.restricciones.has(r)); });
  }
}
const permitidos = (lista: Plat[]) => { const g = new Gustos(); return lista.filter((p) => g.permite(p)); };

// ------------------------------------------------------------------ plan semanal

const comidasDelDia = (plan: PlanDB, dia: Num) => { const s = plan.comidas_por_dia[String(dia)]; return plan.comidas.filter((t) => !s || s.includes(t)); };
const candidatos = (plan: PlanDB, tipo: string) =>
  permitidos(todosLosPlatillos().filter((p) => paraPlanear(p) && p.tipo_comida === tipo && (!plan.dificultades.length || plan.dificultades.includes(p.dificultad))));
const tieneMeta = () => !!db().salud.perfil;
function nutrientes(i: Ing, cant: Num) { const f = i.unidad_base === "pieza" ? cant : cant / 100; return { kcal: i.kcal * f, proteina: i.proteina * f, carbohidratos: i.carbohidratos * f, grasa: i.grasa * f }; }
const kcalPlatillo = (p: Plat, g: Gustos) => p.ing.reduce((s, [id, c]) => s + nutrientes(g.resolver(ingPorId.get(id)!), c / p.porciones).kcal, 0);
function barajar<T>(a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function generarPlan(plan: PlanDB, ajustar = true) {
  plan.menu = [];
  const conMeta = tieneMeta(), g = new Gustos();
  for (const tipo of ORDEN.filter((t) => plan.comidas.includes(t))) {
    const dias = [0, 1, 2, 3, 4, 5, 6].filter((d) => comidasDelDia(plan, d).includes(tipo));
    let op = barajar(candidatos(plan, tipo));
    if (conMeta && op.length) {
      const objetivo = db().usuario.meta_kcal * PARTE_DEL_DIA[tipo];
      op.sort((a, b) => Math.abs(kcalPlatillo(a, g) - objetivo) - Math.abs(kcalPlatillo(b, g) - objetivo));
      op = barajar(op.slice(0, Math.max(dias.length, Math.min(op.length, 8))));
    }
    dias.forEach((dia, i) => plan.menu.push({ id: nuevoId(), dia, tipo_comida: tipo, platillo_id: op.length ? op[i % op.length].id : null }));
  }
  if (ajustar && plan.presupuesto > 0) ajustarAPresupuesto(plan);
}

function costoPlatillo(p: Plat, personas: Num, g: Gustos, cache: Map<Num, Num>) {
  if (cache.has(p.id)) return cache.get(p.id)!;
  let total = 0;
  for (const [id, cant] of p.ing) {
    const of = preciosPorIng.get(g.resolver(ingPorId.get(id)!).id) || [];
    if (of.length) total += Math.min(...of.map((o) => o[4] / o[3])) * cant * personas / p.porciones;
  }
  cache.set(p.id, total);
  return total;
}
function ajustarAPresupuesto(plan: PlanDB, maxCambios = 30, maxRep = 2) {
  const g = new Gustos(), cache = new Map<Num, Num>();
  const costo = (p: Plat) => costoPlatillo(p, plan.personas, g, cache);
  for (let n = 0; n < maxCambios; n++) {
    if (listaDeCompras(plan, undefined, undefined, true).totalNum <= plan.presupuesto) return;
    const comidas = plan.menu.filter((c) => c.platillo_id !== null);
    const veces = new Map<Num, Num>();
    comidas.forEach((c) => veces.set(c.platillo_id!, (veces.get(c.platillo_id!) || 0) + 1));
    comidas.sort((a, b) => costo(platillo(b.platillo_id!)!) - costo(platillo(a.platillo_id!)!));
    let cambiado = false;
    for (const c of comidas) {
      const actual = costo(platillo(c.platillo_id!)!);
      const baratos = candidatos(plan, c.tipo_comida).filter((p) => (veces.get(p.id) || 0) < maxRep && costo(p) < actual)
        .sort((a, b) => (veces.get(a.id) || 0) - (veces.get(b.id) || 0) || costo(a) - costo(b));
      if (baratos.length) { c.platillo_id = baratos[0].id; cambiado = true; break; }
    }
    if (!cambiado) return;
  }
}

function planJSON(plan: PlanDB) {
  const orden = (t: string) => ORDEN.indexOf(t);
  const menu = [...plan.menu].sort((a, b) => a.dia - b.dia || orden(a.tipo_comida) - orden(b.tipo_comida))
    .map((c) => { const p = c.platillo_id !== null ? platillo(c.platillo_id) : undefined; return { id: c.id, dia: c.dia, nombre_dia: DIAS[c.dia], tipo_comida: c.tipo_comida, platillo: p ? corto(p) : null }; });
  return { id: plan.id, nombre: plan.nombre, fecha_inicio: plan.fecha_inicio, presupuesto: d2(plan.presupuesto), personas: plan.personas,
    comidas: plan.comidas, dificultades: plan.dificultades, comidas_por_dia: plan.comidas_por_dia, menu, creado: plan.creado };
}
function limpiarRutina(v: unknown): Record<string, string[]> {
  if (!v || typeof v !== "object" || Array.isArray(v)) falla(400, { comidas_por_dia: 'Usa {"0": ["desayuno", "cena"], ...} con 0 = lunes.' });
  const out: Record<string, string[]> = {};
  for (const [dia, comidas] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(dia) || !Array.isArray(comidas)) falla(400, { comidas_por_dia: "Rutina inválida." });
    out[dia] = ORDEN.filter((t) => (comidas as string[]).includes(t));
  }
  return out;
}
function lunesDeEstaSemana() {
  const d = new Date(); const dia = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dia);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function buscarPlan(id: Num) { return db().planes.find((p) => p.id === id) || falla(404, "No encontrado."); }

// ------------------------------------------------------------------ súper cercanos (OpenStreetMap)

function distanciaKm(lat1: Num, lng1: Num, lat2: Num, lng2: Num) {
  const r = 6371, rad = Math.PI / 180, dp = (lat2 - lat1) * rad, dl = (lng2 - lng1) * rad;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}
async function actualizarDesdeOSM(lat: Num, lng: Num, radio: Num) {
  const zona = `${lat.toFixed(2)},${lng.toFixed(2)},${Math.ceil(radio)}`;
  if (db().zonas.includes(zona)) return true;
  const q = `[out:json][timeout:25];(nwr["shop"~"supermarket|wholesale|department_store|convenience"](around:${Math.round(radio * 1000)},${lat},${lng}););out center tags;`;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: q }), signal: ctrl.signal });
    if (!r.ok) return false;
    const els: { type: string; id: Num; lat?: Num; lon?: Num; center?: { lat: Num; lon: Num }; tags?: Record<string, string> }[] = (await r.json()).elements || [];
    const d = db();
    for (const el of els) {
      const tags = el.tags || {};
      const texto = ["brand", "name", "operator"].map((k) => tags[k] || "").join(" ").toLowerCase();
      const sup = SUPERS.find((s) => s.nombres_mapa.some((n) => texto.includes(n.toLowerCase())));
      const la = el.lat ?? el.center?.lat, lo = el.lon ?? el.center?.lon;
      if (!sup || la == null || lo == null) continue;
      const osm = `${el.type}/${el.id}`;
      const fila = { supermercado_id: sup.id, nombre: tags.name || sup.nombre, lat: la, lng: lo, osm_id: osm,
        direccion: [tags["addr:street"], tags["addr:housenumber"], tags["addr:suburb"], tags["addr:city"]].filter(Boolean).join(" ") };
      const i = d.sucursales.findIndex((s) => s.osm_id === osm);
      if (i >= 0) d.sucursales[i] = fila; else d.sucursales.push(fila);
    }
    d.zonas.push(zona); guardar();
    return true;
  } catch { return false; } finally { clearTimeout(t); }
}
function cercanosGuardados(lat: Num, lng: Num, radio: Num) {
  const out = new Map<Num, { sucursal: Sucursal; distancia_km: Num }>();
  for (const s of db().sucursales) {
    const dist = distanciaKm(lat, lng, s.lat, s.lng);
    if (dist > radio) continue;
    const act = out.get(s.supermercado_id);
    if (!act || dist < act.distancia_km) out.set(s.supermercado_id, { sucursal: s, distancia_km: Math.round(dist * 100) / 100 });
  }
  return out;
}
async function supermercadosCercanos(lat: Num, lng: Num, radio: Num, consultar = true) {
  let ok = false;
  if (consultar) ok = await actualizarDesdeOSM(lat, lng, radio);
  return { cercanos: cercanosGuardados(lat, lng, radio), mapa_ok: ok };
}
function supermercadosPara(cercanos: Map<Num, { sucursal: Sucursal; distancia_km: Num }>) {
  const u = db().usuario;
  let supers = SUPERS.filter((s) => !s.requiere_membresia || u.membresias.includes(s.id));
  const info = { usa_ubicacion: false, radio_km: u.radio_km, aviso: "" };
  if (u.lat != null && u.lng != null) {
    info.usa_ubicacion = true;
    const cerca = supers.filter((s) => cercanos.has(s.id));
    if (cerca.length) supers = cerca;
    else info.aviso = `No encontramos supermercados a menos de ${d1(u.radio_km)} km. Te mostramos precios de todas las cadenas; prueba con una distancia mayor.`;
  }
  return { supers, info };
}
function infoSuper(s: Sup, cercanos: Map<Num, { sucursal: Sucursal; distancia_km: Num }>) {
  const c = cercanos.get(s.id);
  return { supermercado_id: s.id, supermercado: s.nombre, color: s.color, requiere_membresia: s.requiere_membresia,
    distancia_km: c ? c.distancia_km : null, sucursal: c ? { nombre: c.sucursal.nombre, direccion: c.sucursal.direccion, lat: c.sucursal.lat, lng: c.sucursal.lng } : null };
}
function urlTienda(s: Sup, texto: string) {
  if (s.url_busqueda) return s.url_busqueda.replace("{q}", encodeURIComponent(texto));
  let dominio = s.nombre; try { dominio = new URL(s.sitio_web).host || s.nombre; } catch { /* nada */ }
  return `https://www.google.com/search?q=${encodeURIComponent(texto + " site:" + dominio)}`;
}

// ------------------------------------------------------------------ lista de compras

function necesidades(plan: PlanDB, g: Gustos) {
  const total = new Map<Num, Num>(), ings = new Map<Num, Ing>();
  for (const c of plan.menu) {
    const p = c.platillo_id !== null ? platillo(c.platillo_id) : undefined; if (!p) continue;
    for (const [id, cant] of p.ing) {
      const i = g.resolver(ingPorId.get(id)!);
      total.set(i.id, (total.get(i.id) || 0) + cant * plan.personas / p.porciones); ings.set(i.id, i);
    }
  }
  return { total, ings };
}
function cantidadBase(a: { ingrediente_id: Num; cantidad: Num; unidad: string; fraccion: string }) {
  const i = ingPorId.get(a.ingrediente_id)!;
  if (a.fraccion) return (a.unidad === "paquete" ? a.cantidad : 1) * i.tamano_paquete * (FRACCIONES[a.fraccion] ?? 1);
  if (a.unidad === "paquete") return a.cantidad * i.tamano_paquete;
  const conv = CONVERSIONES[a.unidad] || falla(400, { unidad: "Unidad desconocida." });
  if (conv[0] !== i.unidad_base) falla(400, { unidad: `${i.nombre} se mide en ${i.unidad_base}, no en ${a.unidad}.` });
  return a.cantidad * conv[1];
}

let cercanosCache = new Map<Num, { sucursal: Sucursal; distancia_km: Num }>();
function listaDeCompras(plan: PlanDB, modo?: string, supermercadoId?: Num, rapido = false) {
  const u = db().usuario; modo = modo || u.modo_compra || "varios";
  const g = new Gustos();
  const cercanos = u.lat != null && u.lng != null ? cercanosGuardados(u.lat, u.lng, u.radio_km) : new Map();
  cercanosCache = cercanos;
  const { supers, info } = supermercadosPara(cercanos);
  const supSet = new Set(supers.map((s) => s.id));
  const { total: necesito, ings } = necesidades(plan, g);
  const alacena = new Map(db().alacena.map((a) => [a.ingrediente_id, cantidadBase(a)]));

  type Cot = { supermercado: string; sid: Num; producto: string; presentacion: string; precio_unitario: string; paquetes: Num; costo: string; costoNum: Num; pu: Num; url: string; actualizado: string };
  const faltantes: [Record<string, unknown>, Cot[]][] = [], yaTienes: Record<string, unknown>[] = [], sinPrecio: Record<string, unknown>[] = [];
  for (const [id, nec] of [...necesito.entries()].sort((a, b) => ings.get(a[0])!.nombre.localeCompare(ings.get(b[0])!.nombre))) {
    const i = ings.get(id)!, tengo = alacena.get(id) || 0, falta = Math.max(0, nec - tengo);
    const base = { ingrediente_id: i.id, ingrediente: i.nombre, categoria: i.categoria, es_basico: i.es_basico, unidad: i.unidad_base,
      necesitas: d2(nec), tienes: d2(tengo), falta: d2(falta) };
    if (falta <= 0) { yaTienes.push(base); continue; }
    const cots = (preciosPorIng.get(id) || []).filter((o) => supSet.has(o[0])).map((o) => {
      const paquetes = Math.max(1, Math.ceil(falta / o[3] - 1e-9)); const costo = Math.round(o[4] * paquetes * 100) / 100;
      return { supermercado: supPorId.get(o[0])!.nombre, sid: o[0], producto: o[2], presentacion: d2(o[3]), precio_unitario: d2(o[4]), paquetes,
        costo: d2(costo), costoNum: costo, pu: o[4], url: o[6], actualizado: o[7] };
    }).sort((a, b) => a.costoNum - b.costoNum || a.pu - b.pu);
    if (!cots.length) { sinPrecio.push(base); continue; }
    faltantes.push([base, cots]);
  }
  if (rapido) {
    const t = faltantes.reduce((s, [, c]) => s + c[0].costoNum, 0);
    return { totalNum: t } as { totalNum: Num } & Record<string, unknown>;
  }

  const porSuperTotal = new Map<string, { total: Num; disponibles: Num; sid: Num }>();
  for (const [, cots] of faltantes) {
    const vistos = new Set<string>();
    for (const c of cots) if (!vistos.has(c.supermercado)) {
      vistos.add(c.supermercado);
      const x = porSuperTotal.get(c.supermercado) || { total: 0, disponibles: 0, sid: c.sid };
      x.total += c.costoNum; x.disponibles++; porSuperTotal.set(c.supermercado, x);
    }
  }
  const comparar = [...porSuperTotal.entries()].map(([, d]) => ({ ...infoSuper(supPorId.get(d.sid)!, cercanos), total: d2(d.total), totalNum: d.total,
    tiene_todo: d.disponibles === faltantes.length, productos_disponibles: d.disponibles }))
    .sort((a, b) => Number(!a.tiene_todo) - Number(!b.tiene_todo) || b.productos_disponibles - a.productos_disponibles || a.totalNum - b.totalNum);

  let elegido: string | null = null;
  if (modo === "un_super" && comparar.length) {
    if (supermercadoId != null) elegido = comparar.find((t) => t.supermercado_id === supermercadoId)?.supermercado ?? null;
    elegido = elegido || comparar[0].supermercado;
  }
  const comprar: Record<string, unknown>[] = [];
  const porTienda = new Map<string, { productos: Record<string, unknown>[]; subtotal: Num; sid: Num }>();
  for (const [base, cots] of faltantes) {
    let mejor = cots[0], enOtro = false;
    if (elegido) { const en = cots.filter((c) => c.supermercado === elegido); if (en.length) mejor = en[0]; else enOtro = true; }
    const limpiar = (c: Cot) => { const { costoNum: _c, pu: _p, sid: _s, ...resto } = c; void _c; void _p; void _s; return resto; };
    comprar.push({ ...base, comprar_en: { ...limpiar(mejor), url_compra: urlTienda(supPorId.get(mejor.sid)!, String(base.ingrediente)) },
      en_otro_super: enOtro, comparacion: cots.map(limpiar),
      url_amazon: `https://www.amazon.com.mx/s?k=${encodeURIComponent(String(base.ingrediente))}` });
    const t = porTienda.get(mejor.supermercado) || { productos: [], subtotal: 0, sid: mejor.sid };
    t.productos.push({ ingrediente: base.ingrediente, producto: mejor.producto, paquetes: mejor.paquetes, costo: mejor.costo });
    t.subtotal += mejor.costoNum; porTienda.set(mejor.supermercado, t);
  }
  const total = comprar.reduce((s, i) => s + Number((i.comprar_en as Cot).costo), 0);
  return {
    totalNum: total, plan_id: plan.id, modo, supermercado_elegido: elegido, ubicacion: info,
    presupuesto: d2(plan.presupuesto), total: d2(total), restante: d2(plan.presupuesto - total), dentro_del_presupuesto: total <= plan.presupuesto,
    comprar,
    por_supermercado: [...porTienda.entries()].sort((a, b) => b[1].subtotal - a[1].subtotal)
      .map(([, d]) => ({ ...infoSuper(supPorId.get(d.sid)!, cercanos), subtotal: d2(d.subtotal), productos: d.productos })),
    todo_en_un_solo_supermercado: comparar.map(({ totalNum: _t, ...r }) => { void _t; return r; }),
    ya_tienes_en_alacena: yaTienes, sin_precio: sinPrecio,
  };
}

// ------------------------------------------------------------------ nutrición (del Plan Pro, aquí libre)

function nutricionPlan(plan: PlanDB) {
  const u = db().usuario, g = new Gustos(), meta = u.meta_kcal;
  const K = ["kcal", "proteina", "carbohidratos", "grasa"] as const;
  const dias = DIAS.map(() => ({ comidas: [] as Record<string, unknown>[], kcal: 0, proteina: 0, carbohidratos: 0, grasa: 0 }));
  for (const c of plan.menu) {
    const p = c.platillo_id !== null ? platillo(c.platillo_id) : undefined; if (!p) continue;
    const tot = { kcal: 0, proteina: 0, carbohidratos: 0, grasa: 0 };
    for (const [id, cant] of p.ing) { const n = nutrientes(g.resolver(ingPorId.get(id)!), cant / p.porciones); K.forEach((k) => (tot[k] += n[k])); }
    dias[c.dia].comidas.push({ tipo_comida: c.tipo_comida, platillo: p.nombre, ...Object.fromEntries(K.map((k) => [k, d1(tot[k])])) });
    K.forEach((k) => (dias[c.dia][k] += tot[k]));
  }
  const lista = dias.map((d, n) => {
    const metaDia = meta ? Math.floor(meta * comidasDelDia(plan, n).reduce((s, t) => s + PARTE_DEL_DIA[t], 0)) : 0;
    return { dia: n, nombre_dia: DIAS[n], comidas: d.comidas, ...Object.fromEntries(K.map((k) => [k, d1(d[k])])), _k: d.kcal, _p: d.proteina,
      _c: d.carbohidratos, _g: d.grasa, meta_dia: metaDia, pct_meta: metaDia ? Math.floor(d.kcal / metaDia * 100) : null };
  });
  const con = lista.filter((d) => d.comidas.length).length ? lista.filter((d) => d.comidas.length) : lista;
  const prom = { kcal: con.reduce((s, d) => s + d._k, 0) / con.length, proteina: con.reduce((s, d) => s + d._p, 0) / con.length,
    carbohidratos: con.reduce((s, d) => s + d._c, 0) / con.length, grasa: con.reduce((s, d) => s + d._g, 0) / con.length };
  const metaProm = Math.round(con.reduce((s, d) => s + d.meta_dia, 0) / con.length);
  const consejos: string[] = [];
  if (prom.kcal < metaProm * 0.85) consejos.push(`Comes menos de lo que buscas (${prom.kcal.toFixed(0)} de ${metaProm} kcal al día en lo que planeas).${plan.comidas.length === 3 ? "" : " Prueba agregar el desayuno a tu plan."} También puedes agregar fruta, yogurt o cacahuates entre comidas.`);
  else if (prom.kcal > metaProm * 1.15) consejos.push(`Te pasas de tu meta (${prom.kcal.toFixed(0)} de ${metaProm} kcal al día en lo que planeas). Elige platillos con menos crema, queso o fritura.`);
  else consejos.push("Tus calorías van bien con tu meta.");
  if (prom.kcal && prom.proteina * 4 / prom.kcal < 0.15) consejos.push("Te falta proteína: suma huevo, frijol, lenteja, pollo o atún.");
  if (u.objetivo === "subir" && prom.kcal && prom.proteina * 4 / prom.kcal < 0.2) consejos.push("Para subir masa muscular conviene que al menos 20 % de tus calorías vengan de proteína.");
  return { plan_id: plan.id, meta_kcal: meta, objetivo: u.objetivo, personas: plan.personas,
    promedio: Object.fromEntries(Object.entries(prom).map(([k, v]) => [k, d1(v)])),
    dias: lista.map(({ _k, _p, _c, _g, ...r }) => { void _k; void _p; void _c; void _g; return r; }), consejos,
    nota: "Valores aproximados por persona, calculados con tablas generales de alimentos." };
}

// ------------------------------------------------------------------ salud

const BASE_DIA: Record<string, Num> = { sentado: 1.2, de_pie: 1.375, fisico: 1.55 };
const EXTRA: Record<string, Num> = { "0": 0, "1_2": 0.1, "3_4": 0.2, "5_mas": 0.3 };
const POR_DUR: Record<string, Num> = { corto: 0.5, medio: 1, largo: 1.3 };
const NIVELES: [Num, string][] = [[1.3, "Poco activo"], [1.5, "Algo activo"], [1.7, "Activo"], [9, "Muy activo"]];
const RITMO_KG: Record<string, Num> = { tranquilo: 0.25, normal: 0.5 };
const CAMBIO: Record<string, Num> = { "bajar,tranquilo": -250, "bajar,normal": -500, "subir,tranquilo": 250, "subir,normal": 400 };
const MINIMO: Record<string, Num> = { m: 1200, h: 1500 };
const AVISO = "Es una guía general. Si tienes alguna enfermedad o tomas medicamentos, consulta a tu médico o nutriólogo.";
const medioKilo = (x: Num) => Math.round(x * 2) / 2;
function edad(nac: string, hoy = new Date()) {
  const [y, m, d] = nac.split("-").map(Number);
  return hoy.getFullYear() - y - ((hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) ? 1 : 0);
}
function calcular(pf: Record<string, unknown>, peso: Num) {
  const est = Number(pf.estatura_cm) / 100, anios = edad(String(pf.fecha_nacimiento)), avisos = [AVISO];
  const imc = peso / est ** 2;
  const [cat, catN] = imc < 18.5 ? ["bajo", "Peso bajo"] : imc < 25 ? ["saludable", "Peso saludable"] : imc < 30 ? ["sobrepeso", "Sobrepeso"] : ["obesidad", "Obesidad"];
  const rango = [medioKilo(18.5 * est ** 2), medioKilo(24.9 * est ** 2)], sugerido = medioKilo(22 * est ** 2);
  if (anios < 15) return { disponible: false, edad: anios, avisos: ["Para menores de 15 años no damos metas de peso: el crecimiento cambia todo. Pregúntale a tu pediatra."] };
  const factor = Math.round(Math.min((BASE_DIA[String(pf.dia_tipico)] ?? 1.2) + (EXTRA[String(pf.dias_ejercicio)] ?? 0) * (POR_DUR[String(pf.duracion_ejercicio)] ?? 1), 1.9) * 1000) / 1000;
  const nivel = NIVELES.find(([l]) => factor < l)![1];
  const basal = 10 * peso + 6.25 * Number(pf.estatura_cm) - 5 * anios + (pf.sexo === "h" ? 5 : -161), gasto = basal * factor;
  let meta = String(pf.meta);
  if (meta === "bajar" && imc < 18.5) { meta = "mantener"; avisos.unshift("Tu peso ya está por debajo del rango saludable, así que no te ponemos meta para bajar. Te armamos el plan para mantenerte o subir poco a poco."); }
  if (meta === "bajar" && (anios < 18 || pf.embarazo)) { meta = "mantener"; avisos.unshift("Por tu edad o por embarazo/lactancia no quitamos calorías: el plan es para comer bien y mantenerte. Un médico te puede dar una meta segura."); }
  if (pf.condicion_medica) avisos.unshift("Como tienes una condición médica, revisa esta meta con tu médico antes de empezar.");
  let kcal = gasto + (CAMBIO[`${meta},${pf.ritmo}`] || 0);
  const min = MINIMO[String(pf.sexo)] ?? 1200;
  if (meta === "bajar" && kcal < min) { kcal = Math.min(gasto, min); avisos.push(`Bajamos tu meta solo hasta ${min.toLocaleString("en-US")} kcal al día: menos que eso no es seguro sin médico.`); }
  kcal = Math.round(kcal / 10) * 10;
  let pm: Num;
  if (meta === "mantener") pm = peso;
  else if (pf.peso_meta_kg) pm = Math.max(Number(pf.peso_meta_kg), rango[0]);
  else if (meta === "bajar") pm = imc >= 25 ? rango[1] : Math.max(rango[0], peso - 2);
  else pm = imc < 18.5 ? Math.max(peso + 2, rango[0]) : peso + 2;
  pm = medioKilo(pm);
  if (meta === "bajar" && pm >= peso) pm = peso;
  const dif = Math.abs(peso - pm), semanas = meta !== "mantener" && dif > 0 ? Math.ceil(dif / RITMO_KG[String(pf.ritmo)]) : 0;
  const pp = imc >= 30 ? Math.min(peso, rango[1]) : peso;
  const fecha = new Date(); fecha.setDate(fecha.getDate() + semanas * 7);
  return { disponible: true, edad: anios, peso_kg: Math.round(peso * 10) / 10, imc: Math.round(imc * 10) / 10, categoria: cat, categoria_nombre: catN,
    rango_saludable: { min: rango[0], max: rango[1] }, peso_sugerido: sugerido, meta, peso_meta: pm, kg_por_cambiar: Math.round(dif * 10) / 10,
    semanas, fecha_estimada: semanas ? fecha.toISOString().slice(0, 10) : null, factor_actividad: factor, nivel_actividad: nivel,
    kcal_basal: Math.round(basal), kcal_gasto: Math.round(gasto), kcal_meta: kcal,
    proteina_g: Math.round((meta === "mantener" ? 1.2 : 1.6) * pp / 5) * 5, avisos };
}
function resumenSalud() {
  const s = db().salud;
  const pesos = [...s.pesos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 52);
  const out: Record<string, unknown> = { perfil: null, calculo: null, pesos: [...pesos].reverse() };
  if (!s.perfil) return out;
  out.perfil = { ...s.perfil, estatura_cm: d1(Number(s.perfil.estatura_cm)), peso_meta_kg: s.perfil.peso_meta_kg != null ? d1(Number(s.perfil.peso_meta_kg)) : null };
  if (pesos.length) {
    const c: Record<string, unknown> = calcular(s.perfil, pesos[0].peso_kg);
    c.cambio_total = Math.round((pesos[0].peso_kg - pesos[pesos.length - 1].peso_kg) * 10) / 10;
    c.toca_pesarse = (Date.parse(hoyISO()) - Date.parse(pesos[0].fecha)) / 86400000 >= 7;
    out.calculo = c;
  }
  return out;
}
function aplicarMeta() {
  const r = resumenSalud(), c = r.calculo as Record<string, unknown> | null;
  if (c && c.disponible) { db().usuario.meta_kcal = Number(c.kcal_meta); db().usuario.objetivo = String(c.meta); }
  guardar();
  return r;
}
function guardarPeso(peso: Num, fecha = hoyISO()) {
  if (!(peso >= 25 && peso <= 350)) falla(400, { peso_kg: "Escribe un peso entre 25 y 350 kg." });
  const s = db().salud; const i = s.pesos.findIndex((p) => p.fecha === fecha);
  if (i >= 0) s.pesos[i].peso_kg = Math.round(peso * 10) / 10; else s.pesos.push({ fecha, peso_kg: Math.round(peso * 10) / 10 });
}

// ------------------------------------------------------------------ usuario

function usuarioJSON() {
  const u = db().usuario;
  return { id: 1, email: u.email, first_name: u.first_name, last_name: "", presupuesto_semanal: d2(u.presupuesto_semanal), personas: u.personas,
    lat: u.lat, lng: u.lng, radio_km: d1(u.radio_km), modo_compra: u.modo_compra, membresias: u.membresias, restricciones: u.restricciones,
    ingredientes_excluidos: u.ingredientes_excluidos,
    sustituciones: db().sustituciones.map((s) => ({ original_id: s.original_id, original: ingPorId.get(s.original_id)?.nombre, reemplazo_id: s.reemplazo_id, reemplazo: ingPorId.get(s.reemplazo_id)?.nombre })),
    meta_kcal: u.meta_kcal, objetivo: u.objetivo, rutina_comidas: u.rutina_comidas, es_pro: true, pro_hasta: null };
}
function actualizarUsuario(b: Record<string, unknown>) {
  const u = db().usuario;
  if ("first_name" in b) u.first_name = String(b.first_name ?? "").slice(0, 150);
  if ("presupuesto_semanal" in b) { const v = Number(b.presupuesto_semanal); if (!(v >= 0 && v <= 100000)) falla(400, { presupuesto_semanal: "Pon un presupuesto entre 0 y 100,000." }); u.presupuesto_semanal = v; }
  if ("personas" in b) { const v = Number(b.personas); if (!(v >= 1 && v <= 20)) falla(400, { personas: "Entre 1 y 20 personas." }); u.personas = v; }
  if ("radio_km" in b) { const v = Number(b.radio_km); if (!(v >= 0.5 && v <= 50)) falla(400, { radio_km: "Elige una distancia entre 0.5 y 50 km." }); u.radio_km = v; }
  if ("lat" in b) u.lat = b.lat == null ? null : Number(b.lat);
  if ("lng" in b) u.lng = b.lng == null ? null : Number(b.lng);
  if ("modo_compra" in b) u.modo_compra = b.modo_compra === "un_super" ? "un_super" : "varios";
  if ("membresias" in b) u.membresias = (b.membresias as Num[]).filter((id) => supPorId.get(id)?.requiere_membresia);
  if ("restricciones" in b) u.restricciones = (b.restricciones as string[]).filter((r) => RESTRICCIONES.some(([v]) => v === r));
  if ("ingredientes_excluidos" in b) u.ingredientes_excluidos = (b.ingredientes_excluidos as Num[]).filter((id) => ingPorId.has(id));
  if ("meta_kcal" in b) u.meta_kcal = Number(b.meta_kcal) || 2000;
  if ("objetivo" in b) u.objetivo = String(b.objetivo);
  if ("rutina_comidas" in b) u.rutina_comidas = limpiarRutina(b.rutina_comidas);
  if ("cambios" in b) db().sustituciones = (b.cambios as { original_id: Num; reemplazo_id: Num }[])
    .filter((c) => c.original_id !== c.reemplazo_id && ingPorId.has(c.original_id) && ingPorId.has(c.reemplazo_id));
  guardar();
  return usuarioJSON();
}

// ------------------------------------------------------------------ recetas de la gente y compartir

function codificar(p: Plat) {
  const datos = { n: p.nombre, d: p.descripcion, t: p.tipo_comida, f: p.dificultad, m: p.tiempo_minutos, p: p.porciones, s: p.pasos, i: p.ing,
    a: db().usuario.first_name.trim().split(" ")[0] || "Un foráneo" };
  const bytes = new TextEncoder().encode(JSON.stringify(datos));
  let bin = ""; bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodificar(c: string): Plat | null {
  try {
    const bin = atob(c.replace(/-/g, "+").replace(/_/g, "/"));
    const x = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    if (!x || typeof x.n !== "string" || !Array.isArray(x.i)) return null;
    return { id: 0, nombre: x.n.slice(0, 150), descripcion: String(x.d || ""), tipo_comida: ORDEN.includes(x.t) ? x.t : "comida",
      dificultad: DIFICULTADES.some(([v]) => v === x.f) ? x.f : "facil", estilo: "", tiempo_minutos: Number(x.m) || 30, porciones: Number(x.p) || 2,
      pasos: String(x.s || ""), imagen_url: "", ing: (x.i as [Num, Num][]).filter(([id, c2]) => ingPorId.has(id) && c2 > 0),
      autor: String(x.a || "Un foráneo").slice(0, 40), publica: true, codigo: c, creado: ahora() };
  } catch { return null; }
}
function datosReceta(b: Record<string, unknown>, previa?: Plat): Plat {
  const nombre = String(b.nombre ?? previa?.nombre ?? "").trim();
  if (nombre.length < 3) falla(400, { nombre: "Ponle un nombre de al menos 3 letras." });
  let ing = previa?.ing || [];
  if ("ingredientes_entrada" in b) {
    const lista = (b.ingredientes_entrada as { ingrediente_id: Num; cantidad: Num }[]) || [];
    if (!lista.length) falla(400, { ingredientes_entrada: "Agrega al menos un ingrediente." });
    const ids = lista.map((x) => Number(x.ingrediente_id));
    if (new Set(ids).size !== ids.length) falla(400, { ingredientes_entrada: "Hay un ingrediente repetido." });
    ing = lista.map((x) => [Number(x.ingrediente_id), Math.max(0.01, Number(x.cantidad))] as [Num, Num]).filter(([id]) => ingPorId.has(id));
  }
  const tomar = <T,>(k: string, def: T) => (k in b ? (b[k] as T) : def);
  return { id: previa?.id ?? 0, nombre, descripcion: tomar("descripcion", previa?.descripcion ?? ""), tipo_comida: tomar("tipo_comida", previa?.tipo_comida ?? "comida"),
    dificultad: tomar("dificultad", previa?.dificultad ?? "facil"), estilo: tomar("estilo", previa?.estilo ?? ""),
    tiempo_minutos: Number(tomar("tiempo_minutos", previa?.tiempo_minutos ?? 30)), porciones: Number(tomar("porciones", previa?.porciones ?? 2)),
    pasos: tomar("pasos", previa?.pasos ?? ""), imagen_url: "", ing, autor: "yo", publica: !!tomar("publica", previa?.publica ?? false),
    codigo: previa?.codigo ?? null, creado: previa?.creado ?? ahora() };
}

// ------------------------------------------------------------------ alacena

function articuloJSON(a: Articulo) {
  const i = ingPorId.get(a.ingrediente_id)!, base = cantidadBase(a);
  const desc = a.fraccion ? `${FRACCIONES_CHOICES.find(([v]) => v === a.fraccion)?.[1]} de ${i.nombre_paquete} ≈ ${d2(base)} ${i.unidad_base}`
    : `${d2(a.cantidad)} ${a.unidad} = ${d2(base)} ${i.unidad_base}`;
  return { id: a.id, ingrediente_id: a.ingrediente_id, ingrediente: i.nombre, cantidad: d2(a.cantidad), unidad: a.unidad, fraccion: a.fraccion,
    cantidad_base: d2(base), unidad_base: i.unidad_base, descripcion: desc, actualizado: a.actualizado };
}

// ------------------------------------------------------------------ el "servidor"

export async function manejar(method: string, ruta: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const url = new URL(ruta, "http://local");
  const p = url.pathname.replace(/\/+$/, "") + "/";
  const q = url.searchParams;
  const m = (re: RegExp) => p.match(re);
  const d = db();
  let r: RegExpMatchArray | null;

  // ---- perfil
  if (p === "/auth/yo/") {
    if (method === "GET") return usuarioJSON();
    if (method === "PATCH" || method === "PUT") return actualizarUsuario(body);
    if (method === "DELETE") { borrarTodo(); return null; }
  }
  if (p === "/opciones/") {
    const lista = (c: [string, string][]) => c.map(([valor, nombre]) => ({ valor, nombre }));
    return { restricciones: lista(RESTRICCIONES), dificultades: lista(DIFICULTADES), tipos_comida: lista(TIPOS_COMIDA), unidades: lista(UNIDADES),
      fracciones: lista(FRACCIONES_CHOICES), modos_compra: [{ valor: "varios", nombre: "Lo más barato en varios súper" }, { valor: "un_super", nombre: "Todo en un solo súper" }],
      pro_activo: false, planes_gratis: 5, pro_mensual: 19, pro_anual: 200 };
  }

  // ---- catálogo
  if (p === "/supermercados/") return SUPERS.map(({ id, nombre, sitio_web, requiere_membresia, color }) => ({ id, nombre, sitio_web, requiere_membresia, color }));
  if (p === "/supermercados/cercanos/") {
    const lat = Number(q.get("lat") ?? d.usuario.lat), lng = Number(q.get("lng") ?? d.usuario.lng), radio = Number(q.get("radio_km") ?? d.usuario.radio_km);
    if (!isFinite(lat) || !isFinite(lng) || q.get("lat") === null && d.usuario.lat == null) falla(400, "Manda lat y lng, o guarda tu ubicación en tu perfil.");
    if (!(radio >= 0.5 && radio <= 50)) falla(400, { radio_km: "Elige una distancia entre 0.5 y 50 km." });
    const { cercanos, mapa_ok } = await supermercadosCercanos(lat, lng, radio);
    const res = SUPERS.map((s) => { const c = cercanos.get(s.id); return { id: s.id, nombre: s.nombre, sitio_web: s.sitio_web, requiere_membresia: s.requiere_membresia, color: s.color,
      tienes_membresia: d.usuario.membresias.includes(s.id), cerca: !!c, distancia_km: c ? c.distancia_km : null,
      sucursal: c ? { nombre: c.sucursal.nombre, direccion: c.sucursal.direccion, lat: c.sucursal.lat, lng: c.sucursal.lng } : null }; })
      .sort((a, b) => Number(a.distancia_km === null) - Number(b.distancia_km === null) || (a.distancia_km ?? 0) - (b.distancia_km ?? 0) || a.nombre.localeCompare(b.nombre));
    return { radio_km: radio, mapa_consultado: mapa_ok, supermercados: res };
  }
  if (p === "/ubicacion/buscar/") {
    const texto = (q.get("q") || "").trim();
    if (texto.length < 3) falla(400, { q: "Escribe al menos 3 letras." });
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: texto, format: "json", limit: "5", countrycodes: "mx" })}`);
      if (!resp.ok) throw new Error();
      return ((await resp.json()) as { display_name: string; lat: string; lon: string }[]).map((x) => ({ nombre: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }));
    } catch { return falla(503, "El buscador de direcciones no responde. Revisa tu internet o usa tu GPS."); }
  }
  if (p === "/ingredientes/") return ING.map(({ id, nombre, categoria, unidad_base, tamano_paquete, nombre_paquete, restricciones, es_basico }) =>
    ({ id, nombre, categoria, unidad_base, tamano_paquete: d2(tamano_paquete), nombre_paquete, restricciones, es_basico }));
  if ((r = m(/^\/ingredientes\/(\d+)\/precios\/$/))) {
    return (preciosPorIng.get(Number(r[1])) || []).map((o) => ({ supermercado: supPorId.get(o[0])!.nombre, producto: o[2], presentacion: d2(o[3]), precio: d2(o[4]),
      precio_por_unidad: (o[4] / o[3]).toFixed(4), url: o[6], actualizado: o[7] })).sort((a, b) => Number(a.precio_por_unidad) - Number(b.precio_por_unidad));
  }
  if (p === "/platillos/") {
    let lista = filtrar(todosLosPlatillos().filter(visible), q);
    if (["1", "true", "si"].includes(q.get("para_mi") || "")) lista = permitidos(lista);
    return lista.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(corto);
  }
  if ((r = m(/^\/platillos\/(\d+)\/$/))) { const pl = platillo(Number(r[1])); if (!pl || !visible(pl)) falla(404, "No encontrado."); return detalle(pl!); }

  // ---- recetas
  if ((r = m(/^\/recetas\/codigo\/([\w-]+)\/$/))) {
    const c = r[1];
    const ya = d.recetas.find((x) => x.codigo === c);
    if (ya) return receta(ya);
    const nueva2 = decodificar(c);
    if (!nueva2) falla(404, "Esa receta ya no existe.");
    nueva2!.id = ID_RECETAS + nuevoId(); d.recetas.push(nueva2!); guardar();
    return receta(nueva2!);
  }
  if (p === "/recetas/") {
    if (method === "POST") {
      const nueva2 = datosReceta(body); nueva2.id = ID_RECETAS + nuevoId(); nueva2.codigo = codificar(nueva2);
      d.recetas.push(nueva2); guardar(); return receta(nueva2);
    }
    const autor = q.get("autor"), de = q.get("de") || "comunidad";
    let lista: Plat[];
    if (autor && /^\d+$/.test(autor)) lista = autor === "1" ? d.recetas.filter((x) => x.autor === "yo") : d.recetas.filter((x) => x.autor !== "yo" && x.publica);
    else if (de === "mias") lista = d.recetas.filter((x) => x.autor === "yo");
    else if (de === "guardadas") lista = todosLosPlatillos().filter((x) => d.guardadas.includes(x.id));
    else lista = d.recetas.filter((x) => x.publica && !d.reportadas.includes(x.id));
    return filtrar(lista, q).sort((a, b) => receta(b).guardados - receta(a).guardados || String(b.creado).localeCompare(String(a.creado))).map(receta);
  }
  if ((r = m(/^\/recetas\/(\d+)\/(guardar|cocinada|reportar)\/$/))) {
    const pl = platillo(Number(r[1])); if (!pl) falla(404, "No encontrado.");
    const id = pl!.id;
    if (r[2] === "reportar") {
      if (pl!.autor === "yo") falla(400, "No puedes reportar tu propia receta.");
      if (!d.reportadas.includes(id)) d.reportadas.push(id); guardar(); return { ok: true };
    }
    const lista = r[2] === "guardar" ? d.guardadas : d.cocinadas;
    const i = lista.indexOf(id); if (i >= 0) lista.splice(i, 1); else lista.push(id);
    guardar();
    const rec = receta(pl!);
    return r[2] === "guardar" ? { guardada: rec.guardada, guardados: rec.guardados } : { cocinada: rec.cocinada, cocinadas: rec.cocinadas };
  }
  if ((r = m(/^\/recetas\/(\d+)\/$/))) {
    const id = Number(r[1]);
    if (method === "GET") { const pl = platillo(id); if (!pl || !visible(pl)) falla(404, "No encontrado."); return receta(pl!); }
    const i = d.recetas.findIndex((x) => x.id === id && x.autor === "yo"); if (i < 0) falla(404, "No encontrado.");
    if (method === "DELETE") { d.recetas.splice(i, 1); d.planes.forEach((pl) => pl.menu.forEach((c) => { if (c.platillo_id === id) c.platillo_id = null; })); guardar(); return null; }
    const act = datosReceta(body, d.recetas[i]); act.codigo = codificar(act); d.recetas[i] = act; guardar(); return receta(act);
  }

  // ---- planes
  if (p === "/planes/") {
    if (method === "POST") {
      const comidas = [...new Set((body.comidas as string[]) || [])].filter((t) => ORDEN.includes(t));
      if (!comidas.length) falla(400, { comidas: "Elige al menos una comida." });
      const plan: PlanDB = { id: nuevoId(), nombre: String(body.nombre || ""), fecha_inicio: String(body.fecha_inicio || lunesDeEstaSemana()),
        presupuesto: body.presupuesto != null ? Number(body.presupuesto) : d.usuario.presupuesto_semanal,
        personas: body.personas != null ? Math.min(20, Math.max(1, Number(body.personas))) : d.usuario.personas,
        comidas: ORDEN.filter((t) => comidas.includes(t)), dificultades: ((body.dificultades as string[]) || []).filter((x) => DIFICULTADES.some(([v]) => v === x)),
        comidas_por_dia: body.comidas_por_dia ? limpiarRutina(body.comidas_por_dia) : { ...d.usuario.rutina_comidas }, creado: ahora(), menu: [] };
      if (body.generar !== false) generarPlan(plan, body.ajustar_presupuesto !== false);
      d.planes.push(plan); guardar(); return planJSON(plan);
    }
    return [...d.planes].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio) || b.creado.localeCompare(a.creado)).map(planJSON);
  }
  if ((r = m(/^\/planes\/(\d+)\/(generar|cambiar-platillo|lista-compras|nutricion)\/$/))) {
    const plan = buscarPlan(Number(r[1]));
    if (r[2] === "generar") { generarPlan(plan, body.ajustar_presupuesto !== false); guardar(); return planJSON(plan); }
    if (r[2] === "nutricion") return nutricionPlan(plan);
    if (r[2] === "lista-compras") {
      const u = d.usuario;
      if (u.lat != null && u.lng != null && !cercanosGuardados(u.lat, u.lng, u.radio_km).size) await supermercadosCercanos(u.lat, u.lng, u.radio_km);
      const modo = q.get("modo") || undefined;
      if (modo && !["varios", "un_super"].includes(modo)) falla(400, { modo: "Usa varios o un_super." });
      const { totalNum: _t, ...lista } = listaDeCompras(plan, modo, q.get("supermercado") ? Number(q.get("supermercado")) : undefined); void _t;
      return lista;
    }
    // cambiar-platillo
    const dia = Number(body.dia), tipo = String(body.tipo_comida), pid = body.platillo_id == null ? null : Number(body.platillo_id);
    if (!(dia >= 0 && dia <= 6) || !ORDEN.includes(tipo)) falla(400, "Día o comida inválidos.");
    const pl = pid !== null ? platillo(pid) : undefined;
    if (pid !== null && !pl) falla(400, { platillo_id: "Ese platillo no existe." });
    if (pl && pl.tipo_comida !== tipo) falla(400, { platillo_id: `${pl.nombre} es de ${pl.tipo_comida}, no de ${tipo}.` });
    if (!plan.comidas.includes(tipo)) {
      for (let o = 0; o < 7; o++) plan.comidas_por_dia[String(o)] = comidasDelDia(plan, o);
      plan.comidas = ORDEN.filter((t) => plan.comidas.includes(t) || t === tipo);
    }
    const hoy = comidasDelDia(plan, dia);
    if (pid === null) {
      plan.comidas_por_dia[String(dia)] = hoy.filter((t) => t !== tipo);
      plan.menu = plan.menu.filter((c) => !(c.dia === dia && c.tipo_comida === tipo));
    } else {
      plan.comidas_por_dia[String(dia)] = ORDEN.filter((t) => hoy.includes(t) || t === tipo);
      const c = plan.menu.find((x) => x.dia === dia && x.tipo_comida === tipo);
      if (c) c.platillo_id = pid; else plan.menu.push({ id: nuevoId(), dia, tipo_comida: tipo, platillo_id: pid });
    }
    guardar(); return planJSON(plan);
  }
  if ((r = m(/^\/planes\/(\d+)\/$/))) {
    const plan = buscarPlan(Number(r[1]));
    if (method === "DELETE") { d.planes = d.planes.filter((x) => x.id !== plan.id); guardar(); return null; }
    if (method === "PATCH" || method === "PUT") {
      if ("nombre" in body) plan.nombre = String(body.nombre);
      if ("presupuesto" in body) plan.presupuesto = Number(body.presupuesto);
      if ("personas" in body) plan.personas = Number(body.personas);
      if ("comidas_por_dia" in body) plan.comidas_por_dia = limpiarRutina(body.comidas_por_dia);
      guardar();
    }
    return planJSON(plan);
  }

  // ---- alacena
  if (p === "/alacena/") {
    if (method === "POST") {
      const id = Number(body.ingrediente_id);
      if (!ingPorId.has(id)) falla(400, { ingrediente_id: "Ese ingrediente no existe." });
      if (d.alacena.some((a) => a.ingrediente_id === id)) falla(400, { ingrediente_id: "Ya tienes este ingrediente en tu alacena; actualízalo en lugar de crearlo." });
      const a: Articulo = { id: nuevoId(), ingrediente_id: id, cantidad: body.cantidad != null ? Number(body.cantidad) : 1, unidad: String(body.unidad || "paquete"),
        fraccion: String(body.fraccion || ""), actualizado: ahora() };
      if (a.cantidad < 0) falla(400, { cantidad: "No puede ser negativa." });
      cantidadBase(a); d.alacena.push(a); guardar(); return articuloJSON(a);
    }
    return [...d.alacena].sort((a, b) => ingPorId.get(a.ingrediente_id)!.nombre.localeCompare(ingPorId.get(b.ingrediente_id)!.nombre)).map(articuloJSON);
  }
  if ((r = m(/^\/alacena\/(\d+)\/$/))) {
    const i = d.alacena.findIndex((a) => a.id === Number(r![1])); if (i < 0) falla(404, "No encontrado.");
    if (method === "DELETE") { d.alacena.splice(i, 1); guardar(); return null; }
    if (method === "GET") return articuloJSON(d.alacena[i]);
    const a = { ...d.alacena[i] };
    if ("cantidad" in body) a.cantidad = Number(body.cantidad);
    if ("unidad" in body) a.unidad = String(body.unidad);
    if ("fraccion" in body) a.fraccion = String(body.fraccion || "");
    if (a.cantidad < 0) falla(400, { cantidad: "No puede ser negativa." });
    cantidadBase(a); a.actualizado = ahora(); d.alacena[i] = a; guardar(); return articuloJSON(a);
  }

  // ---- salud
  if (p === "/salud/") {
    if (method === "GET") return resumenSalud();
    if (method === "DELETE") { d.salud = { perfil: null, pesos: [] }; d.usuario.meta_kcal = 2000; d.usuario.objetivo = "mantener"; guardar(); return null; }
    if (!body.acepto) falla(400, { acepto: "Necesitamos tu permiso para guardar tus datos de salud." });
    const est = Number(body.estatura_cm);
    if (!(est >= 120 && est <= 230)) falla(400, { estatura_cm: "Escribe tu estatura entre 120 y 230 cm." });
    const nac = String(body.fecha_nacimiento || "");
    const anios = /^\d{4}-\d{2}-\d{2}$/.test(nac) ? edad(nac) : -1;
    if (anios < 10 || anios > 110) falla(400, { fecha_nacimiento: "Revisa tu fecha de nacimiento." });
    if (!d.salud.perfil && body.peso_kg == null && !d.salud.pesos.length) falla(400, { peso_kg: "Escribe tu peso actual." });
    const campos = ["fecha_nacimiento", "sexo", "estatura_cm", "dia_tipico", "dias_ejercicio", "duracion_ejercicio", "meta", "ritmo", "peso_meta_kg", "embarazo", "condicion_medica"];
    const perfil: Record<string, unknown> = { ...(d.salud.perfil || { consentimiento: ahora(), dia_tipico: "sentado", dias_ejercicio: "0", duracion_ejercicio: "medio", meta: "mantener", ritmo: "tranquilo", peso_meta_kg: null, embarazo: false, condicion_medica: false }) };
    for (const k of campos) if (k in body) perfil[k] = body[k];
    if (perfil.sexo === "h") perfil.embarazo = false;
    d.salud.perfil = perfil;
    if (body.peso_kg != null) guardarPeso(Number(body.peso_kg));
    return aplicarMeta();
  }
  if (p === "/salud/pesos/") {
    if (!d.salud.perfil) falla(400, "Primero llena el cuestionario de tu meta.");
    const fecha = body.fecha ? String(body.fecha) : hoyISO();
    if (fecha > hoyISO()) falla(400, { fecha: "No puede ser una fecha futura." });
    guardarPeso(Number(body.peso_kg), fecha);
    return aplicarMeta();
  }

  // ---- Plan Pro: en esta versión todo es gratis
  if (p === "/ofertas/") {
    const g = new Gustos(), u = d.usuario, plan = [...d.planes].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0];
    const necesito = plan ? new Set(necesidades(plan, g).total.keys()) : new Set<Num>();
    const supers = new Set(supermercadosPara(cercanosCache).supers.map((s) => s.id));
    return PRECIOS.filter((o) => o[5] != null && o[5] > o[4] && supers.has(o[0]) && !u.ingredientes_excluidos.includes(o[1])
      && !ingPorId.get(o[1])!.restricciones.some((x) => u.restricciones.includes(x)))
      .map((o) => ({ ingrediente_id: o[1], ingrediente: ingPorId.get(o[1])!.nombre, supermercado_id: o[0], supermercado: supPorId.get(o[0])!.nombre,
        color: supPorId.get(o[0])!.color, producto: o[2], precio: d2(o[4]), precio_regular: d2(o[5]!), ahorro: d2(o[5]! - o[4]),
        ahorro_pct: Math.round((o[5]! - o[4]) / o[5]! * 100), distancia_km: cercanosCache.get(o[0])?.distancia_km ?? null, para_tu_semana: necesito.has(o[1]) }))
      .sort((a, b) => Number(!a.para_tu_semana) - Number(!b.para_tu_semana) || b.ahorro_pct - a.ahorro_pct).slice(0, 40);
  }

  return falla(404, "No encontrado.");
}

// ------------------------------------------------------------------ respaldo (para pasar tus datos a otro navegador)

export function descargarRespaldo() {
  const blob = new Blob([JSON.stringify(db(), null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `foraneo-respaldo-${hoyISO()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function cargarRespaldo(): Promise<void> {
  return new Promise((ok, mal) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json,.json";
    input.onchange = async () => {
      try {
        const x = JSON.parse(await input.files![0].text());
        if (!x || x.v !== 1 || !x.usuario) throw new Error("Ese archivo no es un respaldo de Foráneo en apuros.");
        memoria = { ...nueva(), ...x }; guardar(); ok();
      } catch (e) { mal(e); }
    };
    input.click();
  });
}
