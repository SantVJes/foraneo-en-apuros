"use client";

import { Img3D } from "@/components/img-3d";
import { cn } from "@/lib/utils";

/* En lugar de fotos, cada platillo lleva un objeto 3D (Fluent Emoji, MIT) que se adivina por su nombre
   (y si no, por la hora del día), sobre un cuadrito de color con volumen. */

type Tono = "verde" | "mango" | "rojo" | "azul" | "morado";
const REGLAS: [RegExp, string, Tono][] = [
  [/camar[oó]n|mariscos?/, "shrimp", "rojo"],
  [/pescado|at[uú]n|salm[oó]n|tilapia|sardina/, "fish", "azul"],
  [/pizza/, "pizza", "rojo"],
  [/hamburguesa/, "hamburger", "rojo"],
  [/hot ?dog|salchicha/, "hot-dog", "rojo"],
  [/sopa|caldo|pozole|consom|crema de|menudo|lentejas/, "steaming-bowl", "azul"],
  [/huevo|omelet|tortilla espa/, "cooking", "mango"],
  [/pollo|tinga|pechuga|alitas|pavo/, "poultry-leg", "mango"],
  [/res\b|bistec|carne|picadillo|alb[oó]ndiga|arrachera|suadero/, "cut-of-meat", "rojo"],
  [/cerdo|chorizo|costilla|pastor|carnitas|chuleta|tocino/, "bacon", "rojo"],
  [/tamal/, "tamale", "mango"],
  [/burrito|wrap|sincronizada/, "burrito", "mango"],
  [/taco|tostada|sope|flauta/, "taco", "rojo"],
  [/chilaquil|enchilada|chile|salsa|mole/, "shallow-pan-of-food", "rojo"],
  [/quesadilla|queso|enfrijolada|molletes/, "cheese-wedge", "mango"],
  [/torta|s[aá]ndwich|sandwich|pan\b|bagel/, "sandwich", "mango"],
  [/aguacate|guacamole/, "avocado", "verde"],
  [/ensalada|verdura|nopal|calabac|espinaca|br[oó]coli|vegetal/, "green-salad", "verde"],
  [/frijol|garbanzo|lenteja/, "beans", "mango"],
  [/avena|granola|cereal/, "bowl-with-spoon", "mango"],
  [/licuado|smoothie|batido/, "cup-with-straw", "morado"],
  [/pl[aá]tano/, "banana", "mango"],
  [/fruta|fresa|manzana|papaya|mango|mel[oó]n|sand[ií]a/, "grapes", "morado"],
  [/naranja|jugo|toronja/, "tangerine", "mango"],
  [/hot ?cake|panqueque/, "pancakes", "morado"],
  [/pastel|postre|panqu|galleta|pay\b|flan|arroz con leche/, "shortcake", "morado"],
  [/arroz|bowl|poke/, "cooked-rice", "azul"],
  [/pasta|espagueti|fideo|macarr|lasa/, "spaghetti", "azul"],
  [/caf[eé]/, "hot-beverage", "mango"],
];
const POR_TIPO: Record<string, [string, Tono]> = { desayuno: ["hot-beverage", "mango"], comida: ["pot-of-food", "verde"], cena: ["steaming-bowl", "morado"] };

export function iconoDe(nombre: string, tipo?: string): [string, Tono] {
  const n = nombre.toLowerCase();
  for (const [re, img, t] of REGLAS) if (re.test(n)) return [img, t];
  return POR_TIPO[tipo || ""] || ["fork-and-knife-with-plate", "verde"];
}

const TAMANOS = {
  sm: "size-11 rounded-[0.9rem] [&>img]:size-8",
  md: "size-14 rounded-[1.1rem] [&>img]:size-10",
  lg: "size-20 rounded-[1.4rem] [&>img]:size-14",
};

/** Cuadrito de color con el objeto 3D del platillo. Es decorativo: el nombre siempre va escrito al lado. */
export function IconoPlatillo({ nombre, tipo, tamano = "sm", className }: { nombre: string; tipo?: string; tamano?: keyof typeof TAMANOS; className?: string }) {
  const [img, tono] = iconoDe(nombre, tipo);
  return (
    <span aria-hidden className={cn("tono grid shrink-0 place-items-center", `tono-${tono}`, TAMANOS[tamano], className)}>
      <Img3D n={img} />
    </span>
  );
}
