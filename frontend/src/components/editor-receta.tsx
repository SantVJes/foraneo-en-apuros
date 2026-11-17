"use client";

import * as React from "react";
import { ArrowLeft, Check, Globe, LockSimple, MagnifyingGlass, Minus, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";

import { IconoPlatillo } from "@/components/icono-platillo";
import { pasosDe } from "@/components/modo-cocinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useDatos } from "@/lib/datos";
import { DIF, TIPOS } from "@/lib/formato";
import type { Ingrediente, Receta } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/* Crear una receta en 3 pasos cortos: qué es, qué lleva y cómo se hace.
   - Las cantidades van en medidas de cocina (taza, cucharada, piezas), no solo en gramos.
   - Antes de escribir te sugerimos ingredientes comunes.
   - Si cierras sin querer, el borrador se queda guardado en este dispositivo. */

type Medida = { n: string; f: number }; // nombre y cuánto vale en la unidad base (g, ml o pieza)
const MEDIDAS: Record<string, Medida[]> = {
  g: [{ n: "g", f: 1 }, { n: "kg", f: 1000 }, { n: "taza", f: 200 }, { n: "cucharada", f: 15 }, { n: "cucharadita", f: 5 }, { n: "pizca", f: 0.5 }],
  ml: [{ n: "ml", f: 1 }, { n: "taza", f: 240 }, { n: "cucharada", f: 15 }, { n: "cucharadita", f: 5 }, { n: "chorrito", f: 10 }, { n: "litro", f: 1000 }],
  pieza: [{ n: "pieza", f: 1 }],
};
/* Lo que se cuenta por pieza aunque se venda por kilo (gramos que pesa una pieza, aproximado). */
const PESO_PIEZA: [RegExp, number, string][] = [
  [/^aguacate/i, 200, "pieza"], [/^jitomate|^tomate/i, 120, "pieza"], [/^cebolla/i, 150, "pieza"], [/^papa\b/i, 170, "pieza"],
  [/^pl[aá]tano/i, 120, "pieza"], [/^lim[oó]n/i, 40, "pieza"], [/^zanahoria/i, 80, "pieza"], [/^chile serrano/i, 10, "pieza"],
  [/^chile/i, 30, "pieza"], [/^ajo/i, 5, "diente"], [/^pechuga/i, 250, "pieza"], [/^calabac/i, 150, "pieza"], [/^pepino/i, 250, "pieza"],
  [/^manzana/i, 180, "pieza"], [/^naranja/i, 200, "pieza"], [/^bolillo|^telera/i, 70, "pieza"], [/^pan de caja/i, 30, "rebanada"], [/^br[oó]coli/i, 300, "pieza"],
];
function medidasDe(i: Ingrediente): Medida[] {
  const pz = PESO_PIEZA.find(([re]) => re.test(i.nombre));
  return pz ? [{ n: pz[2], f: pz[1] }, ...MEDIDAS[i.unidad_base]] : MEDIDAS[i.unidad_base];
}
function inicial(i: Ingrediente): [number, string] {
  const pz = PESO_PIEZA.find(([re]) => re.test(i.nombre));
  if (pz) return [1, pz[2]];
  if (i.unidad_base === "pieza") return [1, "pieza"];
  if (/^sal\b|pimienta|comino|or[eé]gano|canela|consom/i.test(i.nombre)) return [1, "pizca"];
  if (i.es_basico && i.unidad_base === "ml") return [1, "cucharada"];
  if (/carne|pollo|res|cerdo|pescado|queso|jam[oó]n/i.test(i.categoria + " " + i.nombre)) return [250, "g"];
  return [1, i.unidad_base === "ml" ? "taza" : "taza"];
}
const COMUNES = ["Huevo", "Tortilla de maíz", "Arroz", "Frijol", "Jitomate", "Cebolla", "Pechuga de pollo", "Queso", "Papa", "Aguacate", "Pasta", "Leche"];
const TIEMPOS = [10, 20, 30, 45, 60];
const BORRADOR = "fa_borrador_receta";
const sinAcentos = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const ENTERAS = new Set(["pieza", "diente", "rebanada", "pizca", "chorrito"]);

type Fila = { ing: Ingrediente; cant: number; medida: string };
type Datos = { nombre: string; tipo: string; dif: string; minutos: number; porciones: number; filas: { id: number; cant: number; medida: string }[]; pasos: string[]; tip: string; publica: boolean | null };

const PLURAL: Record<string, string> = { pizca: "pizcas", chorrito: "chorritos", pieza: "piezas", taza: "tazas", cucharada: "cucharadas", cucharadita: "cucharaditas", litro: "litros", diente: "dientes", rebanada: "rebanadas" };
const nombreMedida = (m: string, n: number) => (n > 1 && PLURAL[m]) || m;

export function EditorReceta({ receta, onClose, listo }: { receta: Receta | null; onClose: () => void; listo: (r: Receta, nueva: boolean) => void }) {
  const { ingredientes } = useDatos();
  const [catalogo, setCatalogo] = React.useState<Ingrediente[]>([]);
  React.useEffect(() => { ingredientes().then(setCatalogo).catch(() => {}); }, [ingredientes]);

  const [paso, setPaso] = React.useState(0);
  const [d, setD] = React.useState<Datos>(() => {
    if (receta) return {
      nombre: receta.nombre, tipo: receta.tipo_comida, dif: receta.dificultad, minutos: receta.tiempo_minutos, porciones: receta.porciones,
      filas: receta.ingredientes.map((i) => ({ id: i.ingrediente_id, cant: Number(i.cantidad), medida: i.unidad === "pieza" ? "pieza" : i.unidad })),
      pasos: receta.pasos ? pasosDe(receta.pasos) : [""], tip: receta.descripcion, publica: receta.publica,
    };
    try { const b = JSON.parse(localStorage.getItem(BORRADOR) || "null"); if (b) return b; } catch { /* sin borrador */ }
    return { nombre: "", tipo: "comida", dif: "facil", minutos: 20, porciones: 2, filas: [], pasos: [""], tip: "", publica: null };
  });
  const [recuperado] = React.useState(() => !receta && (() => { try { return !!localStorage.getItem(BORRADOR); } catch { return false; } })());
  const cambiar = (x: Partial<Datos>) => setD((v) => ({ ...v, ...x }));
  // Guarda el borrador mientras escribes (solo recetas nuevas).
  React.useEffect(() => {
    if (receta) return;
    try { localStorage.setItem(BORRADOR, JSON.stringify(d)); } catch { /* nada */ }
  }, [d, receta]);

  const filas: Fila[] = d.filas.map((f) => ({ ...f, ing: catalogo.find((c) => c.id === f.id)! })).filter((f) => f.ing);
  const [busca, setBusca] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const titulo = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => { titulo.current?.focus(); }, [paso]);

  const ya = new Set(d.filas.map((f) => f.id));
  const q = sinAcentos(busca.trim());
  const sugerencias = (q.length >= 1
    ? catalogo.filter((c) => sinAcentos(c.nombre).includes(q)).sort((a, b) => +sinAcentos(b.nombre).startsWith(q) - +sinAcentos(a.nombre).startsWith(q))
    : COMUNES.map((n) => catalogo.find((c) => c.nombre === n) || catalogo.find((c) => c.nombre.startsWith(n))).filter(Boolean) as Ingrediente[]
  ).filter((c) => !ya.has(c.id)).slice(0, 8);
  const basicos = catalogo.filter((c) => c.es_basico && !ya.has(c.id));
  const agregar = (c: Ingrediente) => {
    const [cant, medida] = inicial(c);
    cambiar({ filas: [...d.filas, { id: c.id, cant, medida }] }); setBusca("");
  };
  const fila = (i: number, x: Partial<Datos["filas"][number]>) => cambiar({ filas: d.filas.map((f, j) => (j === i ? { ...f, ...x } : f)) });

  const faltas = [
    d.nombre.trim().length < 3 ? "Ponle un nombre (mínimo 3 letras)." : "",
    d.filas.length === 0 ? "Agrega al menos un ingrediente." : d.filas.some((f) => !(f.cant > 0)) ? "Pon cuánto lleva de cada ingrediente." : "",
    d.pasos.every((p) => !p.trim()) ? "Escribe al menos un paso." : d.publica === null ? "Elige si la compartes o es solo para ti." : "",
  ];
  const ultimo = paso === 2;

  async function publicar() {
    setEnviando(true);
    const base = (f: Fila) => {
      const m = medidasDe(f.ing).find((x) => x.n === f.medida) || MEDIDAS[f.ing.unidad_base][0];
      return String(Math.round(f.cant * m.f * 100) / 100);
    };
    const cuerpo = {
      nombre: d.nombre.trim(), tipo_comida: d.tipo, dificultad: d.dif, tiempo_minutos: d.minutos, porciones: d.porciones, descripcion: d.tip.trim(), publica: !!d.publica,
      pasos: d.pasos.map((p) => p.trim()).filter(Boolean).map((p, i) => `${i + 1}. ${p}`).join("\n"),
      ingredientes_entrada: filas.map((f) => ({ ingrediente_id: f.ing.id, cantidad: base(f) })),
    };
    try {
      const r = await api<Receta>(receta ? `/recetas/${receta.id}/` : "/recetas/", { method: receta ? "PATCH" : "POST", body: cuerpo });
      if (!receta) try { localStorage.removeItem(BORRADOR); } catch { /* nada */ }
      toast(receta ? "Cambios guardados." : d.publica ? "¡Publicada! Ya la puede ver la comunidad." : "Guardada en Mis recetas.");
      listo(r, !receta);
    } catch (err) { toast((err as Error).message); setEnviando(false); }
  }

  const PASOS = ["Qué es", "Qué lleva", "Cómo se hace"];
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="h-[100dvh] max-h-[100dvh] rounded-none sm:h-[min(92dvh,820px)] sm:rounded-3xl">
        <div className="grid gap-2 pr-10">
          <SheetTitle className="sr-only">{receta ? "Editar receta" : "Nueva receta"}</SheetTitle>
          <SheetDescription className="text-sm font-semibold">Paso {paso + 1} de 3 · {PASOS[paso]}</SheetDescription>
          <div className="flex gap-1.5" aria-hidden>{PASOS.map((_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= paso ? "bg-primary" : "bg-secondary")} />)}</div>
        </div>
        {recuperado && paso === 0 && (
          <p className="flex flex-wrap items-center gap-x-3 rounded-lg bg-accent px-3 py-2 text-sm">Seguimos con tu borrador.
            <button type="button" className="font-semibold underline underline-offset-2" onClick={() => { try { localStorage.removeItem(BORRADOR); } catch { /* nada */ } setD({ nombre: "", tipo: "comida", dif: "facil", minutos: 20, porciones: 2, filas: [], pasos: [""], tip: "", publica: null }); }}>Empezar de cero</button></p>
        )}

        <div key={paso} className="entrar-pantalla grid flex-1 content-start gap-5 overflow-y-auto pb-2">
          {paso === 0 && (
            <>
              <h2 ref={titulo} tabIndex={-1} className="text-2xl font-extrabold outline-none">¿Qué vas a cocinar?</h2>
              <div className="flex items-center gap-3">
                <IconoPlatillo nombre={d.nombre || " "} tipo={d.tipo} tamano="md" />
                <Input id="r-nombre" aria-label="Nombre de la receta" value={d.nombre} maxLength={150} onChange={(e) => cambiar({ nombre: e.target.value })}
                  placeholder="Ej. Molletes de la casa" className="h-12 text-lg" autoComplete="off" />
              </div>
              <Opciones titulo="¿Para cuándo es?" valor={d.tipo} cambia={(v) => cambiar({ tipo: v })} opciones={Object.entries(TIPOS)} />
              <Opciones titulo="¿Cuánto tarda?" valor={String(d.minutos)} cambia={(v) => cambiar({ minutos: Number(v) })} opciones={TIEMPOS.map((m) => [String(m), m === 60 ? "1 h o más" : `${m} min`])} />
              <Opciones titulo="¿Qué tan difícil?" valor={d.dif} cambia={(v) => cambiar({ dif: v })} opciones={Object.entries(DIF)} />
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 bg-background px-4 py-2">
                <span className="font-semibold" id="r-por">¿Para cuántas personas?</span>
                <Contador valor={d.porciones} cambia={(n) => cambiar({ porciones: n })} min={1} max={12} etiqueta="r-por" />
              </div>
            </>
          )}

          {paso === 1 && (
            <>
              <div className="grid gap-1">
                <h2 ref={titulo} tabIndex={-1} className="text-2xl font-extrabold outline-none">¿Qué lleva?</h2>
                <p className="text-sm text-muted-foreground">Para {d.porciones} {d.porciones === 1 ? "persona" : "personas"}. Pon todo lo que lleva, hasta la sal y el aceite.</p>
              </div>
              {filas.length > 0 && (
                <ul className="grid gap-2">
                  {filas.map((f, i) => (
                    <li key={f.ing.id} className="grid gap-1.5 rounded-2xl border-2 bg-background px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 font-semibold">{f.ing.nombre}</span>
                        <button type="button" aria-label={`Quitar ${f.ing.nombre}`} onClick={() => cambiar({ filas: d.filas.filter((_, j) => j !== i) })}
                          className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-destructive-soft hover:text-destructive"><Trash className="size-5" /></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <Contador chico valor={f.cant} cambia={(n) => fila(i, { cant: n })} max={5000} paso={f.medida === "g" || f.medida === "ml" ? 50 : ENTERAS.has(f.medida) ? 1 : f.cant < 1 ? 0.25 : 0.5} min={ENTERAS.has(f.medida) ? 1 : f.medida === "g" || f.medida === "ml" ? 10 : 0.25} etiqueta="" nombre={`Cantidad de ${f.ing.nombre}`} />
                        {medidasDe(f.ing).length > 1 ? (
                          <select aria-label={`Medida de ${f.ing.nombre}`} value={f.medida} onChange={(e) => fila(i, { medida: e.target.value, cant: e.target.value === "g" || e.target.value === "ml" ? 100 : 1 })}
                            className="min-h-11 min-w-0 max-w-[9.5rem] flex-1 rounded-xl border-2 border-input bg-card px-2 font-semibold">
                            {medidasDe(f.ing).map((m) => <option key={m.n} value={m.n}>{nombreMedida(m.n, f.cant)}</option>)}
                          </select>
                        ) : <span className="font-semibold text-muted-foreground">{nombreMedida("pieza", f.cant)}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-2">
                <div className="relative">
                  <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca: huevo, arroz, pollo…" aria-label="Buscar ingrediente" className="pl-10"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (sugerencias[0]) agregar(sugerencias[0]); } }} />
                </div>
                <p className="text-xs font-semibold text-muted-foreground">{q ? "Toca para agregar" : "Los más usados"}</p>
                <div className="flex flex-wrap gap-2">
                  {sugerencias.map((c) => (
                    <button key={c.id} type="button" onClick={() => agregar(c)}
                      className="flex min-h-11 items-center gap-1 rounded-full border-2 bg-card px-3 text-sm font-semibold hover:border-primary"><Plus className="size-4" aria-hidden />{c.nombre}</button>
                  ))}
                </div>
                {!q && basicos.length > 0 && (
                  <>
                    <p className="pt-1 text-xs font-semibold text-muted-foreground">Básicos de cocina</p>
                    <div className="flex flex-wrap gap-2">
                      {basicos.map((c) => (
                        <button key={c.id} type="button" onClick={() => agregar(c)}
                          className="flex min-h-11 items-center gap-1 rounded-full border-2 border-dashed bg-card px-3 text-sm font-semibold hover:border-primary"><Plus className="size-4" aria-hidden />{c.nombre}</button>
                      ))}
                    </div>
                  </>
                )}
                {q && sugerencias.length === 0 && (
                  <p className="text-sm text-muted-foreground">No tenemos “{busca.trim()}” todavía. Escríbelo en los pasos para que no se te olvide; pronto lo agregamos.</p>
                )}
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <div className="grid gap-1">
                <h2 ref={titulo} tabIndex={-1} className="text-2xl font-extrabold outline-none">¿Cómo se hace?</h2>
                <p className="text-sm text-muted-foreground">Un paso por renglón. Con Enter pasas al siguiente.</p>
              </div>
              <ol className="grid gap-2">
                {d.pasos.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span aria-hidden className="mt-2 grid size-7 shrink-0 place-items-center rounded-full bg-accent font-mono text-sm font-bold text-accent-texto">{i + 1}</span>
                    <textarea aria-label={`Paso ${i + 1}`} value={p} rows={2} id={`r-paso-${i}`}
                      onChange={(e) => cambiar({ pasos: d.pasos.map((y, j) => (j === i ? e.target.value : y)) })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!p.trim()) return;
                          cambiar({ pasos: [...d.pasos.slice(0, i + 1), "", ...d.pasos.slice(i + 1)] });
                          setTimeout(() => document.getElementById(`r-paso-${i + 1}`)?.focus(), 30);
                        }
                      }}
                      placeholder={i === 0 ? "Ej. Calienta el comal a fuego medio." : "Siguiente paso"}
                      className="min-h-11 flex-1 rounded-xl border-2 border-input bg-background px-3 py-2 outline-none focus-visible:border-ring" />
                    {d.pasos.length > 1 && <button type="button" aria-label={`Quitar paso ${i + 1}`} onClick={() => cambiar({ pasos: d.pasos.filter((_, j) => j !== i) })}
                      className="mt-1.5 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-destructive-soft hover:text-destructive"><Trash className="size-5" /></button>}
                  </li>
                ))}
              </ol>
              <Button type="button" variant="ghost" className="w-fit" onClick={() => cambiar({ pasos: [...d.pasos, ""] })}><Plus />Agregar paso</Button>
              <div className="grid gap-1.5"><label htmlFor="r-tip" className="font-semibold">Un tip <span className="font-normal text-muted-foreground">(opcional)</span></label>
                <textarea id="r-tip" rows={2} maxLength={500} value={d.tip} onChange={(e) => cambiar({ tip: e.target.value })} placeholder="Ej. Sale bien barato y aguanta 3 días en el refri."
                  className="rounded-xl border-2 border-input bg-background px-3 py-2 outline-none focus-visible:border-ring" /></div>
              <fieldset className="grid gap-2"><legend className="mb-1 font-semibold">¿Quién la puede ver?</legend>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Quién la puede ver">
                  {[{ v: true, t: "Toda la comunidad", s: "Otros foráneos la ven y la guardan", I: Globe }, { v: false, t: "Solo yo", s: "Igual la puedes mandar con un enlace", I: LockSimple }].map(({ v, t, s, I }) => (
                    <button key={t} type="button" role="radio" aria-checked={d.publica === v} onClick={() => cambiar({ publica: v })}
                      className={cn("flex min-h-16 items-center gap-3 rounded-2xl border-2 bg-background px-4 py-3 text-left", d.publica === v ? "border-primary bg-accent" : "hover:border-foreground/30")}>
                      <I className="size-7 shrink-0 text-primary" weight="duotone" aria-hidden />
                      <span className="grid min-w-0 flex-1"><span className="font-semibold">{t}</span><span className="text-sm text-muted-foreground">{s}</span></span>
                      {d.publica === v && <Check className="size-5 text-primary" weight="bold" aria-hidden />}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
        </div>

        <div className="grid gap-2 border-t pt-3">
          {faltas[paso] && <p className="text-center text-sm text-muted-foreground" role="status">{faltas[paso]}</p>}
          <div className="flex gap-2">
            {paso > 0 && <Button size="lg" variant="outline" onClick={() => setPaso(paso - 1)} aria-label="Atrás"><ArrowLeft weight="bold" /></Button>}
            <Button size="lg" className="flex-1" disabled={!!faltas[paso] || enviando} onClick={() => (ultimo ? publicar() : setPaso(paso + 1))}>
              {enviando ? "Guardando…" : !ultimo ? "Siguiente" : receta ? "Guardar cambios" : d.publica ? "Publicar receta" : "Guardar receta"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Opciones({ titulo, valor, cambia, opciones }: { titulo: string; valor: string; cambia: (v: string) => void; opciones: [string, string][] }) {
  return (
    <fieldset className="grid gap-2"><legend className="mb-1 font-semibold">{titulo}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={titulo}>
        {opciones.map(([v, t]) => (
          <button key={v} type="button" role="radio" aria-checked={valor === v} onClick={() => cambia(v)}
            className={cn("min-h-11 rounded-full border-2 px-4 text-sm font-semibold transition-colors", valor === v ? "border-foreground bg-foreground text-background" : "bg-background hover:border-foreground/30")}>{t}</button>
        ))}
      </div>
    </fieldset>
  );
}

function Contador({ valor, cambia, min, max, paso = 1, etiqueta, nombre, chico }: { valor: number; cambia: (n: number) => void; min: number; max: number; paso?: number; etiqueta: string; nombre?: string; chico?: boolean }) {
  const fmt = (n: number) => (n === 0.25 ? "¼" : n === 0.5 ? "½" : n === 0.75 ? "¾" : n % 1 === 0.5 ? `${Math.floor(n)}½` : String(Math.round(n * 100) / 100));
  return (
    <div className="flex items-center gap-1.5" role="group" aria-labelledby={etiqueta || undefined} aria-label={nombre}>
      <Button type="button" variant="outline" size="icon" className={chico ? "size-11" : undefined} aria-label="Menos" onClick={() => cambia(Math.max(min, Math.round((valor - paso) * 100) / 100))}><Minus /></Button>
      <output className={cn("text-center font-mono text-lg font-bold", chico ? "min-w-8" : "min-w-10")} aria-live="polite">{fmt(valor)}</output>
      <Button type="button" variant="outline" size="icon" className={chico ? "size-11" : undefined} aria-label="Más" onClick={() => cambia(Math.min(max, Math.round((valor + paso) * 100) / 100))}><Plus /></Button>
    </div>
  );
}
