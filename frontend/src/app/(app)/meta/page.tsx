"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Briefcase, Coffee, CookingPot, Heartbeat as HeartPulse, Info, MoonStars, ShieldCheck, Trash as Trash2 } from "@phosphor-icons/react";
import { toast } from "sonner";

import { ESCENAS } from "@/components/img-3d";
import { Cabeza, Cargando, Etiqueta } from "@/components/app-shell";
import { NumeroAnimado } from "@/components/numero-animado";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckboxChip } from "@/components/ui/checkbox-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useDatos } from "@/lib/datos";
import type { CalculoSalud, PerfilSalud, Salud } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const DIA_TIPICO = [
  { v: "sentado", t: "Casi todo el día sentado", d: "Escuela, oficina, compu" },
  { v: "de_pie", t: "De pie o caminando", d: "Tienda, mesero, clases de un lado a otro" },
  { v: "fisico", t: "Trabajo físico pesado", d: "Cargar, construir, repartir" },
];
const EJERCICIO = [
  { v: "0", t: "No hago" }, { v: "1_2", t: "1 o 2 días" }, { v: "3_4", t: "3 o 4 días" }, { v: "5_mas", t: "5 o más" },
];
const DURACION = [{ v: "corto", t: "Menos de 30 min" }, { v: "medio", t: "30 a 60 min" }, { v: "largo", t: "Más de 1 hora" }];
const METAS = [
  { v: "bajar", t: "Bajar de peso", d: "Comer un poco menos de lo que gastas" },
  { v: "mantener", t: "Mantenerme", d: "Comer bien sin cambiar de peso" },
  { v: "subir", t: "Subir de peso o músculo", d: "Comer un poco más, con más proteína" },
];
const PASOS = ["Permiso", "Tú", "Tu día", "Tu meta"];
const kg = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 1 }) + " kg";
const miles = (n: number) => Math.round(n).toLocaleString("es-MX");

export default function Meta() {
  const [salud, setSalud] = React.useState<Salud | null>(null);
  const [editando, setEditando] = React.useState(false);

  const cargar = React.useCallback(() => api<Salud>("/salud/").then(setSalud).catch((e) => toast(e.message)), []);
  React.useEffect(() => { cargar(); }, [cargar]);

  if (!salud) return <Cargando texto="Cargando tu meta…" />;
  if (editando || !salud.perfil)
    return <Cuestionario perfil={salud.perfil} pesoActual={salud.calculo?.peso_kg}
      onListo={(s) => { setSalud(s); setEditando(false); toast("Listo, tu meta está calculada."); }}
      onCancelar={salud.perfil ? () => setEditando(false) : undefined} />;
  return <Resultado salud={salud} onCambio={setSalud} onEditar={() => setEditando(true)} onBorrado={cargar} />;
}

/* ------------------------------------------------------------------ cuestionario */

type Respuestas = {
  acepto: boolean; fecha_nacimiento: string; sexo: string; estatura_cm: string; peso_kg: string;
  dia_tipico: string; dias_ejercicio: string; duracion_ejercicio: string; meta: string; ritmo: string;
  peso_meta_kg: string; embarazo: boolean; condicion_medica: boolean;
};

function Cuestionario({ perfil, pesoActual, onListo, onCancelar }: {
  perfil: PerfilSalud | null; pesoActual?: number; onListo: (s: Salud) => void; onCancelar?: () => void;
}) {
  const [paso, setPaso] = React.useState(perfil ? 1 : 0);
  const [enviando, setEnviando] = React.useState(false);
  const [r, setR] = React.useState<Respuestas>({
    acepto: !!perfil, fecha_nacimiento: perfil?.fecha_nacimiento ?? "", sexo: perfil?.sexo ?? "",
    estatura_cm: perfil ? String(Number(perfil.estatura_cm)) : "", peso_kg: pesoActual ? String(pesoActual) : "",
    dia_tipico: perfil?.dia_tipico ?? "sentado", dias_ejercicio: perfil?.dias_ejercicio ?? "0",
    duracion_ejercicio: perfil?.duracion_ejercicio ?? "medio", meta: perfil?.meta ?? "bajar", ritmo: perfil?.ritmo ?? "tranquilo",
    peso_meta_kg: perfil?.peso_meta_kg ? String(Number(perfil.peso_meta_kg)) : "",
    embarazo: perfil?.embarazo ?? false, condicion_medica: perfil?.condicion_medica ?? false,
  });
  const pon = <K extends keyof Respuestas>(k: K, v: Respuestas[K]) => setR((x) => ({ ...x, [k]: v }));

  const est = Number(r.estatura_cm) / 100;
  const rango = est > 1 ? [Math.round(18.5 * est * est * 2) / 2, Math.round(24.9 * est * est * 2) / 2] : null;

  function faltante(): string | null {
    if (paso === 0 && !r.acepto) return "Para seguir necesitamos tu permiso.";
    if (paso === 1) {
      if (!r.fecha_nacimiento) return "Escribe tu fecha de nacimiento.";
      if (!r.sexo) return "Elige mujer u hombre.";
      if (!(Number(r.estatura_cm) >= 120 && Number(r.estatura_cm) <= 230)) return "Escribe tu estatura en centímetros (por ejemplo 168).";
      if (!(Number(r.peso_kg) >= 25 && Number(r.peso_kg) <= 350)) return "Escribe tu peso en kilos (por ejemplo 72.5).";
    }
    return null;
  }

  async function siguiente(e: React.FormEvent) {
    e.preventDefault();
    const f = faltante();
    if (f) return toast(f);
    if (paso < PASOS.length - 1) return setPaso(paso + 1);
    setEnviando(true);
    try {
      const s = await api<Salud>("/salud/", { method: "PUT", body: {
        ...r, peso_meta_kg: r.meta !== "mantener" && r.peso_meta_kg ? r.peso_meta_kg : null,
        embarazo: r.sexo === "m" && r.embarazo,
      } });
      onListo(s);
    } catch (err) { toast((err as Error).message); }
    finally { setEnviando(false); }
  }

  return (
    <div className="pagina grid grid-cols-1 gap-6">
      <Cabeza escena={ESCENAS.meta} etiqueta="Meta de salud" titulo="Cuéntanos de ti">
        Son 4 pasos cortos. Con eso calculamos tu peso saludable, cuánto comer al día y armamos tu menú con esa meta.
      </Cabeza>

      <Card className="ancho-completo gap-6">
        <ol className="grid grid-cols-4 gap-2" aria-label="Pasos">
          {PASOS.map((p, i) => (
            <li key={p} className="grid min-w-0 gap-1.5 text-[0.8rem] leading-tight [overflow-wrap:anywhere]" aria-current={i === paso ? "step" : undefined}>
              <span className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <span className={cn("block h-full rounded-full bg-primary transition-transform duration-500 ease-out origin-left", i <= paso ? "scale-x-100" : "scale-x-0")} />
              </span>
              <span className={cn("text-xs font-semibold", i === paso ? "text-foreground" : "text-muted-foreground")}>{p}</span>
            </li>
          ))}
        </ol>

        <form onSubmit={siguiente} className="grid gap-6">
          <div key={paso} className="entrar-pantalla grid gap-5">
            {paso === 0 && (
              <>
                <div className="flex gap-3 rounded-lg bg-accent p-4">
                  <ShieldCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
                  <div className="grid gap-2 text-sm">
                    <p className="font-semibold text-base">Tus datos de salud son tuyos</p>
                    <p>Tu peso, estatura y edad son datos personales sensibles. Solo los usamos para calcular tu meta y armar tu menú. No los vendemos ni los compartimos, y los puedes borrar cuando quieras desde esta pantalla.</p>
                    <p>Es una guía general: no sustituye a un médico o nutriólogo.</p>
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 has-[:checked]:border-primary has-[:checked]:bg-accent">
                  <input type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" checked={r.acepto} onChange={(e) => pon("acepto", e.target.checked)} />
                  <span>Acepto que Foráneo en apuros guarde mis datos de salud para calcular mi meta.</span>
                </label>
              </>
            )}

            {paso === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5"><Label htmlFor="nac">Fecha de nacimiento</Label>
                  <Input id="nac" type="date" value={r.fecha_nacimiento} onChange={(e) => pon("fecha_nacimiento", e.target.value)} /></div>
                <fieldset className="grid gap-1.5"><legend className="mb-1.5 text-sm font-semibold">Sexo (cambia el cálculo)</legend>
                  <div className="flex flex-wrap gap-2">
                    <CheckboxChip type="radio" name="sexo" checked={r.sexo === "m"} onChange={() => pon("sexo", "m")}>Mujer</CheckboxChip>
                    <CheckboxChip type="radio" name="sexo" checked={r.sexo === "h"} onChange={() => pon("sexo", "h")}>Hombre</CheckboxChip>
                  </div>
                </fieldset>
                <div className="grid gap-1.5"><Label htmlFor="est">Estatura (cm)</Label>
                  <Input id="est" type="number" inputMode="decimal" min={120} max={230} step="0.5" placeholder="168" value={r.estatura_cm} onChange={(e) => pon("estatura_cm", e.target.value)} /></div>
                <div className="grid gap-1.5"><Label htmlFor="peso">Peso de hoy (kg)</Label>
                  <Input id="peso" type="number" inputMode="decimal" min={25} max={350} step="0.1" placeholder="72.5" value={r.peso_kg} onChange={(e) => pon("peso_kg", e.target.value)} /></div>
              </div>
            )}

            {paso === 2 && (
              <>
                <Pregunta titulo="¿Cómo es un día normal tuyo?">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {DIA_TIPICO.map((o) => <Opcion key={o.v} nombre="dia" activo={r.dia_tipico === o.v} onElegir={() => pon("dia_tipico", o.v)} titulo={o.t} detalle={o.d} />)}
                  </div>
                </Pregunta>
                <Pregunta titulo="¿Cuántos días a la semana haces ejercicio?">
                  <div className="flex flex-wrap gap-2">
                    {EJERCICIO.map((o) => <CheckboxChip key={o.v} type="radio" name="ej" checked={r.dias_ejercicio === o.v} onChange={() => pon("dias_ejercicio", o.v)}>{o.t}</CheckboxChip>)}
                  </div>
                </Pregunta>
                {r.dias_ejercicio !== "0" && (
                  <Pregunta titulo="¿Cuánto dura normalmente?">
                    <div className="flex flex-wrap gap-2">
                      {DURACION.map((o) => <CheckboxChip key={o.v} type="radio" name="dur" checked={r.duracion_ejercicio === o.v} onChange={() => pon("duracion_ejercicio", o.v)}>{o.t}</CheckboxChip>)}
                    </div>
                  </Pregunta>
                )}
              </>
            )}

            {paso === 3 && (
              <>
                <Pregunta titulo="¿Qué quieres lograr?">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {METAS.map((o) => <Opcion key={o.v} nombre="meta" activo={r.meta === o.v} onElegir={() => pon("meta", o.v)} titulo={o.t} detalle={o.d} />)}
                  </div>
                </Pregunta>
                {r.meta !== "mantener" && (
                  <>
                    <Pregunta titulo="¿A qué ritmo?">
                      <div className="flex flex-wrap gap-2">
                        <CheckboxChip type="radio" name="ritmo" checked={r.ritmo === "tranquilo"} onChange={() => pon("ritmo", "tranquilo")}>Tranquilo · ¼ kg por semana</CheckboxChip>
                        <CheckboxChip type="radio" name="ritmo" checked={r.ritmo === "normal"} onChange={() => pon("ritmo", "normal")}>Normal · ½ kg por semana</CheckboxChip>
                      </div>
                    </Pregunta>
                    <div className="grid gap-1.5 sm:max-w-sm"><Label htmlFor="pmeta">Peso al que quieres llegar (opcional)</Label>
                      <Input id="pmeta" type="number" inputMode="decimal" step="0.5" placeholder={rango ? `Sugerido: entre ${kg(rango[0])} y ${kg(rango[1])}` : "Lo calculamos por ti"} value={r.peso_meta_kg} onChange={(e) => pon("peso_meta_kg", e.target.value)} />
                      {rango && <p className="text-xs text-muted-foreground">Para tu estatura, el peso saludable va de {kg(rango[0])} a {kg(rango[1])}. Si lo dejas vacío, lo elegimos nosotros.</p>}
                    </div>
                  </>
                )}
                <div className="grid gap-2">
                  {r.sexo === "m" && (
                    <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-[var(--primary)]" checked={r.embarazo} onChange={(e) => pon("embarazo", e.target.checked)} />Estoy embarazada o dando pecho</label>
                  )}
                  <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-[var(--primary)]" checked={r.condicion_medica} onChange={(e) => pon("condicion_medica", e.target.checked)} />Tengo diabetes, presión alta, problemas de riñón o corazón, u otra condición médica</label>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {paso > (perfil ? 1 : 0) && <Button type="button" variant="outline" size="lg" onClick={() => setPaso(paso - 1)}><ArrowLeft />Atrás</Button>}
            <Button type="submit" size="lg" disabled={enviando}>
              {paso < PASOS.length - 1 ? <>Siguiente<ArrowRight /></> : enviando ? "Calculando…" : "Calcular mi meta"}
            </Button>
            {onCancelar && <Button type="button" variant="ghost" onClick={onCancelar}>Cancelar</Button>}
          </div>
        </form>
      </Card>
    </div>
  );
}

function Pregunta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <fieldset className="grid gap-2.5"><legend className="mb-2 font-semibold">{titulo}</legend>{children}</fieldset>;
}

function Opcion({ nombre, activo, onElegir, titulo, detalle }: { nombre: string; activo: boolean; onElegir: () => void; titulo: string; detalle: string }) {
  return (
    <label className={cn("grid min-h-12 cursor-pointer gap-0.5 rounded-lg border bg-card px-4 py-3 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
      activo ? "border-primary bg-accent shadow-[inset_0_0_0_1px_var(--primary)]" : "hover:border-foreground/30")}>
      <input type="radio" name={nombre} className="sr-only" checked={activo} onChange={onElegir} />
      <span className="font-semibold">{titulo}</span>
      <span className="text-sm text-muted-foreground">{detalle}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ resultado */

function Resultado({ salud, onCambio, onEditar, onBorrado }: { salud: Salud; onCambio: (s: Salud) => void; onEditar: () => void; onBorrado: () => void }) {
  const { recargar } = useDatos();
  const c = salud.calculo!;
  const [peso, setPeso] = React.useState("");
  const [borrar, setBorrar] = React.useState(false);

  async function anotar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const s = await api<Salud>("/salud/pesos/", { method: "POST", body: { peso_kg: peso } });
      onCambio(s); setPeso(""); recargar(); toast("Peso anotado.");
    } catch (err) { toast((err as Error).message); }
  }
  async function borrarTodo() {
    if (!borrar) return setBorrar(true);
    try { await api("/salud/", { method: "DELETE" }); recargar(); toast("Borramos tus datos de salud."); onBorrado(); }
    catch (err) { toast((err as Error).message); }
  }

  if (!c.disponible)
    return (
      <div className="pagina grid grid-cols-1 gap-6">
        <Cabeza escena={ESCENAS.meta} etiqueta="Meta de salud" titulo="Por ahora, sin meta de peso" />
        <Card>{c.avisos.map((a) => <p key={a}>{a}</p>)}<Button variant="outline" onClick={borrarTodo}>{borrar ? "¿Seguro? Toca otra vez" : "Borrar mis datos de salud"}</Button></Card>
      </div>
    );

  const titulo = c.meta === "bajar" ? `Llegar a ${kg(c.peso_meta!)}` : c.meta === "subir" ? `Subir a ${kg(c.peso_meta!)}` : "Mantenerte y comer bien";
  return (
    <div className="pagina grid grid-cols-1 gap-6">
      <Cabeza escena={ESCENAS.meta} etiqueta="Tu meta de salud" titulo={titulo}>
        {c.semanas ? <>A tu ritmo son unas <b className="text-foreground">{c.semanas} semanas</b>{c.fecha_estimada && <> (por ahí del {new Date(c.fecha_estimada + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })})</>}. Tu menú ya se arma con estas calorías.</>
          : "Tu menú ya se arma con estas calorías."}
      </Cabeza>

      <div className="entrar-lista grid gap-4 sm:grid-cols-3">
        <Dato etiqueta="Calorías al día" valor={<NumeroAnimado valor={c.kcal_meta!} formato={miles} />} unidad="kcal" destacado
          nota={c.meta === "bajar" ? `Gastas unas ${miles(Math.round(c.kcal_gasto! / 10) * 10)}; comes unas ${miles(Math.round((c.kcal_gasto! - c.kcal_meta!) / 50) * 50)} menos` : c.meta === "subir" ? `Gastas unas ${miles(Math.round(c.kcal_gasto! / 10) * 10)}; comes un poco más` : "Lo que gastas en un día"} />
        <Dato etiqueta="Proteína al día" valor={<NumeroAnimado valor={c.proteina_g!} />} unidad="g" nota="Huevo, frijol, pollo, atún, lenteja" />
        <Dato etiqueta="Actividad" valor={c.nivel_actividad} nota={`Según tu cuestionario (×${c.factor_actividad})`} />
      </div>

      <Reparto kcal={c.kcal_meta!} proteina={c.proteina_g!} />

      <Card className="ancho-completo gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Tu peso</h2>
          <span className="text-sm text-muted-foreground">IMC <b className="font-mono text-foreground">{c.imc}</b> · {c.categoria_nombre}</span>
        </div>
        <RangoPeso c={c} />
        <p className="text-sm text-muted-foreground">
          Peso saludable para tu estatura: <b className="text-foreground">{kg(c.rango_saludable!.min)} a {kg(c.rango_saludable!.max)}</b>. El punto medio es {kg(c.peso_sugerido!)}.
        </p>
      </Card>

      <Card className="gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">Tu registro</h2>
          {c.cambio_total !== undefined && salud.pesos.length > 1 && (
            <span className="font-mono text-sm">{c.cambio_total > 0 ? "+" : ""}{kg(c.cambio_total)} desde que empezaste</span>
          )}
        </div>
        {c.toca_pesarse && <p className="rounded-xl bg-mango/30 px-3 py-2 text-sm">Ya pasó una semana: pésate en la mañana y anótalo.</p>}
        <GraficaPeso pesos={salud.pesos} meta={c.meta !== "mantener" ? c.peso_meta! : undefined} />
        <form onSubmit={anotar} className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5"><Label htmlFor="nuevo-peso">Peso de hoy (kg)</Label>
            <Input id="nuevo-peso" className="w-36" type="number" inputMode="decimal" step="0.1" min={25} max={350} required value={peso} onChange={(e) => setPeso(e.target.value)} /></div>
          <Button type="submit">Anotar</Button>
        </form>
      </Card>

      <Card className="gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Info className="size-5 text-primary" aria-hidden />Para tomar en cuenta</h2>
        <ul className="grid gap-2 text-sm">{c.avisos.map((a) => <li key={a} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{a}</li>)}</ul>
      </Card>

      <div className="ancho-completo flex flex-wrap gap-3">
        <Button size="lg" asChild><Link href="/semana/"><HeartPulse />Armar mi semana con esta meta</Link></Button>
        <Button size="lg" variant="outline" onClick={onEditar}>Cambiar mis respuestas</Button>
        <Button size="lg" variant="ghost" className="text-destructive" onClick={borrarTodo}><Trash2 />{borrar ? "¿Seguro? Toca otra vez" : "Borrar mis datos de salud"}</Button>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor, unidad, nota, destacado }: { etiqueta: string; valor: React.ReactNode; unidad?: string; nota?: string; destacado?: boolean }) {
  return (
    <div className={cn("grid content-start gap-1 rounded-2xl border p-4", destacado ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
      <Etiqueta className={destacado ? "text-primary-foreground" : undefined}>{etiqueta}</Etiqueta>
      <span className="font-mono text-2xl font-bold">{valor}{unidad && <span className="ml-1 text-base font-semibold">{unidad}</span>}</span>
      {nota && <span className={cn("text-sm", destacado ? "text-primary-foreground" : "text-muted-foreground")}>{nota}</span>}
    </div>
  );
}

/** Barra con el rango de peso (bajo, saludable, sobrepeso) y dónde estás tú y tu meta. */
function RangoPeso({ c }: { c: CalculoSalud }) {
  const min = c.rango_saludable!.min, max = c.rango_saludable!.max;
  const desde = Math.min(min * 0.85, c.peso_kg!, c.peso_meta!) - 2;
  const hasta = Math.max(max * 1.25, c.peso_kg!, c.peso_meta!) + 2;
  const pct = (v: number) => ((v - desde) / (hasta - desde)) * 100;
  const pos = (v: number) => `${pct(v)}%`;
  return (
    <div className="grid gap-2 pt-7">
      <div className="relative h-3 rounded-full bg-secondary">
        <span className="crecer absolute inset-y-0 rounded-full bg-primary/70" style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})` }} />
        <Marca x={pct(c.peso_kg!)} texto={`Hoy ${kg(c.peso_kg!)}`} arriba />
        {c.meta !== "mantener" && <Marca x={pct(c.peso_meta!)} texto={`Meta ${kg(c.peso_meta!)}`} meta />}
      </div>
      <div className="mt-7 flex justify-between gap-2 text-xs text-muted-foreground"><span>Bajo</span><span>Saludable</span><span className="text-right">Arriba del rango</span></div>
    </div>
  );
}

function Marca({ x, texto, arriba, meta }: { x: number; texto: string; arriba?: boolean; meta?: boolean }) {
  // La etiqueta se recarga hacia adentro cerca de las orillas para no salirse en pantallas chicas
  const lado = x > 70 ? "right-0" : x < 30 ? "left-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700" style={{ left: `${x}%` }}>
      <span className={cn("block size-5 rounded-full border-[3px] border-card shadow", meta ? "bg-mango" : "bg-foreground")} />
      <span className={cn("absolute whitespace-nowrap font-mono text-xs font-semibold", lado, arriba ? "bottom-6" : "top-6")}>{texto}</span>
    </span>
  );
}

/** Línea del peso en el tiempo, con la meta punteada. Pasa el dedo o el mouse para ver cada día. */
function GraficaPeso({ pesos, meta }: { pesos: { fecha: string; peso_kg: number }[]; meta?: number }) {
  const [activo, setActivo] = React.useState<number | null>(null);
  if (pesos.length < 2)
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Cuando anotes tu peso la próxima semana, aquí verás cómo vas.</p>;
  const W = 600, H = 180, P = { l: 44, r: 12, t: 14, b: 26 };
  const valores = pesos.map((p) => p.peso_kg).concat(meta ?? []);
  const lo = Math.floor(Math.min(...valores) - 1), hi = Math.ceil(Math.max(...valores) + 1);
  const x = (i: number) => P.l + (i / (pesos.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const linea = pesos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.peso_kg).toFixed(1)}`).join(" ");
  const fecha = (f: string) => new Date(f + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const sel = activo !== null ? pesos[activo] : null;
  return (
    <figure className="grid gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-label={`Peso de ${fecha(pesos[0].fecha)} a ${fecha(pesos.at(-1)!.fecha)}: de ${kg(pesos[0].peso_kg)} a ${kg(pesos.at(-1)!.peso_kg)}`}
        onPointerLeave={() => setActivo(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setActivo(Math.max(0, Math.min(pesos.length - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (pesos.length - 1)))));
        }}>
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)" fontFamily="var(--font-mono)">{Math.round(v)}</text>
          </g>
        ))}
        {meta !== undefined && (
          <g>
            <line x1={P.l} x2={W - P.r} y1={y(meta)} y2={y(meta)} stroke="var(--mango-text)" strokeWidth={2} strokeDasharray="6 5" />
            <text x={W - P.r} y={y(meta) - 6} textAnchor="end" fontSize={11} fill="var(--mango-text)" fontWeight={600}>Meta {kg(meta)}</text>
          </g>
        )}
        <path d={linea} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1}
          className="[stroke-dasharray:1] [stroke-dashoffset:1] motion-safe:animate-[dibujar_1s_ease-out_forwards] motion-reduce:[stroke-dashoffset:0]" />
        {activo !== null && <line x1={x(activo)} x2={x(activo)} y1={P.t} y2={H - P.b} stroke="var(--muted-foreground)" strokeWidth={1} />}
        {pesos.map((p, i) => <circle key={p.fecha} cx={x(i)} cy={y(p.peso_kg)} r={i === activo ? 6 : 4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />)}
        <text x={P.l} y={H - 6} fontSize={11} fill="var(--muted-foreground)">{fecha(pesos[0].fecha)}</text>
        <text x={W - P.r} y={H - 6} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">{fecha(pesos.at(-1)!.fecha)}</text>
      </svg>
      <figcaption className="min-h-5 font-mono text-sm" aria-live="polite">{sel ? `${fecha(sel.fecha)}: ${kg(sel.peso_kg)}` : `Último: ${kg(pesos.at(-1)!.peso_kg)}`}</figcaption>
    </figure>
  );
}

const PARTE = { desayuno: 0.25, comida: 0.4, cena: 0.35 } as const;
const COMIDAS = [
  { t: "desayuno", n: "Desayuno", I: Coffee, color: "var(--mango)" },
  { t: "comida", n: "Comida", I: CookingPot, color: "var(--primary)" },
  { t: "cena", n: "Cena", I: MoonStars, color: "var(--cena)" },
] as const;
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Cómo se reparten tus calorías: en cada comida y en cada día de tu semana, según tu rutina. */
function Reparto({ kcal, proteina }: { kcal: number; proteina: number }) {
  const { usuario } = useDatos();
  const rutina = usuario?.rutina_comidas || {};
  const enCasa = (d: number) => rutina[String(d)] ?? ["desayuno", "comida", "cena"];
  const totalCasa = [0, 1, 2, 3, 4, 5, 6].reduce((s, d) => s + enCasa(d).reduce((x, t) => x + kcal * PARTE[t as keyof typeof PARTE], 0), 0);
  return (
    <Card className="ancho-completo gap-5">
      <div className="grid gap-1">
        <h2 className="text-xl font-bold">Cómo se reparte tu semana</h2>
        <p className="text-sm text-muted-foreground">Tus {miles(kcal)} kcal del día, divididas en tus comidas. Los platillos del menú se eligen para acercarse a esto.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {COMIDAS.map(({ t, n, I, color }) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl border bg-background p-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 22%, transparent)` }}>
              <I className="size-6 text-foreground" weight="duotone" aria-hidden />
            </span>
            <span className="grid">
              <span className="text-sm font-semibold">{n} · {Math.round(PARTE[t] * 100)} %</span>
              <span className="font-mono text-lg font-bold">{miles(kcal * PARTE[t])} <span className="text-xs font-semibold">kcal</span></span>
              <span className="text-xs text-muted-foreground">{Math.round(proteina * PARTE[t])} g de proteína</span>
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-2" role="list" aria-label="Calorías por día">
        {DIAS_CORTOS.map((d, i) => {
          const hoy = enCasa(i);
          return (
            <div key={d} role="listitem" className="grid grid-cols-[2.6rem_1fr_auto] items-center gap-2">
              <span className="text-sm font-semibold">{d}</span>
              <div className="flex h-7 gap-0.5 overflow-hidden rounded-lg" aria-label={hoy.length === 3 ? "Todas las comidas en casa" : `En casa: ${hoy.join(", ") || "ninguna"}`}>
                {COMIDAS.map(({ t, n, color }) => {
                  const si = hoy.includes(t);
                  return (
                    <span key={t} title={`${n}: ${si ? miles(kcal * PARTE[t]) + " kcal" : "fuera de casa"}`}
                      className={cn("crecer grid place-items-center text-[0.65rem] font-bold", !si && "border-2 border-dashed border-border bg-transparent text-muted-foreground")}
                      style={{ flexGrow: PARTE[t], background: si ? color : undefined, color: si ? (t === "desayuno" ? "var(--mango-foreground)" : t === "cena" ? "var(--cena-texto)" : "var(--primary-foreground)") : undefined, animationDelay: `${i * 50}ms` }}>
                      {si ? n.slice(0, 3) : <Briefcase className="size-3.5" aria-label="fuera" />}
                    </span>
                  );
                })}
              </div>
              <span className="w-14 text-right font-mono text-xs text-muted-foreground">{miles(hoy.reduce((x, t) => x + kcal * PARTE[t as keyof typeof PARTE], 0))}</span>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        En casa planeas unas <b className="font-mono text-foreground">{miles(totalCasa)}</b> kcal a la semana. Las comidas con <Briefcase className="inline size-3.5 align-[-2px]" aria-label="maletín" /> las haces fuera (trabajo, escuela): ahí elige algo con verdura y proteína.{" "}
        <Link className="font-semibold text-primary underline underline-offset-2" href="/yo/">Cambiar mi rutina</Link>
      </p>
    </Card>
  );
}
