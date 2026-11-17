import { obtenerToken, cerrarSesion } from "./auth-store";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> | null) {
    super(message);
  }
}

function mensajeError(data: unknown): string {
  if (!data) return "Algo salió mal. Intenta otra vez.";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map(mensajeError).join(" ");
  if (typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.detail === "string") return d.detail;
    return Object.values(d).map(mensajeError).join(" ") || "Algo salió mal. Intenta otra vez.";
  }
  return String(data);
}

export async function api<T = unknown>(ruta: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await obtenerToken();
  const resp = await fetch(API_URL + "/api" + ruta, {
    method: opciones.method || "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });
  if (resp.status === 401) {
    await cerrarSesion();
    throw new ApiError("Tu sesión terminó. Entra otra vez.", 401, null);
  }
  const data = resp.status === 204 ? null : await resp.json().catch(() => null);
  if (!resp.ok) throw new ApiError(mensajeError(data), resp.status, data);
  return data as T;
}

/** Junta todas las páginas de una lista paginada de Django REST Framework. */
export async function todos<T>(ruta: string): Promise<T[]> {
  let url: string | null = ruta;
  let salida: T[] = [];
  while (url) {
    const data: T[] | { results: T[]; next: string | null } = await api(url);
    if (Array.isArray(data)) return data;
    salida = salida.concat(data.results);
    url = data.next ? data.next.replace(/^.*\/api/, "") : null;
  }
  return salida;
}
