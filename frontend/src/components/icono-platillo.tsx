"use client";

import {
  Avocado, Bird, Bone, BowlFood, BowlSteam, Bread, Cake, Cheese, Cherries, Coffee, CookingPot, Cow, Egg, Fish,
  ForkKnife, Grains, Hamburger, Leaf, OrangeSlice, Pepper, Pizza, Shrimp, type Icon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/* En lugar de fotos usamos un ícono por platillo: se adivina por su nombre (y si no, por la hora).
   Todos son de Phosphor, la misma familia del resto de la app, en estilo duotono. */

type Tono = "verde" | "mango" | "rojo" | "azul" | "morado";
const REGLAS: [RegExp, Icon, Tono][] = [
  [/camar[oó]n|mariscos?/, Shrimp, "rojo"],
  [/pescado|at[uú]n|salm[oó]n|tilapia|sardina/, Fish, "azul"],
  [/pizza/, Pizza, "rojo"],
  [/hamburguesa/, Hamburger, "rojo"],
  [/sopa|caldo|pozole|consom|crema de|menudo|lentejas/, BowlSteam, "azul"],
  [/huevo|omelet|tortilla espa/, Egg, "mango"],
  [/pollo|tinga|pechuga|alitas|pavo/, Bird, "mango"],
  [/res\b|bistec|carne|picadillo|alb[oó]ndiga|arrachera|suadero/, Cow, "rojo"],
  [/cerdo|chorizo|costilla|pastor|carnitas|chuleta/, Bone, "rojo"],
  [/quesadilla|queso|enfrijolada|molletes/, Cheese, "mango"],
  [/chilaquil|enchilada|taco|chile|salsa|tostada|sope|mole/, Pepper, "rojo"],
  [/torta|s[aá]ndwich|sandwich|pan\b|bagel|wrap/, Bread, "mango"],
  [/aguacate|guacamole/, Avocado, "verde"],
  [/ensalada|verdura|nopal|calabac|espinaca|br[oó]coli|vegetal/, Leaf, "verde"],
  [/avena|granola|cereal|frijol|garbanzo/, Grains, "mango"],
  [/licuado|smoothie|fruta|pl[aá]tano|fresa|manzana|papaya|mango/, Cherries, "morado"],
  [/naranja|jugo|toronja/, OrangeSlice, "mango"],
  [/hot ?cake|pastel|postre|panqu|galleta|pay\b|flan|arroz con leche/, Cake, "morado"],
  [/arroz|bowl|poke|pasta|espagueti|fideo|macarr|lasa/, BowlFood, "azul"],
  [/caf[eé]/, Coffee, "mango"],
];
const POR_TIPO: Record<string, [Icon, Tono]> = { desayuno: [Coffee, "mango"], comida: [CookingPot, "verde"], cena: [BowlFood, "morado"] };

export function iconoDe(nombre: string, tipo?: string): [Icon, Tono] {
  const n = nombre.toLowerCase();
  for (const [re, I, t] of REGLAS) if (re.test(n)) return [I, t];
  return POR_TIPO[tipo || ""] || [ForkKnife, "verde"];
}

const TAMANOS = { sm: "size-10 rounded-xl [&>svg]:size-6", md: "size-12 rounded-2xl [&>svg]:size-7", lg: "size-16 rounded-2xl [&>svg]:size-10" };

/** Cuadrito de color con el ícono del platillo. Es decorativo: el nombre siempre va escrito al lado. */
export function IconoPlatillo({ nombre, tipo, tamano = "sm", className }: { nombre: string; tipo?: string; tamano?: keyof typeof TAMANOS; className?: string }) {
  const [I, tono] = iconoDe(nombre, tipo);
  return (
    <span aria-hidden className={cn("tono grid shrink-0 place-items-center", `tono-${tono}`, TAMANOS[tamano], className)}>
      <I weight="duotone" />
    </span>
  );
}
