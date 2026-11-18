/* Misma interfaz que src/lib/api.ts, pero la "API" corre dentro del navegador. */
import { manejar, ErrorLocal } from "./api-local";

export const API_URL = "";

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> | null) { super(message); }
}
function mensaje(data: unknown): string {
  if (!data) return "Algo salió mal. Intenta otra vez.";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map(mensaje).join(" ");
  if (typeof data === "object") { const d = data as Record<string, unknown>; if (typeof d.detail === "string") return d.detail; return Object.values(d).map(mensaje).join(" "); }
  return String(data);
}
export async function api<T = unknown>(ruta: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  try {
    const r = await manejar(opciones.method || "GET", ruta, (opciones.body as Record<string, unknown>) || {});
    return JSON.parse(JSON.stringify(r ?? null)) as T;
  } catch (e) {
    if (e instanceof ErrorLocal) throw new ApiError(mensaje(e.data), e.status, e.data);
    console.error(e);
    throw new ApiError("Algo salió mal. Intenta otra vez.", 500, null);
  }
}
export async function todos<T>(ruta: string): Promise<T[]> { return api<T[]>(ruta); }
