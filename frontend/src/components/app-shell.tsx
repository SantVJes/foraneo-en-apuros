"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenText, CalendarDots, IconContext, Jar, PaintBrush, ShoppingCartSimple, UserCircle } from "@phosphor-icons/react";

import { ElegirEstilo, ElegirLectura } from "@/components/elegir-lectura";
import { Marca } from "@/components/marca";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { alCambiarSesion, haySesion } from "@/lib/auth-store";
import { DatosProvider, useDatos } from "@/lib/datos";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/semana/", texto: "Semana", Icono: CalendarDots },
  { href: "/lista/", texto: "Lista", Icono: ShoppingCartSimple },
  { href: "/recetas/", texto: "Recetas", Icono: BookOpenText },
  { href: "/alacena/", texto: "Alacena", Icono: Jar },
  { href: "/yo/", texto: "Yo", Icono: UserCircle },
];
/** Pantallas que no tienen pestaña propia y viven dentro de otra. */
const DENTRO_DE: Record<string, string> = { "/meta": "/yo/" };

/** Marco de las pantallas con sesión: barra arriba (abajo en el celular) y revisa que hayas entrado. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [listo, setListo] = React.useState(false);

  React.useEffect(() => {
    const revisar = async () => {
      if (await haySesion()) setListo(true);
      else router.replace("/");
    };
    revisar();
    return alCambiarSesion(revisar);
  }, [router]);

  if (!listo) return <Arranque />;
  return (
    <DatosProvider>
      <IconContext.Provider value={{ weight: "bold" }}>
      <div className="fondo-degradado" aria-hidden />
      <Barra />
      <main id="contenido" className="contenido-plegable mx-auto w-full max-w-5xl px-[max(1rem,env(safe-area-inset-left))] pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 sm:pb-12">
        <ConDatos>{children}</ConDatos>
      </main>
      </IconContext.Provider>
    </DatosProvider>
  );
}

function ConDatos({ children }: { children: React.ReactNode }) {
  const { usuario, error, recargar } = useDatos();
  if (error)
    return (
      <div className="grid justify-items-center gap-3 rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
        <p>{error}</p>
        <Button onClick={recargar}>Intentar otra vez</Button>
      </div>
    );
  if (!usuario) return <Arranque />;
  return <>{children}</>;
}

function Barra() {
  const ruta = usePathname();
  const enBienvenida = ruta?.startsWith("/bienvenida");
  const base = Object.entries(DENTRO_DE).find(([r]) => ruta?.startsWith(r))?.[1] ?? ruta;
  const actual = TABS.findIndex(({ href }) => base?.startsWith(href.slice(0, -1)));
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/semana/" aria-label="Foráneo en apuros, inicio"><Marca /></Link>
          {!enBienvenida && (
            <nav aria-label="Secciones" className="hidden items-center gap-1 rounded-full border bg-card p-1 sm:flex">
              {TABS.map(({ href, texto, Icono }, i) => {
                const activo = i === actual;
                return (
                  <Link key={href} href={href} aria-current={activo ? "page" : undefined}
                    className={cn("flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-200",
                      activo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                    <Icono className="size-5" weight={activo ? "fill" : "regular"} aria-hidden />{texto}
                  </Link>
                );
              })}
            </nav>
          )}
          <Personalizar />
        </div>
      </header>

      {/* Celular: barra flotante tipo cápsula. Una píldora de color se desliza a la pestaña activa. */}
      {!enBienvenida && (
        <nav aria-label="Secciones"
          className="barra-abajo fixed inset-x-3 bottom-[calc(0.6rem+env(safe-area-inset-bottom))] z-40 rounded-[1.75rem] border bg-card/[0.97] p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,.45)] backdrop-blur-xl sm:hidden">
          <div className="relative grid grid-cols-5">
            {actual >= 0 && (
              <span aria-hidden className="absolute inset-y-0 left-0 w-1/5 p-0.5 transition-transform duration-500 ease-[cubic-bezier(.3,1.4,.5,1)]"
                style={{ transform: `translateX(${actual * 100}%)` }}>
                <span className="block h-full rounded-[1.4rem] bg-accent" />
              </span>
            )}
            {TABS.map(({ href, texto, Icono }, i) => {
              const activo = i === actual;
              return (
                <Link key={href} href={href} aria-current={activo ? "page" : undefined}
                  className="relative z-10 grid min-h-14 place-items-center content-center gap-0.5 rounded-[1.4rem] text-[0.7rem] font-semibold">
                  <Icono className={cn("size-[1.6rem] transition-all duration-300", activo ? "icono-rebote text-accent-texto" : "text-foreground/75")}
                    weight={activo ? "fill" : "regular"} aria-hidden />
                  <span className={cn("max-w-full truncate px-0.5 text-[min(0.7rem,11px)] transition-colors duration-300 [letter-spacing:0] [word-spacing:0]", activo ? "font-bold text-foreground" : "text-foreground/75")}>{texto}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

/** Pantalla mientras abre la app: el FA rebota y una olla echa vapor. */
export function Arranque() {
  return (
    <div className="grid min-h-[60dvh] place-items-center" role="status">
      <div className="grid justify-items-center gap-3 text-muted-foreground">
        <div className="relative">
          <span className="rebotar grid size-16 place-items-center rounded-full bg-mango font-display text-2xl font-extrabold text-mango-foreground shadow-[inset_0_0_0_2px_var(--foreground)]">FA</span>
          <span className="vapor absolute -right-4 -top-3 flex gap-1 text-primary" aria-hidden><i /><i /><i /></span>
        </div>
        <span className="font-semibold">Calentando la cocina…</span>
      </div>
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="grid place-items-center gap-3 py-20 text-muted-foreground" role="status">
      <span className="size-7 animate-spin rounded-full border-[3px] border-secondary border-t-primary motion-reduce:animate-none" />
      {texto}
    </div>
  );
}

export function Cabeza({ etiqueta, titulo, children }: { etiqueta?: string; titulo: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      {etiqueta && <span className="ceja text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{etiqueta}</span>}
      <h1 className="titulo-revela text-[clamp(1.9rem,6vw,2.8rem)] font-extrabold leading-[1.05]">{titulo}</h1>
      {children && <p className="max-w-[60ch] text-[1.05rem] text-muted-foreground">{children}</p>}
    </div>
  );
}

export function Etiqueta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)}>{children}</span>;
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="grid justify-items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center text-muted-foreground">{children}</div>;
}

/** Personalizar a la vista: botón arriba a la derecha con colores, modo claro/oscuro y letra.
    Tiene un puntito hasta que lo abres por primera vez, para que se note que existe. */
export const ESTILO_VISTO = "fa_estilo_visto";
function Personalizar() {
  const [abierto, setAbierto] = React.useState(false);
  const [nuevo, setNuevo] = React.useState(false);
  React.useEffect(() => { try { setNuevo(localStorage.getItem(ESTILO_VISTO) !== "1"); } catch { /* nada */ } }, []);
  const abrir = () => { setAbierto(true); setNuevo(false); try { localStorage.setItem(ESTILO_VISTO, "1"); } catch { /* nada */ } };
  return (
    <>
      <button type="button" onClick={abrir} aria-label="Personalizar colores y letra" title="Personalizar colores y letra"
        className="relative flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-semibold hover:border-primary">
        <PaintBrush className="size-5 shrink-0 text-primary" weight="duotone" aria-hidden /><span className="min-[420px]:hidden">Estilo</span><span className="hidden min-[420px]:inline sm:hidden xl:inline">Personalizar</span>
        {nuevo && <span aria-hidden className="absolute right-1 top-1 size-2.5 animate-pulse rounded-full bg-mango ring-2 ring-background" />}
      </button>
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent>
          <SheetTitle>Hazla a tu gusto</SheetTitle>
          <SheetDescription>Los cambios se ven al instante y se guardan en este dispositivo.</SheetDescription>
          <ElegirEstilo />
          <fieldset className="grid gap-2"><legend className="mb-2 font-semibold">Letra</legend><ElegirLectura /></fieldset>
          <Button size="lg" onClick={() => setAbierto(false)}>Listo</Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
