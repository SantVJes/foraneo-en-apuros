"use client";

import * as React from "react";
import { Briefcase, Check, Coffee, CookingPot, House, MoonStars } from "@phosphor-icons/react";

import { Card } from "@/components/ui/card";
import { DIAS, TIPOS } from "@/lib/formato";
import { cn } from "@/lib/utils";

export const TODAS = Object.keys(TIPOS);

/** Rutina con todo en casa, para empezar. */
export const rutinaCompleta = () => Object.fromEntries(DIAS.map((_, d) => [String(d), TODAS])) as Record<string, string[]>;

function Caja({ plano, children }: { plano?: boolean; children: React.ReactNode }) {
  return plano ? <div className="grid gap-4">{children}</div> : <Card className="ancho-completo gap-4">{children}</Card>;
}

const RUTINAS: { nombre: string; Icono: typeof Briefcase; armar: (d: number) => string[] }[] = [
  { nombre: "Como todo en casa", Icono: House, armar: () => TODAS },
  { nombre: "Como fuera entre semana", Icono: Briefcase, armar: (d) => (d < 5 ? ["desayuno", "cena"] : TODAS) },
  { nombre: "No desayuno entre semana", Icono: Coffee, armar: (d) => (d < 5 ? ["comida", "cena"] : TODAS) },
];
const ICONO: Record<string, typeof Coffee> = { desayuno: Coffee, comida: CookingPot, cena: MoonStars };

/** Qué comidas haces en casa cada día. El menú y la lista de compras solo llevan esas. */
export function Rutina({ rutina, setRutina, plano }: { rutina: Record<string, string[]>; setRutina: React.Dispatch<React.SetStateAction<Record<string, string[]>>>; plano?: boolean }) {
  const alternar = (d: number, t: string) => setRutina((r) => {
    const hoy = r[String(d)];
    return { ...r, [String(d)]: hoy.includes(t) ? hoy.filter((x) => x !== t) : TODAS.filter((x) => x === t || hoy.includes(x)) };
  });
  const total = Object.values(rutina).reduce((n, v) => n + v.length, 0);
  return (
    <Caja plano={plano}>
      {!plano && (
        <div className="grid gap-1">
          <h2 className="text-2xl font-bold">Tu rutina</h2>
          <p className="text-sm text-muted-foreground">¿Qué comidas haces en casa? Si comes fuera (trabajo, escuela, fonda), no te ponemos esa comida.</p>
        </div>
      )}
      <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-semibold">Elige rápido</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {RUTINAS.map(({ nombre, Icono, armar }) => {
            const igual = DIAS.every((_, d) => armar(d).join() === (rutina[String(d)] || []).join());
            return (
              <button key={nombre} type="button" aria-pressed={igual} onClick={() => setRutina(Object.fromEntries(DIAS.map((_, d) => [String(d), armar(d)])))}
                className={cn("flex min-h-12 items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left text-sm font-semibold transition-colors",
                  igual ? "border-primary bg-accent" : "bg-background hover:border-foreground/30")}>
                <Icono className="size-6 shrink-0 text-primary" weight="duotone" aria-hidden /><span className="min-w-0 flex-1">{nombre}</span>
                {igual && <Check className="size-5 shrink-0 text-primary" weight="bold" aria-hidden />}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-1">
        <p className="text-sm font-semibold">O toca cada comida para quitarla o ponerla</p>
        <table className="w-full table-fixed border-separate border-spacing-x-1.5 border-spacing-y-1.5">
          <thead>
            <tr>
              <th className="w-[3.25rem]"><span className="sr-only">Día</span></th>
              {TODAS.map((t) => { const I = ICONO[t]; return (
                <th key={t} scope="col" className="text-center font-normal">
                  <span className="grid justify-items-center gap-0.5 text-xs font-semibold text-muted-foreground"><I className="size-5" weight="duotone" aria-hidden /><span className="max-w-full hyphens-auto break-words leading-tight" lang="es">{TIPOS[t]}</span></span>
                </th>
              ); })}
            </tr>
          </thead>
          <tbody>
            {DIAS.map((dia, d) => (
              <tr key={dia}>
                <th scope="row" className="text-left text-sm font-semibold"><span className="sm:hidden">{dia.slice(0, 3)}</span><span className="hidden sm:inline">{dia}</span></th>
                {TODAS.map((t) => {
                  const si = rutina[String(d)].includes(t);
                  return (
                    <td key={t}>
                      <button type="button" aria-pressed={si} aria-label={`${dia}, ${TIPOS[t]}: ${si ? "en casa" : "fuera"}`} onClick={() => alternar(d, t)}
                        className={cn("grid h-11 w-full place-items-center rounded-xl border-2 transition-all duration-200 active:scale-95",
                          si ? "border-primary bg-primary text-primary-foreground" : "border-dashed text-muted-foreground hover:border-foreground/40")}>
                        {si ? <Check className="size-5" weight="bold" aria-hidden /> : <span className="text-xs font-semibold">Fuera</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rounded-xl bg-secondary px-3 py-2 text-sm font-semibold" aria-live="polite">Cocinas {total} de 21 comidas a la semana. Solo esas entran a tu menú y a tu lista.</p>
    </Caja>
  );
}
