"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Img3D } from "@/components/img-3d";
import { Marca } from "@/components/marca";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { entrarConCorreo, entrarConGoogle, haySesion, usaSupabase } from "@/lib/auth-store";

export default function Entrar() {
  const router = useRouter();
  const [modo, setModo] = React.useState<"entrar" | "registro">("registro");
  const [enviando, setEnviando] = React.useState(false);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [telon, setTelon] = React.useState<{ x: string; y: string; nombre: string } | null>(null);
  const boton = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => { haySesion().then((s) => s && router.replace("/semana/")); }, [router]);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    try {
      const msg = await entrarConCorreo(modo, String(f.get("email")).trim(), String(f.get("password")), String(f.get("nombre") || "").trim());
      if (msg) setAviso(msg);
      else {
        const r = boton.current?.getBoundingClientRect();
        setTelon({ x: r ? `${r.left + r.width / 2}px` : "50%", y: r ? `${r.top + r.height / 2}px` : "50%", nombre: String(f.get("nombre") || "").trim() });
        const lento = !matchMedia("(prefers-reduced-motion: reduce)").matches;
        setTimeout(() => router.replace(modo === "registro" ? "/bienvenida/" : "/semana/"), lento ? 1150 : 0);
      }
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main id="contenido" className="pagina mx-auto grid min-h-dvh max-w-5xl content-center gap-6 px-4 py-8 md:grid-cols-[1.1fr_1fr] md:gap-x-12">
      <div className="fondo-degradado" aria-hidden />
      <div className="flotan" aria-hidden>
        <Img3D n="carrot" prioridad className="left-[4%] top-[10%] hidden size-16 md:block" />
        <Img3D n="egg" prioridad className="right-[6%] top-[6%] size-12" />
        <Img3D n="hot-pepper" prioridad className="left-[46%] top-[4%] hidden size-12 md:block" />
        <Img3D n="bread" prioridad className="bottom-[5%] left-[38%] hidden size-16 md:block" />
        <Img3D n="cheese-wedge" prioridad className="bottom-[10%] right-[6%] hidden size-14 md:block" />
      </div>
      {telon && (
        <div className="telon" style={{ "--x": telon.x, "--y": telon.y } as React.CSSProperties} role="status">
          <div className="grid justify-items-center gap-4 text-center">
            <span className="sello-fa sello-3d grid size-24 place-items-center rounded-[1.8rem] font-display text-4xl font-extrabold text-mango-foreground">FA</span>
            <p className="text-2xl font-extrabold">{modo === "registro" ? `¡Bienvenido${telon.nombre ? ", " + telon.nombre : ""}!` : "¡Qué gusto verte!"}</p>
          </div>
        </div>
      )}
      <section className="grid gap-4 md:row-span-2 md:self-center">
        <Marca className="intro-logo" />
        <div aria-hidden className="escena-entrada aparecer md:order-last md:mt-4" style={{ "--d": "0.4s" } as React.CSSProperties}>
          <div className="panel" />
          <Img3D n="shopping-cart" prioridad className="flotar-suave left-1/2 top-0 w-40 -translate-x-1/2" />
          <Img3D n="avocado" prioridad className="bottom-6 left-[6%] w-20 -rotate-12" />
          <Img3D n="taco" prioridad className="bottom-8 right-[6%] w-22 rotate-12" />
          <Img3D n="tomato" prioridad className="bottom-1 left-[30%] w-13" />
          <Img3D n="sparkles" prioridad className="right-[24%] top-4 w-10" />
        </div>
        <h1 className="palabras text-[clamp(2.2rem,7vw,3.6rem)] font-extrabold leading-[1.02]" aria-label="Come rico toda la semana sin quebrarte">
          {["Come", "rico", "toda", "la", "semana"].map((w, i) => <React.Fragment key={w}><span aria-hidden><span style={{ "--i": i } as React.CSSProperties}>{w}</span></span>{" "}</React.Fragment>)}
          <span aria-hidden><span style={{ "--i": 5 } as React.CSSProperties}><span className="subrayar px-1">sin quebrarte</span></span></span>
        </h1>
        <p className="aparecer max-w-[46ch] text-lg text-muted-foreground" style={{ "--d": "0.9s" } as React.CSSProperties}>Para el que vive lejos de casa. Te decimos qué cocinar, qué comprar y en qué súper cerca de ti sale más barato.</p>
        <ol className="hidden gap-3 md:grid">
          {PASOS.map(([n, t, d]) => (
            <li key={n} className="aparecer flex gap-3" style={{ "--d": `${1 + Number(n) * 0.12}s` } as React.CSSProperties}><span aria-hidden className="sello-3d grid size-8 shrink-0 place-items-center rounded-[0.7rem] text-sm font-extrabold text-mango-foreground">{n}</span>
              <span><b className="font-semibold">{t}</b><span className="block text-muted-foreground">{d}</span></span></li>
          ))}
        </ol>
      </section>

      <Card className="aparecer gap-4 md:p-6" style={{ "--d": "0.65s" } as React.CSSProperties}>
        <ToggleGroup type="single" value={modo} onValueChange={(v) => v && setModo(v as typeof modo)} aria-label="Elige">
          <ToggleGroupItem value="registro">Crear cuenta</ToggleGroupItem>
          <ToggleGroupItem value="entrar">Ya tengo cuenta</ToggleGroupItem>
        </ToggleGroup>

        {aviso ? (
          <p className="rounded-xl bg-accent p-4">{aviso}</p>
        ) : (
          <form onSubmit={enviar} className="grid gap-3">
            {modo === "registro" && (
              <div className="grid gap-1.5"><Label htmlFor="nombre">Tu nombre</Label><Input id="nombre" name="nombre" autoComplete="given-name" /></div>
            )}
            <div className="grid gap-1.5"><Label htmlFor="email">Correo</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete={modo === "registro" ? "new-password" : "current-password"} />
            </div>
            <Button ref={boton} size="lg" type="submit" disabled={enviando || !!telon}>{enviando ? "Un momento…" : modo === "registro" ? "Crear mi cuenta" : "Entrar"}</Button>
          </form>
        )}

        {usaSupabase && (
          <>
            <div className="flex items-center gap-3 text-sm text-muted-foreground"><hr className="flex-1" />o<hr className="flex-1" /></div>
            <Button variant="outline" size="lg" onClick={() => entrarConGoogle().catch((e) => toast(e.message))}>
              <svg viewBox="0 0 24 24" aria-hidden className="size-5"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>
              Seguir con Google
            </Button>
          </>
        )}
        <p className="text-sm text-muted-foreground">Al entrar aceptas el aviso de privacidad. No compramos nada por ti: solo te decimos qué comprar y dónde.</p>
      </Card>

      <ol className="grid gap-3 md:hidden">
        {PASOS.map(([n, t, d]) => (
          <li key={n} className="aparecer flex gap-3" style={{ "--d": `${1 + Number(n) * 0.12}s` } as React.CSSProperties}><span aria-hidden className="sello-3d grid size-8 shrink-0 place-items-center rounded-[0.7rem] text-sm font-extrabold text-mango-foreground">{n}</span>
            <span><b className="font-semibold">{t}</b><span className="block text-muted-foreground">{d}</span></span></li>
        ))}
      </ol>
    </main>
  );
}

const PASOS = [
  ["1", "Arma tu semana", "Desayuno, comida y cena según tu tiempo y tu dieta."],
  ["2", "Anota lo que ya tienes", "Lo que hay en tu alacena no sale en la lista."],
  ["3", "Compra donde sale más barato", "Comparamos los súper que te quedan cerca."],
];
