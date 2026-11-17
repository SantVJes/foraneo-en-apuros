"use client";

import * as React from "react";
import { Check, Desktop, Moon, Sparkle, Sun, TextAa } from "@phosphor-icons/react";

import { aplicarLectura, COLORES, guardarLectura, leerLectura, OPCIONES_LETRA, OSCUROS, TEMAS, TINTAS, type Lectura } from "@/lib/lectura";
import { cn } from "@/lib/utils";

function usePreferencias() {
  const [l, setL] = React.useState<Lectura>({ letra: "normal", grande: false, color: "nopal", tema: "oscuro", oscuro: "pizarra", esquinas: "redondas", tinta: "normal", movimiento: true });
  React.useEffect(() => { const x = leerLectura(); setL(x); aplicarLectura(x); }, []);
  const cambiar = (parcial: Partial<Lectura>) => setL(() => { const n = { ...leerLectura(), ...parcial }; guardarLectura(n); return n; });
  return [l, cambiar] as const;
}

const ICONO_TEMA = { auto: Desktop, claro: Sun, oscuro: Moon };

/** Color de la app y tema claro/oscuro. Se ve el cambio al momento. */
export function ElegirEstilo() {
  const [l, cambiar] = usePreferencias();
  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-semibold">Color</legend>
        <div role="radiogroup" aria-label="Color de la app" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-2">
          {COLORES.map((c) => {
            const activo = l.color === c.v;
            return (
              <button key={c.v} type="button" role="radio" aria-checked={activo} onClick={() => cambiar({ color: c.v })}
                className={cn("flex min-h-12 items-center gap-2.5 rounded-2xl border-2 bg-background px-3 py-2 text-left font-semibold transition-all duration-200 active:scale-95",
                  activo ? "border-foreground shadow-sm" : "hover:border-foreground/30")}>
                <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-full text-white transition-transform duration-300", activo && "scale-110")} style={{ background: c.muestra }}>
                  {activo && <Check className="size-4" weight="bold" />}
                </span>
                {c.t}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-semibold">Tema</legend>
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,6.5rem),1fr))] gap-2">
          {TEMAS.map((t) => {
            const activo = l.tema === t.v, I = ICONO_TEMA[t.v];
            return (
              <button key={t.v} type="button" role="radio" aria-checked={activo} onClick={() => cambiar({ tema: t.v })}
                className={cn("grid min-h-16 justify-items-center gap-1 rounded-2xl border-2 bg-background px-2 py-2 text-sm font-semibold leading-tight transition-all duration-200 active:scale-95",
                  activo ? "border-primary bg-accent shadow-sm" : "hover:border-foreground/30")}>
                <I className={cn("size-6", activo && "icono-rebote")} weight="duotone" aria-hidden />{t.t}
              </button>
            );
          })}
        </div>
      </fieldset>
      {l.tema !== "claro" && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 font-semibold">Fondo del modo oscuro</legend>
          <div role="radiogroup" aria-label="Fondo del modo oscuro" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,6.5rem),1fr))] gap-2">
            {OSCUROS.map((o) => {
              const activo = l.oscuro === o.v;
              return (
                <button key={o.v} type="button" role="radio" aria-checked={activo} onClick={() => cambiar({ oscuro: o.v, tema: l.tema === "auto" ? "auto" : "oscuro" })}
                  className={cn("grid gap-1.5 rounded-2xl border-2 p-2 text-sm font-semibold transition-all duration-200 active:scale-95",
                    activo ? "border-primary" : "hover:border-foreground/30")}>
                  <span aria-hidden className="grid h-14 content-end gap-1 rounded-xl p-1.5" style={{ background: o.fondo }}>
                    <span className="h-2.5 w-3/4 rounded-full" style={{ background: o.tarjeta }} />
                    <span className="h-2.5 w-1/2 rounded-full" style={{ background: o.tarjeta }} />
                  </span>
                  <span className="flex items-center justify-center gap-1">{activo && <Check className="size-4 text-accent-texto" weight="bold" aria-hidden />}{o.t}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-semibold">Color de las letras</legend>
        <div role="radiogroup" aria-label="Color de las letras" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-2">
          {TINTAS.map((t) => {
            const activo = l.tinta === t.v;
            return (
              <button key={t.v} type="button" role="radio" aria-checked={activo} onClick={() => cambiar({ tinta: t.v })}
                className={cn("flex min-h-12 items-center gap-2.5 rounded-2xl border-2 bg-background px-3 py-2 text-left font-semibold transition-all duration-200 active:scale-95",
                  activo ? "border-primary bg-accent" : "hover:border-foreground/30")}>
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border font-display text-lg font-extrabold"
                  style={{ color: l.tema === "claro" ? t.claro : t.oscuro, background: l.tema === "claro" ? "#ffffff" : "#131f24" }}>Aa</span>
                {t.t}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-2 font-semibold">Esquinas</legend>
        <div role="radiogroup" aria-label="Esquinas" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-2">
          {(["redondas", "rectas"] as const).map((e) => {
            const activo = l.esquinas === e;
            return (
              <button key={e} type="button" role="radio" aria-checked={activo} onClick={() => cambiar({ esquinas: e })}
                className={cn("flex min-h-12 items-center gap-2.5 border-2 bg-background px-3 py-2 text-left font-semibold capitalize transition-all duration-200 active:scale-95",
                  e === "redondas" ? "rounded-2xl" : "rounded-md", activo ? "border-primary bg-accent" : "hover:border-foreground/30")}>
                <span aria-hidden className={cn("size-6 shrink-0 border-2 border-current", e === "redondas" ? "rounded-full" : "rounded-[4px]")} />
                {e === "redondas" ? "Redondas" : "Rectas"}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-background px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-accent">
        <Sparkle className="size-7 shrink-0 text-primary" weight="duotone" aria-hidden />
        <span className="grid min-w-0 flex-1 gap-0.5"><span className="font-semibold">Animaciones</span><span className="text-sm text-muted-foreground">Quítalas si te marean o tu celular va lento</span></span>
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={l.movimiento} onChange={(e) => cambiar({ movimiento: e.target.checked })} />
      </label>
    </div>
  );
}

/** Elegir la letra: normal, para dislexia o muy clara, y si se quiere más grande. */
export function ElegirLectura() {
  const [l, cambiar] = usePreferencias();
  return (
    <div className="grid gap-3">
      <div role="radiogroup" aria-label="Tipo de letra" className="grid gap-2">
        {OPCIONES_LETRA.map((o) => {
          const activo = l.letra === o.v;
          return (
            <button key={o.v} type="button" role="radio" aria-checked={activo} onClick={() => cambiar({ letra: o.v })}
              className={cn("flex min-h-14 items-center gap-3 rounded-2xl border-2 bg-background px-4 py-3 text-left transition-all duration-200",
                activo ? "border-primary bg-accent shadow-sm" : "hover:border-foreground/30")}>
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-lg font-bold"
                style={{ fontFamily: o.v === "dislexia" ? "Lexend, sans-serif" : o.v === "clara" ? "'Atkinson Hyperlegible', sans-serif" : undefined }}>Aa</span>
              <span className="grid flex-1 gap-0.5"><span className="font-semibold">{o.t}</span><span className="text-sm text-muted-foreground">{o.d}</span></span>
              {activo && <Check className="size-5 text-accent-texto" weight="bold" aria-hidden />}
            </button>
          );
        })}
      </div>
      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-background px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-accent">
        <TextAa className="size-7 shrink-0 text-primary" weight="duotone" aria-hidden />
        <span className="grid min-w-0 flex-1 gap-0.5"><span className="font-semibold">Letra más grande</span><span className="text-sm text-muted-foreground">Todo se ve un poco más grande</span></span>
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={l.grande} onChange={(e) => cambiar({ grande: e.target.checked })} />
      </label>
    </div>
  );
}
