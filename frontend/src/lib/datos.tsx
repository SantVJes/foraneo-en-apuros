"use client";

import * as React from "react";

import { api, todos } from "./api";
import type { Ingrediente, Opciones, Supermercado, Usuario } from "./tipos";

type Datos = {
  usuario: Usuario | null;
  opciones: Opciones | null;
  supers: Supermercado[];
  setUsuario: (u: Usuario) => void;
  ingredientes: () => Promise<Ingrediente[]>;
  recargar: () => Promise<void>;
  error: string | null;
};

const Ctx = React.createContext<Datos | null>(null);

/** Lo que casi todas las pantallas necesitan: tu perfil, las opciones de los formularios y los súper. */
export function DatosProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = React.useState<Usuario | null>(null);
  const [opciones, setOpciones] = React.useState<Opciones | null>(null);
  const [supers, setSupers] = React.useState<Supermercado[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const cacheIng = React.useRef<Promise<Ingrediente[]> | null>(null);

  const recargar = React.useCallback(async () => {
    try {
      const [u, o, s] = await Promise.all([
        api<Usuario>("/auth/yo/"), api<Opciones>("/opciones/"), api<Supermercado[] | { results: Supermercado[] }>("/supermercados/"),
      ]);
      setUsuario(u); setOpciones(o); setSupers(Array.isArray(s) ? s : s.results);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);

  React.useEffect(() => { recargar(); }, [recargar]);

  const ingredientes = React.useCallback(() => (cacheIng.current ??= todos<Ingrediente>("/ingredientes/")), []);

  return (
    <Ctx.Provider value={{ usuario, opciones, supers, setUsuario, ingredientes, recargar, error }}>{children}</Ctx.Provider>
  );
}

export function useDatos() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useDatos va dentro de DatosProvider");
  return v;
}
