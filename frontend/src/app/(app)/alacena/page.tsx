"use client";

import * as React from "react";
import { Bread, Carrot, Drop, Egg, Fish, ForkKnife, Grains, Jar, MagnifyingGlass, Package, Plus, Warning, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Cabeza, Cargando, Etiqueta, Vacio } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { useDatos } from "@/lib/datos";
import type { ArticuloAlacena, Ingrediente } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const ICONO_CAT: Record<string, typeof Package> = {
  "Abarrotes": Package, "Básicos": Drop, "Carnes": ForkKnife, "Frutas y verduras": Carrot, "Lácteos y huevo": Egg,
  "Panadería": Bread, "Pescados y mariscos": Fish, "Salchichonería": ForkKnife, "Tortillería": Grains,
};

const NIVEL: Record<string, number> = { lleno: 1, tres_cuartos: 0.75, mitad: 0.5, un_tercio: 0.33, un_cuarto: 0.25, casi_nada: 0.1 };

function Frasco({ nivel, className }: { nivel: number; className?: string }) {
  return (
    <span aria-hidden className={cn("relative block h-11 w-8 overflow-hidden rounded-b-lg rounded-t-md border-2 border-foreground bg-card", className)}>
      <i className="llenar liquido absolute inset-x-0 bottom-0 bg-mango transition-[height] duration-700 ease-out" style={{ height: `${Math.round(nivel * 100)}%` }} />
    </span>
  );
}

export default function Alacena() {
  const { opciones, ingredientes: cargarIng } = useDatos();
  const [items, setItems] = React.useState<ArticuloAlacena[] | null>(null);
  const [ingredientes, setIngredientes] = React.useState<Ingrediente[]>([]);
  const [medida, setMedida] = React.useState("aprox");
  const [nombre, setNombre] = React.useState("");
  const [fraccion, setFraccion] = React.useState("mitad");
  const [ultimo, setUltimo] = React.useState<number | null>(null);
  const [saliendo, setSaliendo] = React.useState<number | null>(null);
  const [volando, setVolando] = React.useState<number[]>([]);
  const [agregando, setAgregando] = React.useState(false);
  const [filtro, setFiltro] = React.useState("");

  const recargar = React.useCallback(async () => setItems(await api<ArticuloAlacena[]>("/alacena/")), []);
  React.useEffect(() => { recargar().catch((e) => toast(e.message)); cargarIng().then(setIngredientes); }, [recargar, cargarIng]);

  const ing = ingredientes.find((i) => i.nombre.toLowerCase() === nombre.trim().toLowerCase());
  const porId = Object.fromEntries(ingredientes.map((i) => [i.id, i]));

  async function guardarItem(ingId: number, cuerpo: Record<string, string>) {
    const existente = items?.find((i) => i.ingrediente_id === ingId);
    if (existente) await api(`/alacena/${existente.id}/`, { method: "PATCH", body: cuerpo });
    else await api("/alacena/", { method: "POST", body: { ingrediente_id: ingId, ...cuerpo } });
    await recargar();
    setUltimo(ingId);
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ing) return toast("Elige un ingrediente de la lista.");
    const f = new FormData(e.currentTarget);
    const cuerpo = medida === "aprox"
      ? { fraccion, unidad: "paquete", cantidad: String(f.get("paquetes") || "1") }
      : { fraccion: "", cantidad: String(f.get("cantidad") || ""), unidad: String(f.get("unidad")) };
    if (!cuerpo.cantidad) return toast("Escribe la cantidad.");
    try { await guardarItem(ing.id, cuerpo); toast(`${ing.nombre} guardado.`); setNombre(""); setAgregando(false); }
    catch (err) { toast((err as Error).message); }
  }

  async function quitar(id: number) {
    setSaliendo(id);
    try {
      await Promise.all([api(`/alacena/${id}/`, { method: "DELETE" }), new Promise((r) => setTimeout(r, 360))]);
      toast("Quitado de la alacena."); await recargar();
    }
    catch (err) { toast((err as Error).message); }
    finally { setSaliendo(null); }
  }

  if (!items) return <Cargando texto="Abriendo la alacena…" />;
  const tengo = new Set(items.map((i) => i.ingrediente_id));
  const basicosFaltan = ingredientes.filter((i) => i.es_basico && !tengo.has(i.id));
  const nombresUnidad = Object.fromEntries((opciones?.unidades || []).map((u) => [u.valor, u.nombre]));
  const nivelDe = (it: ArticuloAlacena) => {
    const base = porId[it.ingrediente_id];
    return it.fraccion ? NIVEL[it.fraccion] ?? 0 : base ? Math.min(1, Number(it.cantidad_base) / Number(base.tamano_paquete)) : 1;
  };
  const pocos = items.filter((it) => nivelDe(it) <= 0.25);
  const visibles = items.filter((it) => it.ingrediente.toLowerCase().includes(filtro.trim().toLowerCase()));
  const grupos: Record<string, ArticuloAlacena[]> = {};
  visibles.forEach((it) => { (grupos[porId[it.ingrediente_id]?.categoria || "Otros"] ||= []).push(it); });
  const repisas = Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0], "es"));
  const unidades = [...({ g: ["g", "kg"], ml: ["ml", "l"], pieza: ["pieza"] }[ing?.unidad_base || "g"]), "paquete"];

  return (
    <div className="pagina grid grid-cols-1 gap-6">
      <Cabeza etiqueta={`${items.length} ${items.length === 1 ? "cosa" : "cosas"} en casa`} titulo="Tu alacena">Lo que ya tienes. Así no lo compras dos veces.</Cabeza>

      <div className="grid gap-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar en tu alacena" aria-label="Buscar en tu alacena" className="pl-10" />
          </div>
          <Button size="lg" onClick={() => setAgregando(true)} className="shrink-0 px-5"><Plus />Agregar</Button>
        </div>
        {pocos.length > 0 && (
          <p className="flex items-center gap-2 rounded-2xl bg-destructive-soft px-4 py-2.5 text-sm font-semibold text-[#9c1747] dark:text-destructive">
            <Warning className="size-5 shrink-0" weight="duotone" aria-hidden />
            Se te acaba{pocos.length > 1 ? "n" : ""}: {pocos.map((p) => p.ingrediente).join(", ")}
          </p>
        )}
      </div>

      {basicosFaltan.length > 0 && (
        <Card className="gap-3">
          <h2 className="font-bold">¿Tienes estos básicos?</h2>
          <p className="text-sm text-muted-foreground">Toca los que ya tengas y no saldrán en tu lista.</p>
          <div className="flex flex-wrap gap-2">
            {basicosFaltan.map((i) => (
              <Button key={i.id} size="sm" variant="secondary" className={volando.includes(i.id) ? "volar" : ""} onClick={async () => {
                setVolando((v) => [...v, i.id]);
                await new Promise((r) => setTimeout(r, 420));
                await guardarItem(i.id, { fraccion: "lleno", unidad: "paquete", cantidad: "1" }).catch((e) => toast(e.message));
                setVolando((v) => v.filter((x) => x !== i.id));
              }}>
                <Plus />{i.nombre}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {items.length ? (
        <div className="grid gap-6">
          {repisas.length === 0 && <p className="text-center text-muted-foreground">No hay nada con “{filtro}”.</p>}
          {repisas.map(([cat, cosas], r) => {
            const Icono = ICONO_CAT[cat] || Package;
            return (
              <section key={cat} aria-label={cat} className="entrar-pantalla grid gap-2" style={{ animationDelay: `${r * 60}ms` }}>
                <h2 className="flex items-center gap-2 text-lg font-extrabold">
                  <Icono className="size-6 text-primary" weight="duotone" aria-hidden />{cat}
                  <span className="font-mono text-xs font-semibold text-muted-foreground">{cosas.length}</span>
                </h2>
                <div className="relative">
                  <div className="entrar-lista grid grid-cols-3 gap-2 px-1 pb-1 sm:grid-cols-4 lg:grid-cols-6">
                    {cosas.map((it) => {
                      const base = porId[it.ingrediente_id];
                      const nivel = it.fraccion ? NIVEL[it.fraccion] ?? 0 : base ? Math.min(1, Number(it.cantidad_base) / Number(base.tamano_paquete)) : 1;
                      return (
                        <article key={it.id + (ultimo === it.ingrediente_id ? "-n" : "")}
                          className={cn("group relative grid justify-items-center gap-1.5 rounded-2xl border bg-card px-1.5 pb-2.5 pt-3 text-center transition-all duration-200 hover:-translate-y-0.5",
                            ultimo === it.ingrediente_id && "recien border-mango", saliendo === it.id && "salir")}>
                          <Frasco nivel={nivel} className="h-14 w-10" />
                          <span className="line-clamp-2 text-sm font-semibold leading-tight">{it.ingrediente}</span>
                          <span className="line-clamp-2 text-xs leading-tight text-muted-foreground">{it.descripcion}</span>
                          {nivel <= 0.25 && <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[#9c1747] dark:text-destructive">Se acaba</span>}
                          <button type="button" onClick={() => quitar(it.id)} aria-label={`Quitar ${it.ingrediente}`}
                            className="absolute right-1 top-1 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive">
                            <X className="size-4" />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  <div aria-hidden className="mx-0 h-2.5 rounded-b-lg rounded-t-sm bg-[var(--madera)] shadow-[0_6px_10px_-6px_rgba(0,0,0,.45)]" />
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Vacio>
          <Jar className="size-14 text-primary" weight="duotone" aria-hidden />
          <p>Tu alacena está vacía. Agrega lo que tengas y te lo descontamos de la lista.</p>
          <Button onClick={() => setAgregando(true)}><Plus />Agregar algo</Button>
        </Vacio>
      )}

      <Sheet open={agregando} onOpenChange={setAgregando}>
        <SheetContent>
          <SheetTitle>Agregar a la alacena</SheetTitle>
          <SheetDescription>Escribe qué tienes y cuánto le queda, más o menos.</SheetDescription>
        <form onSubmit={enviar} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ing">¿Qué tienes?</Label>
            <Input id="ing" list="lista-ing" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Arroz, aceite, huevo…" autoComplete="off" />
            <datalist id="lista-ing">{ingredientes.map((i) => <option key={i.id} value={i.nombre} />)}</datalist>
          </div>
          <ToggleGroup type="single" value={medida} onValueChange={(v) => v && setMedida(v)} aria-label="Cómo medir">
            <ToggleGroupItem value="aprox">Más o menos</ToggleGroupItem>
            <ToggleGroupItem value="exacta">Cantidad exacta</ToggleGroupItem>
          </ToggleGroup>
          {medida === "aprox" ? (
            <div key="aprox" className="entrar-pantalla grid gap-3">
              <Etiqueta>¿Cuánto le queda al paquete?</Etiqueta>
              <div role="radiogroup" aria-label="Cuánto le queda" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {(opciones?.fracciones || []).map((f) => (
                  <button key={f.valor} type="button" role="radio" aria-checked={fraccion === f.valor} onClick={() => setFraccion(f.valor)}
                    className={cn("grid justify-items-center gap-1.5 rounded-xl border-2 p-2.5 text-xs font-semibold transition-all duration-200 active:scale-95", fraccion === f.valor ? "border-primary bg-accent shadow-sm" : "bg-background hover:border-foreground/30")}>
                    <Frasco key={fraccion === f.valor ? "si" : "no"} nivel={NIVEL[f.valor] ?? 0} className={fraccion === f.valor ? "menear" : ""} />{f.nombre}
                  </button>
                ))}
              </div>
              <div className="grid max-w-56 gap-1.5"><Label htmlFor="paquetes">¿De cuántos paquetes?</Label>
                <Input id="paquetes" name="paquetes" type="number" min={1} step={1} defaultValue={1} inputMode="numeric" /></div>
            </div>
          ) : (
            <div key="exacta" className="entrar-pantalla grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label htmlFor="cantidad">Cantidad</Label><Input id="cantidad" name="cantidad" type="number" min={0} step="any" inputMode="decimal" placeholder="1" /></div>
              <div className="grid gap-1.5"><Label htmlFor="unidad">Unidad</Label>
                <NativeSelect id="unidad" name="unidad">
                  {unidades.map((u) => <option key={u} value={u}>{u === "paquete" && ing ? ing.nombre_paquete + "s" : nombresUnidad[u] || u}</option>)}
                </NativeSelect></div>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full sm:w-fit">Guardar en la alacena</Button>
        </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
