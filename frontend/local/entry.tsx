import * as React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import Semana from "@/app/(app)/semana/page";
import Lista from "@/app/(app)/lista/page";
import Recetas from "@/app/(app)/recetas/page";
import Alacena from "@/app/(app)/alacena/page";
import Yo from "@/app/(app)/yo/page";
import Meta from "@/app/(app)/meta/page";
import Bienvenida from "@/app/(app)/bienvenida/page";
import { ir, useRuta } from "./shims/router";
import { yaEmpezo } from "./api-local";

const PANTALLAS: Record<string, React.ComponentType> = {
  "/semana/": Semana, "/lista/": Lista, "/recetas/": Recetas, "/alacena/": Alacena, "/yo/": Yo, "/meta/": Meta, "/bienvenida/": Bienvenida,
};

function App() {
  const ruta = useRuta();
  const Pantalla = PANTALLAS[ruta];
  React.useEffect(() => { if (!Pantalla) ir(yaEmpezo() ? "/semana/" : "/bienvenida/", true); }, [Pantalla]);
  return (
    <>
      <a href="#contenido" onClick={(e) => { e.preventDefault(); document.getElementById("contenido")?.focus(); }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">
        Saltar al contenido
      </a>
      {Pantalla && <AppShell><div key={ruta} className="entrar-pantalla"><Pantalla /></div></AppShell>}
      <Toaster />
    </>
  );
}
createRoot(document.getElementById("app")!).render(<App />);
