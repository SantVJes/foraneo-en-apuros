"use client";

import * as React from "react";
import {
  BookmarkSimple, ChefHat, CookingPot, Flag, Globe, Jar, Lightning, LockSimple, MagnifyingGlass, Oven, PencilSimple, Plus, ShareNetwork,
  SealCheck, Trash, UsersThree, Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { ESCENAS } from "@/components/img-3d";
import { Cabeza, Cargando, Etiqueta, Vacio } from "@/components/app-shell";
import { EditorReceta } from "@/components/editor-receta";
import { IconoPlatillo } from "@/components/icono-platillo";
import { ModoCocinar } from "@/components/modo-cocinar";
import { PillDificultad } from "@/components/pill-dificultad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { api, todos } from "@/lib/api";
import { useDatos } from "@/lib/datos";
import { cantidad, TIPOS } from "@/lib/formato";
import type { ArticuloAlacena, Receta, Usuario } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/* Recetas que escribe la gente: las creas, las compartes con un enlace y las de otros las guardas
   para que te salgan en tu semana. */

const PESTANAS = [
  { v: "comunidad", t: "Comunidad", I: UsersThree },
  { v: "mias", t: "Mis recetas", I: CookingPot },
  { v: "guardadas", t: "Guardadas", I: BookmarkSimple },
] as const;
type Pestana = (typeof PESTANAS)[number]["v"];

/* Filtros rápidos. "Para mí" quita lo que choca con tu dieta o alergias; "Con lo que tengo" ordena por lo que ya hay en tu alacena. */
const FILTROS = [
  { v: "parami", t: "Para mí", I: SealCheck },
  { v: "tengo", t: "Con lo que tengo", I: Jar },
  { v: "rapidas", t: "20 min o menos", I: Lightning },
  { v: "sinhorno", t: "Sin horno", I: Oven },
] as const;
type Filtro = (typeof FILTROS)[number]["v"];
const usaHorno = (r: Receta) => /\bhorno\b|hornea/i.test(r.pasos || "");

/** Lo que trae la receta y tú no comes (por dieta, alergia o porque lo quitaste). */
function choques(r: Receta, u: Usuario | null, nombreR: (v: string) => string) {
  if (!u) return [];
  const malos = r.contiene.filter((c) => u.restricciones.includes(c)).map(nombreR);
  const quitados = r.ingredientes.filter((i) => u.ingredientes_excluidos.includes(i.ingrediente_id)).map((i) => i.nombre);
  return [...malos, ...quitados];
}

function enlaceDe(codigo: string) {
  return `${location.origin}${location.pathname.replace(/\/recetas\/?$/, "")}/recetas/?r=${codigo}`;
}

/** Comparte con el menú del teléfono; si no hay, copia el enlace. */
async function compartir(r: Receta) {
  if (!r.codigo) return;
  const url = enlaceDe(r.codigo);
  try {
    if (navigator.share) { await navigator.share({ title: r.nombre, text: `Mira esta receta: ${r.nombre}`, url }); return; }
  } catch { return; /* canceló */ }
  try { await navigator.clipboard.writeText(url); toast("Enlace copiado. Pégalo donde quieras."); }
  catch { toast(`Copia este enlace: ${url}`, { duration: 10000 }); }
}

export default function Recetas() {
  const [pestana, setPestana] = React.useState<Pestana>("comunidad");
  const [buscar, setBuscar] = React.useState("");
  const [lista, setLista] = React.useState<Receta[] | null>(null);
  const [abierta, setAbierta] = React.useState<Receta | null>(null);
  const [editando, setEditando] = React.useState<Receta | "nueva" | null>(null);
  const [filtros, setFiltros] = React.useState<Filtro[]>([]);
  const [alacena, setAlacena] = React.useState<Set<number> | null>(null);
  const [autor, setAutor] = React.useState<{ id: number; nombre: string } | null>(null);
  const [cocinar, setCocinar] = React.useState<Receta | null>(null);
  const { usuario, opciones } = useDatos();
  const nombreR = React.useCallback((v: string) => opciones?.restricciones.find((o) => o.valor === v)?.nombre.replace(/ \(.*\)/, "") || v, [opciones]);
  React.useEffect(() => {
    if (filtros.includes("tengo") && !alacena)
      todos<ArticuloAlacena>("/alacena/").then((xs) => setAlacena(new Set(xs.map((x) => x.ingrediente_id)))).catch(() => setAlacena(new Set()));
  }, [filtros, alacena]);
  const tengo = (r: Receta) => (alacena ? r.ingredientes.filter((i) => i.es_basico || alacena.has(i.ingrediente_id)).length : 0);
  const visibles = React.useMemo(() => {
    if (!lista) return null;
    let xs = lista;
    if (filtros.includes("parami")) xs = xs.filter((r) => choques(r, usuario, nombreR).length === 0);
    if (filtros.includes("rapidas")) xs = xs.filter((r) => r.tiempo_minutos <= 20);
    if (filtros.includes("sinhorno")) xs = xs.filter((r) => !usaHorno(r));
    if (filtros.includes("tengo") && alacena) xs = [...xs].sort((a, b) => tengo(b) / b.ingredientes.length - tengo(a) / a.ingredientes.length);
    return xs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, filtros, alacena, usuario, nombreR]);

  const cargar = React.useCallback(() => {
    setLista(null);
    const q = buscar.trim() ? `&search=${encodeURIComponent(buscar.trim())}` : "";
    todos<Receta>(autor ? `/recetas/?autor=${autor.id}${q}` : `/recetas/?de=${pestana}${q}`).then(setLista).catch((e) => { toast(e.message); setLista([]); });
  }, [pestana, buscar, autor]);
  React.useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

  // Abrir una receta que alguien te compartió: /recetas/?r=CODIGO
  React.useEffect(() => {
    const codigo = new URLSearchParams(location.search || location.hash.split("?")[1] || "").get("r");
    if (codigo) api<Receta>(`/recetas/codigo/${codigo}/`).then(setAbierta).catch((e) => toast(e.message));
  }, []);

  const actualizar = (r: Receta) => {
    setLista((l) => l?.map((x) => (x.id === r.id ? r : x)) ?? l);
    setAbierta((a) => (a?.id === r.id ? r : a));
  };
  async function laCocine(r: Receta) {
    try {
      const x = await api<{ cocinada: boolean; cocinadas: number }>(`/recetas/${r.id}/cocinada/`, { method: "POST" });
      actualizar({ ...r, ...x });
      toast(x.cocinada ? `¡Bien! Ya van ${x.cocinadas} ${x.cocinadas === 1 ? "persona que la cocinó" : "personas que la cocinaron"}.` : "Listo, lo quitamos.");
    } catch (e) { toast((e as Error).message); }
  }
  async function guardar(r: Receta) {
    try {
      const x = await api<{ guardada: boolean; guardados: number }>(`/recetas/${r.id}/guardar/`, { method: "POST" });
      actualizar({ ...r, ...x });
      toast(x.guardada ? "Guardada. Ya puede salir en tu semana." : "Ya no está en tus guardadas.");
      if (pestana === "guardadas" && !x.guardada) setLista((l) => l?.filter((y) => y.id !== r.id) ?? l);
    } catch (e) { toast((e as Error).message); }
  }

  return (
    <div className="pagina grid grid-cols-1 gap-5">
      <Cabeza escena={ESCENAS.recetas} etiqueta="Cocina de la comunidad" titulo="Recetas">Comparte lo que cocinas y guarda lo que te late de otros foráneos.</Cabeza>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Busca por platillo o ingrediente" aria-label="Buscar recetas" className="pl-10" />
        </div>
        <Button size="lg" onClick={() => setEditando("nueva")} className="shrink-0 px-5"><Plus />Crear</Button>
      </div>

      <div role="tablist" aria-label="Qué recetas ver" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
        {PESTANAS.map(({ v, t, I }) => (
          <button key={v} type="button" role="tab" aria-selected={pestana === v && !autor} onClick={() => { setPestana(v); setAutor(null); }}
            className={cn("flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-semibold transition-all duration-200",
              pestana === v && !autor ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}>
            <I className={cn("size-[1.15rem]", pestana === v && !autor && "icono-rebote")} weight="duotone" aria-hidden />{t}
          </button>
        ))}
      </div>

      <div className="-mx-4 -mt-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Filtros">
        {FILTROS.filter((f) => f.v !== "parami" || (usuario && (usuario.restricciones.length > 0 || usuario.ingredientes_excluidos.length > 0))).map(({ v, t, I }) => {
          const on = filtros.includes(v);
          return (
            <button key={v} type="button" aria-pressed={on} onClick={() => setFiltros((f) => (on ? f.filter((x) => x !== v) : [...f, v]))}
              className={cn("flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors",
                on ? "border-primary bg-accent text-accent-texto" : "border-border text-muted-foreground hover:text-foreground")}>
              <I className="size-4" weight={on ? "fill" : "regular"} aria-hidden />{t}
            </button>
          );
        })}
      </div>

      {autor && (
        <div className="flex items-center gap-3 rounded-2xl bg-accent p-3">
          <span aria-hidden className="grid size-11 place-items-center rounded-full bg-mango font-display text-lg font-extrabold text-[#2a1a00]">{autor.nombre[0]}</span>
          <div className="grid min-w-0 flex-1"><b>Recetas de {autor.nombre}</b>
            {lista && <span className="text-sm text-muted-foreground">{lista.length} recetas · {lista.reduce((s, r) => s + r.guardados, 0)} guardados · {lista.reduce((s, r) => s + r.cocinadas, 0)} la cocinaron</span>}</div>
          <Button variant="ghost" size="sm" onClick={() => setAutor(null)}>Ver todas</Button>
        </div>
      )}

      {!visibles ? <Cargando texto="Buscando recetas…" /> : visibles.length === 0 ? (
        <Vacio img="pot-of-food">
          <p>{buscar ? `No encontramos recetas con “${buscar}”.` : filtros.length ? "Ninguna receta pasa esos filtros. Quita alguno." : pestana === "mias" ? "Todavía no has escrito recetas. ¿Qué es lo que mejor te sale?"
            : pestana === "guardadas" ? "Aquí van las recetas que guardes de la comunidad." : "Todavía no hay recetas. ¡Sé la primera persona en compartir una!"}</p>
          {pestana !== "guardadas" && <Button onClick={() => setEditando("nueva")}><Plus />Escribir una receta</Button>}
        </Vacio>
      ) : (
        <ul className="entrar-lista grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((r) => <Tarjeta key={r.id} r={r} abrir={() => setAbierta(r)} guardar={() => guardar(r)}
            ojo={choques(r, usuario, nombreR)} tengo={filtros.includes("tengo") && alacena ? tengo(r) : null} />)}
        </ul>
      )}

      <Detalle r={abierta} onClose={() => setAbierta(null)} guardar={guardar} laCocine={laCocine} ojo={abierta ? choques(abierta, usuario, nombreR) : []}
        cocinar={(r) => { setAbierta(null); setCocinar(r); }}
        verAutor={(r) => { setAbierta(null); if (r.autor_id) setAutor({ id: r.autor_id, nombre: r.es_mia ? "ti" : r.autor_nombre }); }}
        editar={(r) => { setAbierta(null); setEditando(r); }}
        borrada={(id) => { setAbierta(null); setLista((l) => l?.filter((x) => x.id !== id) ?? l); }} />
      {editando && <EditorReceta receta={editando === "nueva" ? null : editando} onClose={() => setEditando(null)}
        listo={(r, nueva) => { setEditando(null); if (nueva) { setPestana("mias"); setAutor(null); } else actualizar(r); setAbierta(r); }} />}
      {cocinar && <ModoCocinar platillo={cocinar} onClose={() => setCocinar(null)}
        alTerminar={!cocinar.es_mia && <Button size="lg" variant={cocinar.cocinada ? "secondary" : "default"} onClick={() => { laCocine(cocinar); setCocinar({ ...cocinar, cocinada: !cocinar.cocinada }); }}>
          <SealCheck weight="fill" />{cocinar.cocinada ? "¡Anotado! La cocinaste" : `Avisarle a ${cocinar.autor_nombre} que la cociné`}</Button>} />}
    </div>
  );
}

function Tarjeta({ r, abrir, guardar, ojo, tengo }: { r: Receta; abrir: () => void; guardar: () => void; ojo: string[]; tengo: number | null }) {
  return (
    <li className="group relative grid gap-3 rounded-2xl border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary">
      <button type="button" onClick={abrir} className="grid gap-2 text-left after:absolute after:inset-0 after:rounded-2xl after:content-['']">
        <span className="flex items-center gap-3 text-sm text-muted-foreground">
          <IconoPlatillo nombre={r.nombre} tipo={r.tipo_comida} tamano="md" />{TIPOS[r.tipo_comida]}
          {r.es_mia && <span className="ml-auto flex items-center gap-1 text-xs font-semibold">{r.publica ? <><Globe className="size-4" aria-hidden />Pública</> : <><LockSimple className="size-4" aria-hidden />Solo tú</>}</span>}
        </span>
        <span className="text-lg font-bold leading-snug">{r.nombre}</span>
        <span className="text-sm text-muted-foreground">por {r.es_mia ? "ti" : r.autor_nombre}{r.cocinadas > 0 ? ` · ${r.cocinadas} la ${r.cocinadas === 1 ? "cocinó" : "cocinaron"}` : ""}</span>
        {tengo !== null && <span className="flex items-center gap-1.5 text-sm font-semibold text-accent-texto"><Jar className="size-4" weight="fill" aria-hidden />Tienes {tengo} de {r.ingredientes.length}</span>}
        {ojo.length > 0 && <span className="flex items-center gap-1.5 text-sm font-semibold text-destructive"><Warning className="size-4 shrink-0" weight="fill" aria-hidden />Lleva {ojo.join(", ").toLowerCase()}, que no comes</span>}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <PillDificultad d={r.dificultad} />
        <span className="font-mono text-xs text-muted-foreground">{r.tiempo_minutos} min</span>
        {!r.es_mia && (
          <button type="button" onClick={guardar} aria-pressed={r.guardada} aria-label={r.guardada ? `Quitar ${r.nombre} de guardadas` : `Guardar ${r.nombre}`}
            className={cn("relative z-10 ml-auto flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold transition-colors",
              r.guardada ? "bg-accent text-accent-texto" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
            <BookmarkSimple className={cn("size-5", r.guardada && "icono-rebote")} weight={r.guardada ? "fill" : "regular"} aria-hidden />{r.guardados || ""}
          </button>
        )}
      </div>
    </li>
  );
}

function Detalle({ r, onClose, guardar, editar, borrada, laCocine, ojo, cocinar, verAutor }: {
  r: Receta | null; onClose: () => void; guardar: (r: Receta) => void; editar: (r: Receta) => void; borrada: (id: number) => void;
  laCocine: (r: Receta) => void; ojo: string[]; cocinar: (r: Receta) => void; verAutor: (r: Receta) => void;
}) {
  const [confirmar, setConfirmar] = React.useState(false);
  React.useEffect(() => setConfirmar(false), [r?.id]);
  async function borrar() {
    if (!r) return;
    try { await api(`/recetas/${r.id}/`, { method: "DELETE" }); toast("Receta borrada."); borrada(r.id); }
    catch (e) { toast((e as Error).message); }
  }
  async function reportar() {
    if (!r) return;
    try { await api(`/recetas/${r.id}/reportar/`, { method: "POST" }); toast("Gracias por avisar. La vamos a revisar."); onClose(); }
    catch (e) { toast((e as Error).message); }
  }
  return (
    <Sheet open={r !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {r && (
          <>
            <div className="grid gap-2">
              <IconoPlatillo nombre={r.nombre} tipo={r.tipo_comida} tamano="lg" />
              <Etiqueta>{TIPOS[r.tipo_comida]} · por{" "}
                <button type="button" className="underline underline-offset-2 hover:text-primary" onClick={() => verAutor(r)}>{r.es_mia ? "ti" : r.autor_nombre}</button></Etiqueta>
              <SheetTitle>{r.nombre}</SheetTitle>
              <div className="flex flex-wrap items-center gap-2"><PillDificultad d={r.dificultad} /><span className="font-mono text-xs text-muted-foreground">{r.tiempo_minutos} min · rinde {r.porciones}</span></div>
              {r.cocinadas > 0 && <p className="flex items-center gap-1.5 text-sm font-semibold text-accent-texto"><SealCheck className="size-4" weight="fill" aria-hidden />{r.cocinadas} {r.cocinadas === 1 ? "persona la cocinó" : "personas la cocinaron"}</p>}
              {ojo.length > 0 && <p className="flex items-start gap-2 rounded-lg bg-destructive-soft p-3 text-sm font-semibold"><Warning className="mt-0.5 size-4 shrink-0 text-destructive" weight="fill" aria-hidden />Ojo: lleva {ojo.join(", ").toLowerCase()}, y dijiste que no lo comes.</p>}
              {r.descripcion && <SheetDescription>{r.descripcion}</SheetDescription>}
            </div>
            {r.pasos && <Button size="lg" onClick={() => cocinar(r)}><ChefHat weight="fill" />Cocinar paso a paso</Button>}
            <div className="flex flex-wrap gap-2">
              {!r.es_mia && <Button variant={r.guardada ? "secondary" : "default"} onClick={() => guardar(r)}><BookmarkSimple weight={r.guardada ? "fill" : "bold"} />{r.guardada ? "Guardada" : "Guardar"}</Button>}
              {r.codigo && <Button variant="outline" onClick={() => compartir(r)}><ShareNetwork />Compartir</Button>}
              {!r.es_mia && <Button variant={r.cocinada ? "secondary" : "outline"} onClick={() => laCocine(r)} aria-pressed={r.cocinada}><SealCheck weight={r.cocinada ? "fill" : "regular"} />{r.cocinada ? "La cociné" : "Ya la cociné"}</Button>}
              {r.es_mia && <Button variant="outline" onClick={() => editar(r)}><PencilSimple />Editar</Button>}
            </div>
            <div className="grid gap-2">
              <h3 className="text-lg font-bold">Ingredientes</h3>
              <ul className="grid gap-1.5">
                {r.ingredientes.map((i) => (
                  <li key={i.ingrediente_id} className="flex justify-between gap-3 border-b border-dashed pb-1.5">
                    <span>{i.nombre}</span><span className="font-mono text-sm">{cantidad(Number(i.cantidad), i.unidad)}</span>
                  </li>
                ))}
              </ul>
            </div>
            {r.pasos && (
              <div className="grid gap-2">
                <h3 className="text-lg font-bold">Cómo se hace</h3>
                <ol className="grid gap-3">
                  {r.pasos.split("\n").map((p) => p.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter(Boolean).map((p, i) => (
                    <li key={i} className="flex gap-3"><span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-accent font-mono text-sm font-bold text-accent-texto">{i + 1}</span><span className="pt-0.5">{p}</span></li>
                  ))}
                </ol>
              </div>
            )}
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {r.es_mia ? (
                confirmar
                  ? <><Button variant="destructive" onClick={borrar}><Trash />Sí, borrarla</Button><Button variant="ghost" onClick={() => setConfirmar(false)}>No</Button></>
                  : <Button variant="ghost" className="text-muted-foreground" onClick={() => setConfirmar(true)}><Trash />Borrar receta</Button>
              ) : <Button variant="ghost" className="text-muted-foreground" onClick={reportar}><Flag />Reportar receta</Button>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
