"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, TextAa } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Cargando } from "@/components/app-shell";
import { ElegirLectura } from "@/components/elegir-lectura";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useDatos } from "@/lib/datos";
import type { Usuario } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/* Solo dos preguntas antes de ver tu semana: qué comes y cuánto quieres gastar.
   Lo demás (rutina, meta, membresías, ubicación) se pide después, dentro de la app, en "Termina tu perfil". */

const DIETAS = [
  { v: "todo", t: "Como de todo", quita: [] as string[] },
  { v: "vegetariana", t: "Vegetariana", d: "Sin carne ni pescado", quita: ["carne", "pescado", "mariscos"] },
  { v: "vegana", t: "Vegana", d: "Nada de origen animal", quita: ["carne", "pescado", "mariscos", "lacteos", "huevo"] },
  { v: "sin_cerdo", t: "Sin cerdo", quita: ["cerdo"] },
  { v: "sin_gluten", t: "Sin gluten", quita: ["gluten"] },
  { v: "sin_lacteos", t: "Sin lácteos", quita: ["lacteos"] },
];
const ALERGIAS = ["cacahuate", "nueces", "mariscos", "huevo", "soya", "picante"];
const PRESUPUESTOS = [500, 800, 1200, 1500];

export default function Bienvenida() {
  const router = useRouter();
  const { usuario, opciones, setUsuario } = useDatos();
  const u = usuario!;
  const [paso, setPaso] = React.useState(0);
  const [dieta, setDieta] = React.useState("todo");
  const [alergias, setAlergias] = React.useState<string[]>([]);
  const [letra, setLetra] = React.useState(false);
  const [presupuesto, setPresupuesto] = React.useState(String(Math.round(Number(u.presupuesto_semanal)) || 800));
  const [personas, setPersonas] = React.useState(u.personas || 1);
  const [guardando, setGuardando] = React.useState(false);
  const titulo = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => { titulo.current?.focus(); }, [paso]);
  if (!opciones) return <Cargando />;

  const nombreR = (v: string) => opciones.restricciones.find((o) => o.valor === v)?.nombre || v;
  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  async function terminar() {
    setGuardando(true);
    const restricciones = [...new Set([...(DIETAS.find((d) => d.v === dieta)?.quita || []), ...alergias])];
    try {
      const nuevo = await api<Usuario>("/auth/yo/", { method: "PATCH", body: {
        restricciones, presupuesto_semanal: String(Number(presupuesto) || 0), personas,
      } });
      setUsuario(nuevo);
      await api("/planes/", { method: "POST", body: { comidas: ["desayuno", "comida", "cena"], dificultades: [], presupuesto: String(Number(presupuesto) || 0), personas } });
      try { localStorage.setItem("cw_plan", ""); } catch { /* nada */ }
      toast("Listo, ya tienes tu primera semana.");
      router.replace("/semana/");
    } catch (e) { toast((e as Error).message); setGuardando(false); }
  }

  const pasos = [
    {
      titulo: "¿Qué comes?",
      ayuda: "No te sugerimos platillos que no puedas comer.",
      cuerpo: (
        <div className="grid gap-5">
          <div className="grid gap-3 rounded-2xl border-2 border-dashed px-4 py-3">
            <button type="button" aria-expanded={letra} onClick={() => setLetra((x) => !x)} className="flex min-h-11 items-center gap-2 text-left font-semibold text-primary">
              <TextAa className="size-6" weight="duotone" aria-hidden />¿Te cuesta leer en el celular? Cambia la letra
            </button>
            {letra && <ElegirLectura />}
          </div>
          <div role="radiogroup" aria-label="Dieta" className="grid gap-2 sm:grid-cols-2">
            {DIETAS.map((d) => <Fila key={d.v} tipo="radio" activo={dieta === d.v} onClick={() => setDieta(d.v)} titulo={d.t} detalle={d.d} />)}
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-semibold">¿Alguna alergia o algo que no comas? <span className="font-normal text-muted-foreground">(opcional)</span></legend>
            <div className="flex flex-wrap gap-2">
              {ALERGIAS.map((a) => (
                <button key={a} type="button" aria-pressed={alergias.includes(a)} onClick={() => setAlergias((x) => alternar(x, a))}
                  className={cn("min-h-11 rounded-full border-2 px-4 font-semibold transition-colors", alergias.includes(a) ? "border-foreground bg-foreground text-background" : "bg-background hover:border-foreground/30")}>
                  {nombreR(a)}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ),
      listo: true,
    },
    {
      titulo: "¿Cuánto quieres gastar a la semana?",
      ayuda: "En súper, para tus comidas. Te avisamos si te pasas.",
      cuerpo: (
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="pres">Presupuesto en pesos</Label>
            <Input id="pres" type="number" inputMode="numeric" min={0} step={50} value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {PRESUPUESTOS.map((p) => (
                <Button key={p} type="button" size="sm" variant={Number(presupuesto) === p ? "default" : "outline"} onClick={() => setPresupuesto(String(p))}>${p.toLocaleString("es-MX")}</Button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <span className="font-semibold" id="per">¿Para cuántas personas cocinas?</span>
            <div className="flex items-center gap-3" role="group" aria-labelledby="per">
              <Button type="button" variant="outline" size="icon" aria-label="Menos" onClick={() => setPersonas((n) => Math.max(1, n - 1))}>−</Button>
              <output className="w-8 text-center font-mono text-xl font-bold" aria-live="polite">{personas}</output>
              <Button type="button" variant="outline" size="icon" aria-label="Más" onClick={() => setPersonas((n) => Math.min(12, n + 1))}>+</Button>
            </div>
          </div>
        </div>
      ),
      listo: true,
    },
  ];
  const P = pasos[paso];
  const ultimo = paso === pasos.length - 1;

  return (
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Paso {paso + 1} de {pasos.length}</p>
        <div className="flex gap-1.5" aria-hidden>
          {pasos.map((_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= paso ? "bg-primary" : "bg-secondary")} />)}
        </div>
      </div>
      <div key={paso} className="entrar-pantalla grid gap-5">
        <div className="grid gap-1">
          <h1 ref={titulo} tabIndex={-1} className="text-[1.9rem] font-extrabold leading-tight outline-none">{P.titulo}</h1>
          <p className="text-muted-foreground">{P.ayuda}</p>
        </div>
        {P.cuerpo}
      </div>
      <div className="flex gap-2">
        {paso > 0 && <Button type="button" variant="outline" size="lg" onClick={() => setPaso(paso - 1)} aria-label="Atrás"><ArrowLeft weight="bold" /></Button>}
        <Button type="button" size="lg" className="flex-1" disabled={!P.listo || guardando}
          onClick={() => (ultimo ? terminar() : setPaso(paso + 1))}>
          {guardando ? "Armando tu semana…" : ultimo ? "Listo, armar mi semana" : "Siguiente"}
        </Button>
      </div>
      {paso === 0 && <p className="-mt-3 text-center text-sm text-muted-foreground">Tu rutina, tu meta y tu súper los ajustas después, cuando quieras.</p>}
    </div>
  );
}

function Fila({ tipo, activo, onClick, titulo, detalle }: { tipo: "radio" | "checkbox"; activo: boolean; onClick: () => void; titulo: string; detalle?: string }) {
  return (
    <button type="button" role={tipo} aria-checked={activo} onClick={onClick}
      className={cn("flex min-h-14 items-center gap-3 rounded-2xl border-2 bg-background px-4 py-3 text-left transition-all duration-200",
        activo ? "border-primary bg-accent shadow-sm" : "hover:border-foreground/30")}>
      <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center border-2", tipo === "radio" ? "rounded-full" : "rounded-md",
        activo ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
        {activo && <Check className="size-3.5" weight="bold" />}
      </span>
      <span className="grid gap-0.5"><span className="font-semibold">{titulo}</span>{detalle && <span className="text-sm text-muted-foreground">{detalle}</span>}</span>
    </button>
  );
}
