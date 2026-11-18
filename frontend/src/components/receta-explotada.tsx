"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { ArrowsOutSimple, CookingPot, Minus, Plus, X } from "@phosphor-icons/react";

import { iconoDe } from "@/components/icono-platillo";
import { Img3D } from "@/components/img-3d";
import { Button } from "@/components/ui/button";
import { cantidad } from "@/lib/formato";
import { cn } from "@/lib/utils";

/* Vista "explotada" de una receta: el platillo en medio y cada ingrediente sale volando a su lugar
   alrededor, con su objeto 3D y cuánto lleva. Puedes cambiar para cuántas personas y las cantidades se ajustan. */

type IngVista = { ingrediente_id: number; nombre: string; cantidad: string | number; unidad: string; es_basico?: boolean };
type RecetaVista = { nombre: string; tipo_comida: string; porciones: number; ingredientes: IngVista[] };

const IMG_ING: [RegExp, string][] = [
  [/tortilla/, "flatbread"], [/aceite de oliva/, "olive"], [/aceite/, "jar"], [/aguacate/, "avocado"], [/ajo/, "garlic"], [/harina de ma[ií]z|elote|ma[ií]z/, "ear-of-corn"],
  [/harina|avena|granola/, "sheaf-of-rice"], [/arroz/, "cooked-rice"], [/at[uú]n|salm[oó]n|pescado/, "fish"], [/camar[oó]n/, "shrimp"],
  [/az[uú]car|sal$|^sal\b|comino|canela|pimienta|consom/, "salt"], [/br[oó]coli/, "broccoli"], [/cacahuate/, "peanuts"],
  [/calabac|pepino/, "cucumber"], [/pollo|pechuga/, "poultry-leg"], [/tocino|jam[oó]n/, "bacon"], [/chorizo|salchicha/, "hot-dog"],
  [/res|carne|cerdo|lomo|bistec/, "cut-of-meat"], [/cebolla/, "onion"], [/champi/, "mushroom"], [/chile|chipotle|guajillo|poblano|serrano/, "hot-pepper"],
  [/cilantro|or[eé]gano|perejil|epazote/, "herb"], [/crema|yogurt/, "custard"], [/espinaca|lechuga|nopal/, "leafy-green"], [/fresa/, "strawberry"],
  [/frijol|garbanzo|lenteja/, "beans"], [/huevo/, "egg"], [/leche/, "glass-of-milk"], [/jitomate|tomate/, "tomato"], [/lim[oó]n/, "lemon"],
  [/mantequilla/, "butter"], [/mayonesa|mole|soya|salsa/, "jar"], [/miel/, "honey-pot"], [/pan\b|bolillo/, "bread"], [/papa\b/, "potato"],
  [/pasta|espagueti/, "spaghetti"], [/pimiento/, "bell-pepper"], [/pl[aá]tano/, "banana"], [/queso/, "cheese-wedge"],
  [/zanahoria/, "carrot"], [/manzana/, "red-apple"], [/pur[eé]|lata/, "canned-food"],
];
export function imagenIngrediente(nombre: string) {
  const n = nombre.toLowerCase();
  for (const [re, img] of IMG_ING) if (re.test(n)) return img;
  return "canned-food";
}

/** Posiciones en círculo (dos anillos si son muchos), en % del cuadro. */
function lugares(n: number) {
  const dos = n > 9;
  return Array.from({ length: n }, (_, i) => {
    const exterior = !dos || i % 2 === 0;
    const r = dos ? (exterior ? 41 : 26) : 38;
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
  });
}

export function RecetaExplotada({ receta, className }: { receta: RecetaVista; className?: string }) {
  const [abierta, setAbierta] = React.useState(false);
  const [estado, setEstado] = React.useState<"armado" | "suelto" | "preparando" | "listo">("armado");
  const suelto = estado === "suelto";
  const [personas, setPersonas] = React.useState(receta.porciones || 1);
  React.useEffect(() => setPersonas(receta.porciones || 1), [receta]);
  React.useEffect(() => {
    if (!abierta) { setEstado("armado"); return; }
    const t = setTimeout(() => setEstado("suelto"), 120);
    return () => clearTimeout(t);
  }, [abierta]);

  const ings = receta.ingredientes;
  const pos = lugares(ings.length);
  const factor = personas / (receta.porciones || 1);
  const [platillo, tono] = iconoDe(receta.nombre, receta.tipo_comida);
  const preparar = () => {
    setEstado("preparando");
    window.setTimeout(() => setEstado((e) => (e === "preparando" ? "listo" : e)), ings.length * 150 + 900);
  };

  return (
    <D.Root open={abierta} onOpenChange={setAbierta}>
      <D.Trigger asChild>
        <Button variant="outline" className={className}><ArrowsOutSimple weight="bold" />Desarmar receta</Button>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content className="explotada superficie fixed inset-x-3 top-1/2 z-50 mx-auto grid max-h-[94dvh] max-w-xl -translate-y-1/2 gap-3 overflow-y-auto rounded-[1.8rem] p-4 sm:p-6
          data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-start gap-3">
            <div className="grid flex-1 gap-0.5">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receta desarmada · {ings.length} ingredientes</span>
              <D.Title className="font-display text-2xl font-extrabold leading-tight">{receta.nombre}</D.Title>
              {estado === "listo" && <span className="entrar-pantalla text-sm font-semibold text-accent-texto" role="status">¡Listo! Todo junto da {receta.nombre.toLowerCase()}.</span>}
              <D.Description className="sr-only">Cada ingrediente de la receta con la cantidad que lleva.</D.Description>
            </div>
            <D.Close asChild><Button variant="ghost" size="icon" aria-label="Cerrar"><X weight="bold" /></Button></D.Close>
          </div>

          {/* El diagrama: decorativo para lectores de pantalla, que reciben la lista de abajo. */}
          <div aria-hidden className={cn("explotada-escena relative mx-auto aspect-square w-full max-w-[26rem]", estado)}>
            <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {pos.map((p, i) => (
                <line key={i} x1="50" y1="50" x2={50 + (p.x - 50) * 0.6} y2={50 + (p.y - 50) * 0.6} className="explotada-linea" style={{ transitionDelay: `${120 + i * 45}ms` }} />
              ))}
            </svg>
            <div className={cn("explotada-centro tono absolute left-1/2 top-1/2 grid size-[30%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[28%]", `tono-${tono}`)}>
              <Img3D n={platillo} prioridad className="size-[78%]" />
            </div>
            {estado === "listo" && <div className="explotada-vapor"><i /><i /><i /></div>}
            {ings.map((i, n) => (
              <div key={i.ingrediente_id} className="explotada-pieza absolute grid w-[22%] justify-items-center gap-0.5 text-center"
                style={{ "--x": `${pos[n].x}%`, "--y": `${pos[n].y}%`, "--i": n, transitionDelay: `${n * (estado === "preparando" ? 150 : 45)}ms` } as React.CSSProperties}>
                <span className="explotada-burbuja grid aspect-square w-[62%] place-items-center rounded-full">
                  <Img3D n={imagenIngrediente(i.nombre)} prioridad className="size-[80%]" />
                </span>
                <span className="line-clamp-2 text-[0.7rem] font-semibold leading-tight sm:text-xs">{i.nombre}</span>
                <span className="font-mono text-[0.65rem] text-muted-foreground sm:text-[0.7rem]">{cantidad(Number(i.cantidad) * factor, i.unidad)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Para</span>
              <Button variant="outline" size="icon" aria-label="Menos personas" onClick={() => setPersonas((p) => Math.max(1, p - 1))}><Minus /></Button>
              <span className="w-6 text-center font-mono font-bold" aria-live="polite">{personas}</span>
              <Button variant="outline" size="icon" aria-label="Más personas" onClick={() => setPersonas((p) => Math.min(20, p + 1))}><Plus /></Button>
              <span className="text-sm font-semibold">{personas === 1 ? "persona" : "personas"}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEstado(suelto ? "armado" : "suelto")}>{suelto ? "Armar" : "Desarmar"}</Button>
              <Button onClick={estado === "suelto" ? preparar : () => { setEstado("suelto"); window.setTimeout(preparar, 700); }} disabled={estado === "preparando"}>
                <CookingPot weight="fill" />{estado === "listo" ? "Otra vez" : "Ver cómo se prepara"}</Button>
            </div>
          </div>

          <ul className="grid gap-1.5 sm:grid-cols-2 sm:gap-x-6">
            {ings.map((i) => (
              <li key={i.ingrediente_id} className="flex items-center gap-2 border-b border-dashed pb-1.5">
                <Img3D n={imagenIngrediente(i.nombre)} className="size-7" />
                <span className="flex-1">{i.nombre}</span>
                <span className="font-mono text-sm">{cantidad(Number(i.cantidad) * factor, i.unidad)}</span>
              </li>
            ))}
          </ul>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
