"use client";

import * as React from "react";

import { api } from "./api";
import type { Plan } from "./tipos";

const CLAVE = "cw_plan";
const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardar = (v: string | null) => { try { if (v) localStorage.setItem(CLAVE, v); else localStorage.removeItem(CLAVE); } catch { /* nada */ } };

/** Tus semanas guardadas y la que estás viendo (se recuerda en este navegador). */
export function usePlanes() {
  const [planes, setPlanes] = React.useState<Plan[]>([]);
  const [elegido, setElegido] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);

  const recargar = React.useCallback(async (verId?: number) => {
    const data = await api<{ results: Plan[] } | Plan[]>("/planes/");
    setPlanes(Array.isArray(data) ? data : data.results);
    if (verId !== undefined) { guardar(String(verId)); setElegido(String(verId)); }
    setCargando(false);
  }, []);

  React.useEffect(() => { setElegido(leer()); recargar().catch(() => setCargando(false)); }, [recargar]);

  const plan = planes.find((p) => String(p.id) === elegido) || planes[0] || null;
  const elegir = (id: number) => { guardar(String(id)); setElegido(String(id)); };
  return { planes, plan, elegir, recargar, cargando };
}
