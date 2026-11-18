"use client";

import * as React from "react";

import { Img3D } from "@/components/img-3d";
import { imagenIngrediente } from "@/components/receta-explotada";
import { cn } from "@/lib/utils";

/* Animación de cada paso de la receta: adivina la acción por el verbo del paso (picar, hervir, freír,
   mezclar, hornear, servir, lavar) y los ingredientes que menciona, y los anima en 3D.
   Es decorativa: el texto del paso siempre va debajo. */

type Accion = "picar" | "hervir" | "freir" | "mezclar" | "hornear" | "servir" | "lavar" | "cocinar";
const REGLAS: [RegExp, Accion][] = [
  [/\b(lava|enjuaga|remoja|escurre)/, "lavar"],
  [/\b(pica|corta|rebana|pela|ralla|desgrana|deshebra|aplana|rompe)/, "picar"],
  [/\b(lic[uú]a|mezcla|bate|revuelve|machaca|unta|amasa|forma|haz bolitas|endulza)/, "mezclar"],
  [/\b(hornea|gratina|tuesta|asa|tatem)/, "hornear"],
  [/\b(fr[ií]e|fre[ií]r|dora|sart[eé]n|sofr[ií]e)/, "freir"],
  [/\b(hierve|hervir|cuece|cocina|calienta|tapa|deja hervir|caldo)/, "hervir"],
  [/\b(sirve|acompa[nñ]a|pon (encima|el|la|los)|agrega .* al final|decora)/, "servir"],
];
const RECIPIENTE: Record<Accion, string> = {
  picar: "kitchen-knife", hervir: "pot-of-food", freir: "cooking", mezclar: "bowl-with-spoon",
  hornear: "fire", servir: "fork-and-knife-with-plate", lavar: "droplet", cocinar: "cook",
};
export const NOMBRE_ACCION: Record<Accion, string> = {
  picar: "Picar", hervir: "Hervir", freir: "Freír", mezclar: "Mezclar", hornear: "Al fuego", servir: "Servir", lavar: "Lavar", cocinar: "Cocinar",
};

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function accionDe(texto: string): Accion {
  const t = texto.toLowerCase();
  for (const [re, a] of REGLAS) if (re.test(t)) return a;
  return "cocinar";
}

/** Ingredientes que el paso menciona (por la primera palabra de su nombre: "chile", "jitomate"...). */
export function mencionados(texto: string, ingredientes: { nombre: string }[]) {
  const t = sinAcentos(texto);
  return ingredientes.filter((i) => {
    const raiz = sinAcentos(i.nombre).split(" ")[0].replace(/(es|s)$/, "");
    return raiz.length >= 3 && t.includes(raiz);
  }).slice(0, 3);
}

export function EscenaPaso({ texto, ingredientes, className }: { texto: string; ingredientes: { nombre: string }[]; className?: string }) {
  const accion = accionDe(texto);
  const ings = mencionados(texto, ingredientes);
  return (
    <div aria-hidden className={cn("escena-paso", `accion-${accion}`, className)}>
      <span className="escena-paso-etiqueta">{NOMBRE_ACCION[accion]}</span>
      <div className="escena-paso-mesa" />
      {accion === "picar" && <div className="escena-tabla" />}
      {(accion === "hervir" || accion === "freir" || accion === "hornear") && (
        <div className="escena-vapor"><i /><i /><i /></div>
      )}
      {accion === "freir" && <div className="escena-chispas"><i /><i /><i /><i /><i /></div>}
      {accion === "hervir" && <div className="escena-burbujas"><i /><i /><i /><i /></div>}
      {accion === "lavar" && <div className="escena-gotas"><i /><i /><i /><i /><i /><i /></div>}
      {accion === "servir" && <div className="escena-brillos"><Img3D n="sparkles" className="size-8" /></div>}
      <Img3D n={RECIPIENTE[accion]} prioridad className="escena-recipiente" />
      {ings.map((i, n) => (
        <Img3D key={i.nombre} n={imagenIngrediente(i.nombre)} prioridad className="escena-ingrediente"
          style={{ "--n": n, "--lado": n % 2 ? 1 : -1 } as React.CSSProperties} />
      ))}
      {accion === "picar" && ings.length > 0 && <div className="escena-trocitos"><i /><i /><i /><i /></div>}
    </div>
  );
}
