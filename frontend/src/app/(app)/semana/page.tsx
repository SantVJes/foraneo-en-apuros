"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowsClockwise as RefreshCw, CaretRight, ChefHat, CheckCircle, Circle, Fire, Plus, ShoppingCartSimple as ShoppingCart, Trash as Trash2, X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { ESCENAS, Img3D } from "@/components/img-3d";
import { Cabeza, Cargando, Etiqueta } from "@/components/app-shell";
import { IconoPlatillo } from "@/components/icono-platillo";
import { ModoCocinar } from "@/components/modo-cocinar";
import { PillDificultad } from "@/components/pill-dificultad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckboxChip } from "@/components/ui/checkbox-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, ApiError, todos } from "@/lib/api";
import { useDatos } from "@/lib/datos";
import { cantidad, DIAS, DIF, dinero, fechaLarga, TIPOS } from "@/lib/formato";
import { COMIDA_FUERA, resumenDelMes } from "@/lib/gastos";
import { usePlanes } from "@/lib/planes";
import type { Nutricion, Plan, Platillo, PlatilloCorto, Salud, Usuario } from "@/lib/tipos";

export default function Semana() {
  const { usuario, opciones } = useDatos();
  const { planes, plan, elegir, recargar, cargando } = usePlanes();
  const [armando, setArmando] = React.useState(false);
  const [receta, setReceta] = React.useState<number | null>(null);
  const [cambio, setCambio] = React.useState<{ dia: number; tipo: string } | null>(null);
  const u = usuario!;
  const [nutricion, setNutricion] = React.useState<Nutricion | null>(null);
  const [conMeta, setConMeta] = React.useState(false);
  const [quitando, setQuitando] = React.useState<string | null>(null);
  const [nueva, setNueva] = React.useState(false);
  const [cocinar, setCocinar] = React.useState<Platillo | null>(null);
  const abrirCocinar = (id: number) => api<Platillo>(`/platillos/${id}/`).then((p) => { setReceta(null); setCocinar(p); }).catch((e) => toast(e.message));

  React.useEffect(() => { api<Salud>("/salud/").then((s) => setConMeta(!!s.calculo?.disponible)).catch(() => setConMeta(false)); }, []);
  React.useEffect(() => {
    setNutricion(null);
    if (plan && conMeta) api<Nutricion>(`/planes/${plan.id}/nutricion/`).then(setNutricion).catch(() => setNutricion(null));
  }, [plan, conMeta]);

  async function ponerPlatillo(dia: number, tipo: string, platillo_id: number | null) {
    await api(`/planes/${plan!.id}/cambiar-platillo/`, { method: "POST", body: { dia, tipo_comida: tipo, platillo_id } });
    await recargar(plan!.id);
  }
  async function noComo(dia: number, tipo: string) {
    if (!plan) return;
    const k = `${dia}-${tipo}`;
    const antes = plan.menu.find((x) => x.dia === dia && x.tipo_comida === tipo)?.platillo?.id ?? null;
    setQuitando(k);
    try {
      await ponerPlatillo(dia, tipo, null);
      toast(`Quitamos ${TIPOS[tipo].toLowerCase()} del ${DIAS[dia].toLowerCase()}.`, {
        action: antes ? { label: "Deshacer", onClick: () => ponerPlatillo(dia, tipo, antes).then(() => toast("Listo, la regresamos.")).catch((e) => toast(e.message)) } : undefined,
      });
    } catch (e) { toast((e as Error).message); } finally { setQuitando(null); }
  }

  // Qué día de esta semana es hoy (si el plan es de esta semana), para resaltarlo y llevarte ahí.
  const hoy = React.useMemo(() => {
    if (!plan) return -1;
    const [a, m, d] = plan.fecha_inicio.split("-").map(Number);
    const n = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(a, m - 1, d).getTime()) / 86400000);
    return n >= 0 && n < 7 ? n : -1;
  }, [plan]);

  async function armar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const comidas = f.getAll("comidas").map(String);
    if (!comidas.length) return toast("Elige al menos una comida del día.");
    setArmando(true);
    try {
      const nuevo = await api<Plan>("/planes/", { method: "POST", body: {
        comidas, dificultades: f.getAll("dif").map(String),
        presupuesto: String(f.get("presupuesto") || "0"), personas: Number(f.get("personas")) || 1,
      } });
      toast("Listo, tu semana está armada.");
      setNueva(false);
      await recargar(nuevo.id);
    } catch (err) {
      const e = err as ApiError;
      toast(e.data?.codigo === "limite_planes" ? "Ya guardaste 5 semanas. Borra una para armar otra." : e.message);
    } finally { setArmando(false); }
  }

  if (cargando) return <Cargando texto="Cargando tu semana…" />;
  const comidas = plan ? plan.comidas : ["comida", "cena"];
  const difs = plan ? plan.dificultades : [];

  const formulario = (
    <form onSubmit={armar} className="grid grid-cols-1 gap-5" key={plan?.id ?? "nuevo"}>
      <fieldset className="grid gap-2"><legend className="mb-2 font-semibold">¿Qué comidas haces en casa?</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TIPOS).map(([v, n]) => <CheckboxChip key={v} type="checkbox" name="comidas" value={v} defaultChecked={comidas.includes(v)}>{n}</CheckboxChip>)}
        </div>
      </fieldset>
      <fieldset className="grid gap-2"><legend className="mb-2 font-semibold">¿Qué tan difícil? <span className="font-normal text-muted-foreground">(si no marcas nada, de todo)</span></legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DIF).map(([v, n]) => <CheckboxChip key={v} type="checkbox" name="dif" value={v} defaultChecked={difs.includes(v)}>{n}</CheckboxChip>)}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><Label htmlFor="pres">Presupuesto (MXN)</Label>
          <Input id="pres" name="presupuesto" type="number" min={0} step={50} inputMode="decimal" defaultValue={plan ? plan.presupuesto : u.presupuesto_semanal} /></div>
        <div className="grid gap-1.5"><Label htmlFor="personas">Personas</Label>
          <Input id="personas" name="personas" type="number" min={1} max={12} inputMode="numeric" defaultValue={plan ? plan.personas : u.personas} /></div>
      </div>
      <p className="text-sm text-muted-foreground">
        {Object.values(u.rutina_comidas || {}).some((v) => v.length < 3) ? "Los días que no comes en casa no llevan esa comida. " : "¿Te dan de comer en el trabajo o la escuela? "}
        <Link className="font-semibold text-primary underline underline-offset-2" href="/yo/">Cambiar mi rutina</Link>
        {u.restricciones.length > 0 && <> · Sin {u.restricciones.map((r) => (opciones?.restricciones.find((o) => o.valor === r)?.nombre || r).toLowerCase()).join(", ")}</>}
      </p>
      <Button size="lg" type="submit" disabled={armando} className="w-full sm:w-fit">{armando ? "Armando…" : plan ? "Armar semana nueva" : "Armar mi semana"}</Button>
    </form>
  );

  return (
    <div className="pagina grid grid-cols-1 gap-5">
      <Saludo nombre={u.first_name} />
      <Cabeza escena={ESCENAS.semana} etiqueta={plan ? "Semana del " + fechaLarga(plan.fecha_inicio) : undefined}
        titulo={plan ? "Tu semana" : <>Hola{u.first_name ? `, ${u.first_name}` : ""}. Armemos tu semana</>}>
        {!plan && <>Te proponemos qué comer cada día{conMeta ? " según tus calorías" : ""}. Lo puedes cambiar cuando quieras.</>}
      </Cabeza>

      {plan && hoy >= 0 && <Hoy plan={plan} dia={hoy} kcal={conMeta} ver={setReceta} cocinar={abrirCocinar} />}

      {plan ? (
        <div className="flex flex-wrap gap-2">
          <Button size="lg" asChild className="flex-1 px-4 sm:flex-none"><Link href="/lista/"><ShoppingCart />Ver lista</Link></Button>
          <Button size="lg" variant="outline" className="flex-1 px-4 sm:flex-none" onClick={() => setNueva(true)}><RefreshCw />Semana nueva</Button>
        </div>
      ) : <Card>{formulario}</Card>}

      {plan && <TerminaPerfil u={u} conMeta={conMeta} />}
      {plan && <EsteMes />}

      {plan && plan.menu.length > 0 && (
        <div className="entrar-lista grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DIAS.map((nombre, dia) => {
            const n = nutricion?.dias.find((x) => x.dia === dia);
            const conKcal = n && n.meta_dia > 0 && Number(n.kcal) > 0;
            const tipos = (["desayuno", "comida", "cena"] as const).filter((t) => plan.comidas.includes(t) || plan.menu.some((x) => x.dia === dia && x.tipo_comida === t));
            return (
              <section key={nombre} id={`dia-${dia}`} aria-label={dia === hoy ? `${nombre}, hoy` : nombre}
                className={`scroll-mt-24 overflow-hidden rounded-2xl border bg-card shadow-[0_1px_0_rgba(22,32,26,.05),0_10px_24px_-16px_rgba(22,32,26,.3)] dark:shadow-none ${dia === hoy ? "border-primary ring-2 ring-primary/40" : ""}`}>
                <div className="grid gap-2 px-4 pb-2 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-xl font-extrabold">{nombre}{dia === hoy && <span className="rounded-full bg-primary px-2 py-0.5 font-sans text-xs font-bold text-primary-foreground">Hoy</span>}</h2>
                    {conKcal && (
                      <span className="flex items-center gap-1 rounded-full bg-mango/25 px-2.5 py-0.5 font-mono text-xs font-semibold text-mango-text" title={`Meta de ese día: ${n.meta_dia} kcal`}>
                        <Fire weight="fill" className="size-3.5" aria-hidden />{Math.round(Number(n.kcal)).toLocaleString("es-MX")}<span className="font-normal opacity-80">/{n.meta_dia.toLocaleString("es-MX")} kcal</span>
                      </span>
                    )}
                  </div>
                  {conKcal && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                      <div className={`crecer h-full rounded-full ${Math.abs((n.pct_meta ?? 100) - 100) <= 15 ? "bg-primary" : "bg-mango"}`} style={{ width: `${Math.min(100, n.pct_meta ?? 0)}%` }} />
                    </div>
                  )}
                </div>
                <ul className="grid gap-2 px-2 pb-2">
                  {tipos.map((tipo) => {
                    const c = plan.menu.find((x) => x.dia === dia && x.tipo_comida === tipo);
                    const k = `${dia}-${tipo}`;
                    if (!c || !c.platillo)
                      return (
                        <li key={tipo} className="flex items-center justify-between gap-2 rounded-xl border-2 border-dashed px-3 py-2.5 text-muted-foreground">
                          <span className="grid gap-0.5"><Etiqueta className="text-[0.66rem]">{TIPOS[tipo]}</Etiqueta><span className="text-sm">No comes en casa</span></span>
                          <Button size="sm" variant="ghost" className="text-primary" onClick={() => setCambio({ dia, tipo })}><Plus />Agregar</Button>
                        </li>
                      );
                    return (
                      <li key={tipo} className={`@container flex min-w-0 items-center gap-1 rounded-xl bg-background/70 py-2 dark:bg-white/[0.03] pl-3 pr-1 transition-all duration-300 ${quitando === k ? "scale-95 opacity-30" : ""}`}>
                        <IconoPlatillo nombre={c.platillo.nombre} tipo={tipo} />
                        <button type="button" onClick={() => setReceta(c.platillo!.id)} className="grid min-w-0 flex-1 gap-1 px-2 py-0.5 text-left">
                          <Etiqueta className="text-[0.66rem]">{TIPOS[tipo]}</Etiqueta>
                          <span className="font-semibold leading-snug hover:text-primary">{c.platillo.nombre}</span>
                          <span className="flex flex-wrap items-center gap-2"><PillDificultad d={c.platillo.dificultad} /><span className="font-mono text-xs text-muted-foreground">{c.platillo.tiempo_minutos} min{conMeta && c.platillo.nutricion_porcion ? ` · ${c.platillo.nutricion_porcion.kcal} kcal` : ""}</span></span>
                        </button>
                        <div className="flex shrink-0 flex-col items-end">
                          <Button size="icon" variant="ghost" className="size-9 text-muted-foreground hover:bg-destructive-soft hover:text-destructive" onClick={() => noComo(dia, tipo)}
                            aria-label={`El ${nombre.toLowerCase()} no hago ${TIPOS[tipo].toLowerCase()} en casa`} title="Ese día no la hago en casa"><X /></Button>
                          <Button size="sm" variant="ghost" className="min-h-9 px-2 text-primary" aria-label={`Cambiar ${TIPOS[tipo].toLowerCase()}`} onClick={() => setCambio({ dia, tipo })}><RefreshCw className="size-4" aria-hidden /><span className="hidden @[21rem]:inline">Cambiar</span></Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {planes.length > 1 && <Historial planes={planes} actual={plan!} elegir={elegir} recargar={recargar} limite={opciones?.pro_activo ? opciones.planes_gratis : undefined} />}

      {plan && (
        <Sheet open={nueva} onOpenChange={setNueva}>
          <SheetContent>
            <SheetTitle>Armar semana nueva</SheetTitle>
            <SheetDescription>Te armamos otro menú. La semana de ahora se queda guardada.</SheetDescription>
            {formulario}
          </SheetContent>
        </Sheet>
      )}

      <Receta id={receta} personas={plan?.personas ?? 1} conMeta={conMeta} onClose={() => setReceta(null)} cocinar={(p) => { setReceta(null); setCocinar(p); }} />
      {cocinar && <ModoCocinar platillo={cocinar} personas={plan?.personas} onClose={() => setCocinar(null)} />}
      {plan && cambio && <ElegirPlatillo plan={plan} {...cambio} onClose={() => setCambio(null)} onCambio={() => recargar(plan.id)} />}
    </div>
  );
}

function Historial({ planes, actual, elegir, recargar, limite }: { planes: Plan[]; actual: Plan; elegir: (id: number) => void; recargar: () => Promise<void>; limite?: number }) {
  const [confirmar, setConfirmar] = React.useState<number | null>(null);
  async function borrar(id: number) {
    if (confirmar !== id) return setConfirmar(id);
    try { await api(`/planes/${id}/`, { method: "DELETE" }); toast("Semana borrada."); await recargar(); }
    catch (e) { toast((e as Error).message); }
  }
  return (
    <Card className="gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold">Semanas guardadas</h2>
        <span className="text-sm text-muted-foreground">{planes.length}{limite ? ` de ${limite}` : ""} guardadas</span>
      </div>
      <ul className="grid gap-1.5">
        {planes.map((p) => (
          <li key={p.id} className={`flex items-center gap-3 rounded-lg py-1 pl-3 pr-1 ${p.id === actual.id ? "bg-accent" : ""}`}>
            <button type="button" className={`flex-1 text-left underline-offset-4 hover:underline ${p.id === actual.id ? "font-bold" : ""}`} onClick={() => elegir(p.id)} aria-current={p.id === actual.id}>
              {p.nombre || "Semana del " + fechaLarga(p.fecha_inicio)}
            </button>
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{p.menu.filter((c) => c.platillo).length} comidas · {dinero(p.presupuesto)}</span>
            <Button size="sm" variant="ghost" onClick={() => borrar(p.id)} aria-label="Borrar semana">
              {confirmar === p.id ? "¿Seguro?" : <Trash2 />}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Receta({ id, personas, conMeta, onClose, cocinar }: { id: number | null; personas: number; conMeta: boolean; onClose: () => void; cocinar: (p: Platillo) => void }) {
  const { opciones } = useDatos();
  const [p, setP] = React.useState<Platillo | null>(null);
  React.useEffect(() => { setP(null); if (id) api<Platillo>(`/platillos/${id}/`).then(setP).catch((e) => toast(e.message)); }, [id]);
  const factor = p ? (personas || p.porciones) / p.porciones : 1;
  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {!p ? <><SheetTitle className="sr-only">Receta</SheetTitle><Cargando texto="Cargando receta…" /></> : (
          <>
            <div className="grid gap-2">
              <IconoPlatillo nombre={p.nombre} tipo={p.tipo_comida} tamano="lg" />
              <Etiqueta>{TIPOS[p.tipo_comida]}{p.estilo ? ` · ${p.estilo}` : ""}</Etiqueta>
              <SheetTitle>{p.nombre}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2"><PillDificultad d={p.dificultad} /><span className="font-mono text-xs text-muted-foreground">{p.tiempo_minutos} min</span>
                {p.contiene.length > 0 && <span className="text-xs text-muted-foreground">Contiene: {p.contiene.map((r) => opciones?.restricciones.find((o) => o.valor === r)?.nombre || r).join(", ")}</span>}</div>
              {conMeta && p.nutricion_porcion && <p className="flex items-center gap-1.5 text-sm font-semibold text-mango-text"><Fire weight="fill" className="size-4" aria-hidden />≈ {p.nutricion_porcion.kcal} kcal · {p.nutricion_porcion.proteina} g de proteína por porción</p>}
              {p.descripcion && <SheetDescription>{p.descripcion}</SheetDescription>}
            </div>
            {p.pasos && <Button size="lg" onClick={() => cocinar(p)}><ChefHat weight="fill" />Cocinar paso a paso</Button>}
            <div className="grid gap-2">
              <h3 className="text-lg font-bold">Ingredientes <span className="text-sm font-normal text-muted-foreground">(para {personas} {personas === 1 ? "persona" : "personas"})</span></h3>
              <ul className="grid gap-1.5">
                {p.ingredientes.map((i) => (
                  <li key={i.ingrediente_id} className="flex justify-between gap-3 border-b border-dashed pb-1.5">
                    <span>{i.nombre}{i.es_basico && <Badge className="ml-2" variant="neutro">básico</Badge>}</span>
                    <span className="font-mono text-sm">{cantidad(Number(i.cantidad) * factor, i.unidad)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-2"><h3 className="text-lg font-bold">Cómo se hace</h3><p className="whitespace-pre-line">{p.pasos}</p></div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ElegirPlatillo({ plan, dia, tipo, onClose, onCambio }: { plan: Plan; dia: number; tipo: string; onClose: () => void; onCambio: () => void }) {
  const [dif, setDif] = React.useState("todos");
  const [lista, setLista] = React.useState<PlatilloCorto[] | null>(null);
  React.useEffect(() => {
    setLista(null);
    todos<PlatilloCorto>(`/platillos/?tipo_comida=${tipo}&para_mi=1${dif !== "todos" ? "&dificultad=" + dif : ""}`).then(setLista).catch((e) => toast(e.message));
  }, [tipo, dif]);
  async function elegir(id: number) {
    try {
      await api(`/planes/${plan.id}/cambiar-platillo/`, { method: "POST", body: { dia, tipo_comida: tipo, platillo_id: id } });
      toast("Listo, ya está en tu semana."); onCambio(); onClose();
    } catch (e) { toast((e as Error).message); }
  }
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <div className="grid gap-1"><Etiqueta>{DIAS[dia]} · {TIPOS[tipo]}</Etiqueta><SheetTitle>Elige un platillo</SheetTitle></div>
        <ToggleGroup type="single" value={dif} onValueChange={(v) => v && setDif(v)} aria-label="Dificultad">
          <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
          {Object.entries(DIF).map(([v, n]) => <ToggleGroupItem key={v} value={v}>{n}</ToggleGroupItem>)}
        </ToggleGroup>
        {!lista ? <Cargando texto="Buscando platillos…" /> : lista.length ? (
          <div className="grid gap-2">
            {lista.map((p) => (
              <button key={p.id} type="button" onClick={() => elegir(p.id)} className="flex min-h-14 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left hover:border-primary">
                <IconoPlatillo nombre={p.nombre} tipo={p.tipo_comida} />
                <span className="grid min-w-0 flex-1 gap-0.5"><b className="font-semibold">{p.nombre}</b><span className="text-sm text-muted-foreground">{DIF[p.dificultad] || p.dificultad} · {p.tiempo_minutos} min</span></span>
              </button>
            ))}
          </div>
        ) : <p className="text-muted-foreground">No hay platillos con esos filtros.</p>}
      </SheetContent>
    </Sheet>
  );
}

/** Saludo según la hora: buenos días, buenas tardes o buenas noches, con tu nombre. */
function Saludo({ nombre }: { nombre: string }) {
  const [h, setH] = React.useState<number | null>(null);
  React.useEffect(() => setH(new Date().getHours()), []);
  if (h === null) return null;
  const [texto, img] = h < 12 ? ["Buenos días", "sun-with-face"] : h < 19 ? ["Buenas tardes", "sunrise"] : ["Buenas noches", "crescent-moon"];
  return (
    <p className="-mb-3 flex items-center gap-2 font-semibold text-accent-texto">
      <span className="amanecer"><Img3D n={img} prioridad className="size-8" /></span>{texto}{nombre ? `, ${nombre}` : ""}
    </p>
  );
}

const ORDEN = ["desayuno", "comida", "cena"] as const;

/** Lo de hoy, arriba y grande: qué te toca y un botón para cocinarlo paso a paso. */
function Hoy({ plan, dia, kcal, ver, cocinar }: { plan: Plan; dia: number; kcal: boolean; ver: (id: number) => void; cocinar: (id: number) => void }) {
  const [hora, setHora] = React.useState<number | null>(null);
  React.useEffect(() => setHora(new Date().getHours()), []);
  const comidas = ORDEN.map((t) => plan.menu.find((c) => c.dia === dia && c.tipo_comida === t)).filter((c) => c?.platillo) as Plan["menu"];
  const ahora = hora === null ? 0 : hora < 11 ? 0 : hora < 17 ? 1 : 2;
  const siguiente = comidas.find((c) => ORDEN.indexOf(c.tipo_comida as (typeof ORDEN)[number]) >= ahora) ?? comidas[comidas.length - 1];
  return (
    <section aria-labelledby="hoy-titulo" className="entrar-pantalla grid gap-3 rounded-3xl border-2 border-primary/60 bg-card p-4 shadow-[0_14px_30px_-20px_var(--primary)]">
      <h2 id="hoy-titulo" className="flex items-center gap-2 text-xl font-extrabold"><span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-bold text-primary-foreground">Hoy</span>{DIAS[dia]}</h2>
      {comidas.length === 0 ? <p className="text-muted-foreground">Hoy no cocinas en casa. ¡A descansar!</p> : (
        <ul className="grid gap-2">
          {comidas.map((c) => {
            const toca = c === siguiente;
            return (
              <li key={c.id} className={`grid min-w-0 gap-2 rounded-2xl p-2 ${toca ? "bg-accent p-3" : ""}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <IconoPlatillo nombre={c.platillo!.nombre} tipo={c.tipo_comida} tamano={toca ? "md" : "sm"} />
                  <button type="button" onClick={() => ver(c.platillo!.id)} className="grid min-w-0 flex-1 gap-0.5 text-left">
                    <span className="text-xs font-semibold text-muted-foreground">{TIPOS[c.tipo_comida]}{toca ? " · te toca" : ""}</span>
                    <span className={`font-semibold leading-snug ${toca ? "text-lg" : ""}`}>{c.platillo!.nombre}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.platillo!.tiempo_minutos} min{kcal && c.platillo!.nutricion_porcion ? ` · ${c.platillo!.nutricion_porcion.kcal} kcal` : ""}</span>
                  </button>
                  {!toca && <Button size="sm" variant="outline" className="shrink-0" onClick={() => cocinar(c.platillo!.id)} aria-label={`Cocinar ${c.platillo!.nombre}`}>
                    <ChefHat /><span className="hidden min-[350px]:inline">Cocinar</span></Button>}
                </div>
                {toca && <Button onClick={() => cocinar(c.platillo!.id)} aria-label={`Cocinar ${c.platillo!.nombre}`}><ChefHat weight="fill" />Cocinar paso a paso</Button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Lo que no preguntamos al registrarte, para que lo completes cuando quieras. Se puede esconder. */
function TerminaPerfil({ u, conMeta }: { u: Usuario; conMeta: boolean }) {
  const [oculto, setOculto] = React.useState(true);
  const [estilo, setEstilo] = React.useState(false);
  React.useEffect(() => {
    try { setOculto(localStorage.getItem("fa_perfil_oculto") === "1"); setEstilo(localStorage.getItem("fa_estilo_visto") === "1"); } catch { setOculto(false); }
  }, []);
  const tareas = [
    { hecho: Object.keys(u.rutina_comidas || {}).length > 0, t: "Dinos qué días comes en casa", href: "/yo/?tab=rutina" },
    { hecho: u.lat != null, t: "Agrega tu ubicación para ver súper cerca", href: "/yo/?tab=super" },
    { hecho: conMeta, t: "¿Quieres bajar o subir de peso? Pon una meta", href: "/meta/" },
    { hecho: estilo, t: "Elige tus colores, modo oscuro y letra", href: "/yo/?tab=estilo" },
  ];
  const faltan = tareas.filter((x) => !x.hecho).length;
  if (oculto || faltan === 0) return null;
  return (
    <Card className="gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">Termina tu perfil <span className="font-normal text-muted-foreground">· {tareas.length - faltan} de {tareas.length}</span></h2>
        <button type="button" className="min-h-9 px-1 text-sm font-semibold text-muted-foreground underline underline-offset-2" onClick={() => { setOculto(true); try { localStorage.setItem("fa_perfil_oculto", "1"); } catch { /* nada */ } }}>Ahora no</button>
      </div>
      <ul className="grid">
        {tareas.map((x) => (
          <li key={x.href}>
            <Link href={x.href} className={`flex min-h-11 items-center gap-3 rounded-lg px-1 ${x.hecho ? "text-muted-foreground line-through" : "font-semibold hover:text-primary"}`}>
              {x.hecho ? <CheckCircle weight="fill" className="size-5 shrink-0 text-primary" aria-label="Hecho" /> : <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="flex-1">{x.t}</span>{!x.hecho && <CaretRight className="size-4" aria-hidden />}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Cuánto llevas gastado este mes y cuánto te ahorraste contra comer fuera. */
function EsteMes() {
  const [r, setR] = React.useState<ReturnType<typeof resumenDelMes> | null>(null);
  React.useEffect(() => setR(resumenDelMes()), []);
  if (!r || r.compras === 0) return null;
  return (
    <Card className="flex-row items-center gap-3">
      <span aria-hidden className="tono tono-verde grid size-14 shrink-0 place-items-center rounded-[1.1rem]"><Img3D n="money-bag" className="size-10" /></span>
      <div className="grid min-w-0 gap-0.5">
        <p className="font-semibold">Este mes llevas {dinero(r.gastado)} en súper{r.ahorro > 0 && <> y te ahorraste <b className="text-primary">{dinero(r.ahorro)}</b></>}.</p>
        <p className="text-xs text-muted-foreground">Comparado con {r.comidas} {r.comidas === 1 ? "comida" : "comidas"} fuera a {dinero(COMIDA_FUERA)} cada una (estimado).</p>
      </div>
    </Card>
  );
}
