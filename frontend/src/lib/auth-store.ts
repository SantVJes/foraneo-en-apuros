/* Sesión: con Supabase (producción) o con el login propio de Django (modo local, sin Supabase). */
import { supabase } from "./supabase";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const LOCAL = "cw_local_tokens";

type Tokens = { access: string; refresh: string };
const leerLocal = (): Tokens | null => {
  try { return JSON.parse(localStorage.getItem(LOCAL) || "null"); } catch { return null; }
};
const guardarLocal = (t: Tokens | null) => {
  try { if (t) localStorage.setItem(LOCAL, JSON.stringify(t)); else localStorage.removeItem(LOCAL); } catch { /* sin almacenamiento */ }
  oyentes.forEach((f) => f());
};

const oyentes = new Set<() => void>();
export function alCambiarSesion(f: () => void) {
  oyentes.add(f);
  const sub = supabase?.auth.onAuthStateChange(() => f());
  return () => { oyentes.delete(f); sub?.data.subscription.unsubscribe(); };
}

export const usaSupabase = !!supabase;

export async function haySesion(): Promise<boolean> {
  if (supabase) return !!(await supabase.auth.getSession()).data.session;
  return !!leerLocal();
}

function venceProntito(jwt: string) {
  try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000 < Date.now() + 30_000; }
  catch { return true; }
}

export async function obtenerToken(): Promise<string | null> {
  if (supabase) return (await supabase.auth.getSession()).data.session?.access_token ?? null;
  const t = leerLocal();
  if (!t) return null;
  if (!venceProntito(t.access)) return t.access;
  const r = await fetch(API + "/api/auth/refresh/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: t.refresh }) });
  if (!r.ok) { guardarLocal(null); return null; }
  const nuevo = { ...t, access: (await r.json()).access };
  guardarLocal(nuevo);
  return nuevo.access;
}

export async function entrarConGoogle() {
  if (!supabase) throw new Error("Configura Supabase para entrar con Google.");
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/semana/` } });
  if (error) throw error;
}

/** Correo y contraseña: con Supabase o con Django en modo local. Regresa un aviso si hay que confirmar el correo. */
export async function entrarConCorreo(modo: "entrar" | "registro", email: string, password: string, nombre = ""): Promise<string | null> {
  if (supabase) {
    if (modo === "registro") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: nombre }, emailRedirectTo: `${location.origin}/semana/` } });
      if (error) throw error;
      return data.session ? null : "Te mandamos un correo para confirmar tu cuenta.";
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
    return null;
  }
  const r = await fetch(API + (modo === "registro" ? "/api/auth/registro/" : "/api/auth/login/"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(modo === "registro" ? { email, password, first_name: nombre } : { email, password }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.detail || Object.values(data || {}).flat().join(" ") || "No se pudo entrar.");
  guardarLocal({ access: data.access, refresh: data.refresh });
  return null;
}

export async function cerrarSesion() {
  if (supabase) await supabase.auth.signOut();
  guardarLocal(null);
}
