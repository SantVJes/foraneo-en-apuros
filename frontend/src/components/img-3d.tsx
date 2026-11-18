import { cn } from "@/lib/utils";

/* Objetos 3D de Fluent Emoji (Microsoft, licencia MIT), guardados en public/3d como WebP de ~4 KB.
   Son decorativos: el texto siempre dice lo mismo al lado, así que van con alt vacío. */

export function Img3D({ n, className, prioridad }: { n: string; className?: string; prioridad?: boolean }) {
  return (
    <img src={`/3d/${n}.webp`} alt="" aria-hidden width={192} height={192} draggable={false}
      loading={prioridad ? "eager" : "lazy"} decoding="async"
      className={cn("objeto-3d pointer-events-none select-none", className)} />
  );
}

/* Escena de la cabecera de cada pantalla: un panel de color con objetos 3D que se asoman por arriba. */
export type Tono = "nopal" | "mango" | "uva" | "talavera" | "jamaica";
export type Escena = { tono: Tono; grande: string; chico?: string; mini?: string };

export const ESCENAS = {
  semana: { tono: "nopal", grande: "spiral-calendar", chico: "avocado", mini: "sparkles" },
  lista: { tono: "mango", grande: "shopping-cart", chico: "receipt", mini: "coin" },
  recetas: { tono: "uva", grande: "cook", chico: "open-book", mini: "sparkles" },
  alacena: { tono: "talavera", grande: "jar", chico: "bread", mini: "egg" },
  yo: { tono: "nopal", grande: "student", chico: "house", mini: "sparkles" },
  meta: { tono: "jamaica", grande: "flexed-biceps", chico: "red-apple", mini: "stopwatch" },
} satisfies Record<string, Escena>;

export function ObjetosEscena({ escena }: { escena: Escena }) {
  return (
    <div aria-hidden className="escena-objetos">
      <Img3D n={escena.grande} prioridad className="e-grande" />
      {escena.chico && <Img3D n={escena.chico} prioridad className="e-chico" />}
      {escena.mini && <Img3D n={escena.mini} prioridad className="e-mini" />}
    </div>
  );
}
