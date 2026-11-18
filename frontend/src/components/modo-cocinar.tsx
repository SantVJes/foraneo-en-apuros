"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CheckCircle } from "@phosphor-icons/react";

import { EscenaPaso } from "@/components/escena-preparacion";
import { Img3D } from "@/components/img-3d";
import { imagenIngrediente } from "@/components/receta-explotada";
import { IconoPlatillo } from "@/components/icono-platillo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cantidad } from "@/lib/formato";
import type { Platillo } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Separa "1. Pica…\n2. Fríe…" en pasos limpios. */
export function pasosDe(texto: string) {
  return texto.split("\n").map((p) => p.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter(Boolean);
}

/* Modo cocinar: un paso por pantalla, letra grande, la pantalla no se apaga y, si el paso dice
   "10 minutos", te ofrece un temporizador. Primero te enseña qué juntar. */
export function ModoCocinar({ platillo, personas, onClose, alTerminar }: {
  platillo: Platillo | null; personas?: number; onClose: () => void; alTerminar?: React.ReactNode;
}) {
  const [paso, setPaso] = React.useState(-1);
  const [juntado, setJuntado] = React.useState<Set<number>>(new Set());
  React.useEffect(() => { setPaso(-1); setJuntado(new Set()); }, [platillo?.id]);
  usePantallaEncendida(!!platillo);
  if (!platillo) return null;
  const pasos = pasosDe(platillo.pasos || "");
  const total = pasos.length;
  const factor = personas ? personas / (platillo.porciones || 1) : 1;
  const fin = paso >= total;
  const minutos = !fin && paso >= 0 ? Number(/(\d+)\s*(?:min|minutos)/i.exec(pasos[paso])?.[1] || 0) : 0;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="h-[100dvh] max-h-[100dvh] rounded-none sm:h-[min(92dvh,760px)] sm:rounded-3xl">
        <div className="flex items-center gap-3 pr-10">
          <IconoPlatillo nombre={platillo.nombre} tipo={platillo.tipo_comida} />
          <div className="grid min-w-0">
            <SheetTitle className="truncate text-lg">{platillo.nombre}</SheetTitle>
            <SheetDescription>{paso < 0 ? "Antes de empezar" : fin ? "¡Terminaste!" : `Paso ${paso + 1} de ${total}`}</SheetDescription>
          </div>
        </div>
        <div className="flex gap-1" aria-hidden>
          {[-1, ...pasos.map((_, i) => i)].map((i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= paso || fin ? "bg-primary" : "bg-secondary")} />)}
        </div>

        <div className="grid flex-1 content-start gap-4 overflow-y-auto py-2" aria-live="polite">
          {paso < 0 && (
            <>
              <p className="text-xl font-bold">Junta esto primero</p>
              <ul className="juntar-lista grid gap-2">
                {platillo.ingredientes.map((i, n) => {
                  const ok = juntado.has(i.ingrediente_id);
                  return (
                    <li key={i.ingrediente_id} style={{ "--i": n } as React.CSSProperties}>
                      <label className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-background px-4 text-lg transition-colors", ok && "juntado border-primary bg-accent")}>
                        <input type="checkbox" className="palomita shrink-0" checked={ok}
                          onChange={() => setJuntado((s) => { const n = new Set(s); if (n.has(i.ingrediente_id)) n.delete(i.ingrediente_id); else n.add(i.ingrediente_id); return n; })} />
                        <Img3D key={String(ok)} n={imagenIngrediente(i.nombre)} className="size-8 shrink-0" />
                        <span className={cn("flex-1", ok && "text-muted-foreground line-through")}>{i.nombre}</span>
                        <span className="font-mono text-base text-muted-foreground">{cantidad(Number(i.cantidad) * factor, i.unidad)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {paso >= 0 && !fin && (
            <>
              <EscenaPaso key={`e${paso}`} texto={pasos[paso]} ingredientes={platillo.ingredientes} />
              <div key={`t${paso}`} className="deslizar-adelante flex items-start gap-3">
                <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-accent font-mono text-xl font-bold text-accent-texto">{paso + 1}</span>
                <p className="cocinar-paso font-semibold">{pasos[paso]}</p>
              </div>
              {minutos > 0 && <Temporizador key={paso} minutos={minutos} />}
            </>
          )}
          {fin && (
            <div className="confeti grid justify-items-center gap-4 py-6 text-center">
              {Array.from({ length: 14 }, (_, c) => <i key={c} aria-hidden style={{ "--c": c } as React.CSSProperties} />)}
              <Img3D n="party-popper" prioridad className="icono-rebote size-24" />
              <p className="text-2xl font-extrabold">¡Buen provecho!</p>
              <p className="text-muted-foreground">Te salió {platillo.nombre.toLowerCase()} hecho en casa.</p>
              {alTerminar}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" variant="outline" onClick={() => (paso < 0 ? onClose() : setPaso((p) => p - 1))}><ArrowLeft />{paso < 0 ? "Salir" : "Atrás"}</Button>
          {fin ? <Button size="lg" onClick={onClose}><CheckCircle weight="fill" />Cerrar</Button>
            : <Button size="lg" onClick={() => setPaso((p) => p + 1)}>{paso < 0 ? "Empezar" : paso === total - 1 ? "Terminé" : "Siguiente"}<ArrowRight /></Button>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Temporizador({ minutos }: { minutos: number }) {
  const [fin, setFin] = React.useState<number | null>(null);
  const [ahora, setAhora] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!fin) return;
    const t = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(t);
  }, [fin]);
  const resta = fin ? Math.max(0, Math.round((fin - ahora) / 1000)) : minutos * 60;
  React.useEffect(() => { if (fin && resta === 0) navigator.vibrate?.([300, 150, 300]); }, [fin, resta]);
  const mmss = `${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, "0")}`;
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border-2 bg-background p-3", fin && resta === 0 && "border-primary bg-accent")}>
      <Img3D n="timer-clock" className="size-10" />
      <span className="flex-1 font-mono text-3xl font-bold" role="timer" aria-label={`Quedan ${mmss}`}>{fin && resta === 0 ? "¡Ya!" : mmss}</span>
      <Button variant={fin ? "ghost" : "default"} onClick={() => setFin(fin ? null : Date.now() + minutos * 60000)}>{fin ? "Reiniciar" : "Iniciar"}</Button>
    </div>
  );
}

/** Pide que la pantalla no se apague mientras cocinas (si el navegador deja). */
function usePantallaEncendida(activo: boolean) {
  React.useEffect(() => {
    if (!activo || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const pedir = () => (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<typeof lock> } }).wakeLock.request("screen").then((l) => { lock = l; }).catch(() => {});
    pedir();
    const alVolver = () => document.visibilityState === "visible" && pedir();
    document.addEventListener("visibilitychange", alVolver);
    return () => { document.removeEventListener("visibilitychange", alVolver); lock?.release().catch(() => {}); };
  }, [activo]);
}
