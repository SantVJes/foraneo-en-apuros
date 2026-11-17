"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowSquareOut as ExternalLink, Info, MapPin, ShareNetwork, Storefront, Jar, UsersThree } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Cabeza, Cargando, Etiqueta, Vacio } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { NumeroAnimado } from "@/components/numero-animado";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, API_URL } from "@/lib/api";
import { useDatos } from "@/lib/datos";
import { cantidad, dinero, fechaLarga } from "@/lib/formato";
import { anotarCompra } from "@/lib/gastos";
import { usePlanes } from "@/lib/planes";
import type { ItemLista, ListaCompras } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const linkAfiliado = (ruta: string) => (ruta.startsWith("/") ? API_URL + ruta : ruta);

export default function Lista() {
  const { usuario } = useDatos();
  const { plan, cargando } = usePlanes();
  const [modo, setModo] = React.useState(usuario!.modo_compra || "varios");
  const [superId, setSuperId] = React.useState<string>("");
  const [l, setL] = React.useState<ListaCompras | null>(null);
  const [marcados, setMarcados] = React.useState<Set<number>>(new Set());
  const [pasando, setPasando] = React.useState(false);
  const [entre, setEntre] = React.useState(0);
  const [ahora, setAhora] = React.useState(0);
  React.useEffect(() => setAhora(Date.now()), []);
  React.useEffect(() => { if (plan) setEntre(plan.personas || 1); }, [plan]);
  // Lo que ya echaste al carrito se queda marcado aunque cambies de pantalla.
  const claveMarcados = plan ? `fa_marcados_${plan.id}` : null;
  React.useEffect(() => {
    if (!claveMarcados) return;
    try { setMarcados(new Set(JSON.parse(localStorage.getItem(claveMarcados) || "[]"))); } catch { /* sin almacenamiento */ }
  }, [claveMarcados]);
  const marcar = (id: number) => setMarcados((m) => {
    const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id);
    try { if (claveMarcados) localStorage.setItem(claveMarcados, JSON.stringify([...n])); } catch { /* sin almacenamiento */ }
    return n;
  });

  /** Lo que ya compraste pasa a tu alacena, y sale de la lista. */
  async function pasarAlacena() {
    setPasando(true);
    const ids = [...marcados];
    try {
      await Promise.all(ids.map((id) => api("/alacena/", { method: "POST", body: { ingrediente_id: id, fraccion: "lleno", unidad: "paquete", cantidad: "1" } })));
      // Para "Este mes llevas $X": lo que costó lo que acabas de comprar.
      const monto = (l?.comprar || []).filter((i) => marcados.has(i.ingrediente_id)).reduce((s, i) => s + Number(i.comprar_en.costo), 0);
      if (plan) anotarCompra(plan.id, monto, plan.menu.filter((c) => c.platillo).length * (plan.personas || 1), Number(l?.total || 0));
      setMarcados(new Set());
      try { if (claveMarcados) localStorage.removeItem(claveMarcados); } catch { /* sin almacenamiento */ }
      toast(`${ids.length === 1 ? "Pasó 1 cosa" : `Pasaron ${ids.length} cosas`} a tu alacena.`);
      await cargar();
    } catch (e) { toast((e as Error).message); } finally { setPasando(false); }
  }

  const cargar = React.useCallback(async () => {
    if (!plan) return;
    setL(null);
    const q = `?modo=${modo}${modo === "un_super" && superId ? "&supermercado=" + superId : ""}`;
    try { setL(await api<ListaCompras>(`/planes/${plan.id}/lista-compras/${q}`)); } catch (e) { toast((e as Error).message); }
  }, [plan, modo, superId]);
  React.useEffect(() => { cargar(); }, [cargar]);

  async function yaTengo(ingId: number) {
    try { await api("/alacena/", { method: "POST", body: { ingrediente_id: ingId, fraccion: "lleno", unidad: "paquete", cantidad: "1" } }); toast("Anotado en tu alacena."); cargar(); }
    catch (e) { toast((e as Error).message); }
  }

  if (cargando) return <Cargando texto="Comparando precios…" />;
  if (!plan)
    return (
      <div className="pagina grid grid-cols-1 gap-6"><Cabeza titulo="Tu lista de compras" />
        <Vacio><p>Primero arma tu semana y aquí te decimos qué comprar y dónde.</p><Button asChild><Link href="/semana/">Armar mi semana</Link></Button></Vacio></div>
    );
  if (!l) return <Cargando texto="Comparando precios…" />;

  const pres = Number(l.presupuesto), total = Number(l.total), restante = Number(l.restante);
  const pasado = !l.dentro_del_presupuesto && pres > 0;
  const grupos: Record<string, ItemLista[]> = {};
  l.comprar.forEach((i) => { (grupos[i.comprar_en.supermercado] ||= []).push(i); });
  const info = Object.fromEntries(l.por_supermercado.map((t) => [t.supermercado, t]));
  const fechas = l.comprar.map((i) => i.comprar_en.actualizado).filter(Boolean).sort() as string[];
  const dias = (f: string) => Math.max(0, Math.round((ahora - new Date(f + "T12:00").getTime()) / 86400000));
  const [viejo, nuevo] = fechas.length ? [dias(fechas[0]), dias(fechas[fechas.length - 1])] : [0, 0];
  const hace = (d: number) => (d === 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`);
  const revisado = fechas.length && ahora ? (viejo === nuevo ? `Precios revisados ${hace(viejo)}` : nuevo === 0 ? `Precios revisados de hoy a hace ${viejo} días` : `Precios revisados hace ${nuevo} a ${viejo} días`) : "";

  /** Manda la lista por WhatsApp (o lo que tengas) a tus roomies, con cuánto le toca a cada quien. */
  async function compartirLista() {
    const lineas = Object.entries(grupos).map(([tienda, xs]) => `*${tienda}*\n` + xs.map((i) => `• ${i.comprar_en.producto}${i.comprar_en.paquetes > 1 ? ` ×${i.comprar_en.paquetes}` : ""} — ${dinero(i.comprar_en.costo)}`).join("\n"));
    const texto = `Lista del súper de la semana 🛒\n\n${lineas.join("\n\n")}\n\nTotal: ${dinero(total)}${entre > 1 ? `\nEntre ${entre}: ${dinero(total / entre)} cada quien` : ""}`;
    try { if (navigator.share) { await navigator.share({ title: "Lista del súper", text: texto }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(texto); toast("Lista copiada. Pégala en el chat con tus roomies."); } catch { toast("No pudimos copiar la lista."); }
  }

  return (
    <div className={cn("grid grid-cols-1 gap-5", marcados.size > 0 && "pb-20")}>
      <Cabeza etiqueta={`Para tu semana · ${l.comprar.length} productos`} titulo="Tu lista del súper">Tacha lo que vas echando al carrito.</Cabeza>

      <Card className="gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-muted-foreground">Total <b className="font-mono text-2xl font-bold text-foreground"><NumeroAnimado valor={total} formato={dinero} /></b></span>
          {pres > 0 && (
            <span className={cn("font-semibold", restante >= 0 ? "text-primary" : "text-destructive")}>
              {restante >= 0 ? "Te sobran " : "Te pasas por "}<NumeroAnimado valor={Math.abs(restante)} formato={dinero} />
            </span>
          )}
        </div>
        {pres > 0 && <><Progress value={(total / pres) * 100} tono={pasado ? "mal" : "ok"} /><p className="text-sm text-muted-foreground">Tu presupuesto es de {dinero(pres)}.</p></>}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm font-semibold" role="group" aria-label="Dividir el total">
            <UsersThree className="size-5" weight="duotone" aria-hidden />Entre
            <button type="button" aria-label="Menos personas" className="grid size-8 place-items-center rounded-full bg-card" onClick={() => setEntre((n) => Math.max(1, n - 1))}>−</button>
            <output className="w-4 text-center font-mono" aria-live="polite">{entre}</output>
            <button type="button" aria-label="Más personas" className="grid size-8 place-items-center rounded-full bg-card" onClick={() => setEntre((n) => Math.min(12, n + 1))}>+</button>
          </span>
          {entre > 1 && <span className="text-sm font-semibold">{dinero(total / entre)} cada quien</span>}
          <Button variant="outline" size="sm" className="ml-auto" onClick={compartirLista}><ShareNetwork />Compartir lista</Button>
        </div>
        {pasado && <p className="rounded-lg bg-destructive-soft p-3 text-sm">Te pasas del presupuesto. Prueba una semana con platillos fáciles o anota en tu alacena lo que ya tengas.</p>}
        {l.ubicacion.aviso && <p className="rounded-lg bg-destructive-soft p-3 text-sm">{l.ubicacion.aviso}</p>}
        <ToggleGroup type="single" value={modo} onValueChange={(v) => { if (v) { setModo(v as typeof modo); setSuperId(""); } }} aria-label="Cómo quieres comprar">
          <ToggleGroupItem value="varios">Lo más barato</ToggleGroupItem>
          <ToggleGroupItem value="un_super">Un solo súper</ToggleGroupItem>
        </ToggleGroup>
        {modo === "un_super" && l.todo_en_un_solo_supermercado.length > 0 && (
          <div className="grid gap-1.5"><Etiqueta>¿En cuál?</Etiqueta>
            <NativeSelect aria-label="Súper" value={superId || String(l.todo_en_un_solo_supermercado.find((t) => t.supermercado === l.supermercado_elegido)?.supermercado_id ?? "")} onChange={(e) => setSuperId(e.target.value)}>
              {l.todo_en_un_solo_supermercado.map((t) => <option key={t.supermercado_id} value={t.supermercado_id}>{t.supermercado} · {dinero(t.total)}{t.distancia_km != null ? ` · ${t.distancia_km} km` : ""}</option>)}
            </NativeSelect></div>
        )}
        <details className="group rounded-lg bg-secondary/60 px-3 py-2 text-sm">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 font-semibold"><Info className="size-5 shrink-0 text-primary" weight="duotone" aria-hidden />
            {revisado || "¿De dónde salen los precios?"}</summary>
          <p className="pb-1 pt-1 text-muted-foreground">Los tomamos de la página de cada súper y anotamos el día que los revisamos. En la tienda pueden variar un poco, sobre todo frutas, verduras y ofertas. Nunca compramos nada por ti.</p>
        </details>
        {!l.ubicacion.usa_ubicacion
          ? <p className="text-sm text-muted-foreground">Comparamos todas las cadenas. <Link className="font-semibold text-primary underline underline-offset-2" href="/yo/">Agrega tu ubicación</Link> para ver solo las que te quedan cerca.</p>
          : <p className="text-sm text-muted-foreground">Súper a menos de {l.ubicacion.radio_km} km de ti.</p>}
      </Card>

      <div className="entrar-lista grid items-start gap-6 md:grid-cols-2">
        {Object.entries(grupos).map(([tienda, lineas]) => {
          const t = info[tienda];
          const subtotal = lineas.reduce((s, i) => s + Number(i.comprar_en.costo), 0);
          return (
            <section key={tienda} aria-label={tienda} className="papel relative text-sm">
              <div className="ticket-borde rotate-180" aria-hidden />
              <div className="bg-ticket px-4 pb-4 pt-3 shadow-[0_10px_24px_-14px_rgba(0,0,0,.35)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-0.5">
                    <h2 className="flex items-center gap-2 text-[1.3rem] font-extrabold"><Storefront weight="duotone" className="size-6" style={{ color: t?.color || "#888" }} aria-hidden />{tienda}</h2>
                    {t?.distancia_km != null && t.sucursal
                      ? <span className="font-mono text-xs text-muted-foreground">{t.distancia_km} km · <a className="inline-flex items-center gap-0.5 font-sans font-semibold text-primary underline underline-offset-2" target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${t.sucursal.lat},${t.sucursal.lng}`}><MapPin className="size-3.5" aria-hidden />Cómo llegar</a></span>
                      : <span className="font-mono text-xs text-muted-foreground">{lineas.length} productos</span>}
                    {lineas[0]?.comprar_en.actualizado && <span className="text-xs text-muted-foreground">Precio del {fechaLarga([...lineas].map((i) => i.comprar_en.actualizado || "").sort()[0])}</span>}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground" aria-live="polite">{lineas.filter((i) => marcados.has(i.ingrediente_id)).length}/{lineas.length} ✓</span>
                </div>
                <hr className="my-3 border-dashed border-border" />
                <ul className="grid">
                  {lineas.map((i) => {
                    const hecho = marcados.has(i.ingrediente_id);
                    return (
                      <li key={i.ingrediente_id} className="flex gap-3 py-2">
                        <input type="checkbox" id={`c${i.ingrediente_id}`} checked={hecho} onChange={() => marcar(i.ingrediente_id)}
                          className="palomita mt-0.5 shrink-0" aria-label={`Ya lo eché al carrito: ${i.comprar_en.producto}`} />
                        <div className="grid min-w-0 flex-1 gap-0.5">
                          <label htmlFor={`c${i.ingrediente_id}`} className={cn("flex cursor-pointer justify-between gap-3 font-mono", hecho && "text-muted-foreground")}>
                            <span className={cn("tachable", hecho && "tachado")}>{i.comprar_en.producto}</span><span className={cn("tachable", hecho && "tachado")}>{dinero(i.comprar_en.costo)}</span>
                          </label>
                          <span className="text-xs text-muted-foreground">
                            {i.comprar_en.paquetes > 1 ? `${i.comprar_en.paquetes} × ${dinero(i.comprar_en.precio_unitario)} · ` : ""}necesitas {cantidad(i.falta, i.unidad)}
                            {i.en_otro_super && ` · no hay en ${l.supermercado_elegido}`}
                          </span>
                          {(i.es_basico || i.comprar_en.url_compra || i.url_amazon) && !hecho && (
                            <span className="flex flex-wrap gap-x-4 text-xs font-semibold">
                              {i.es_basico && <button type="button" className="text-primary underline underline-offset-2" onClick={() => yaTengo(i.ingrediente_id)}>Ya lo tengo</button>}
                              {i.comprar_en.url_compra && <a className="inline-flex items-center gap-1 text-primary underline underline-offset-2" href={linkAfiliado(i.comprar_en.url_compra)} target="_blank" rel="noopener sponsored">Pedir en línea<ExternalLink className="size-3" aria-hidden /></a>}
                              {i.url_amazon && <a className="inline-flex items-center gap-1 text-primary underline underline-offset-2" href={linkAfiliado(i.url_amazon)} target="_blank" rel="noopener sponsored">Amazon<ExternalLink className="size-3" aria-hidden /></a>}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <hr className="my-3 border-dashed border-border" />
                <div className="flex justify-between font-mono text-base font-semibold"><span>TOTAL</span><span>{dinero(subtotal)}</span></div>
                {lineas.every((i) => marcados.has(i.ingrediente_id)) && (
                  <span className="sello pointer-events-none absolute right-5 top-14 rounded-lg border-[3px] border-primary px-3 py-1 font-display text-xl font-extrabold uppercase tracking-wider text-primary opacity-90" role="status">
                    ¡Ya quedó!
                  </span>
                )}
              </div>
              <div className="ticket-borde" aria-hidden />
            </section>
          );
        })}
      </div>

      {l.todo_en_un_solo_supermercado.length > 1 && (
        <Card className="gap-3">
          <h2 className="text-lg font-bold">¿Y si compras todo en un solo lugar?</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr className="text-left text-sm text-muted-foreground"><th className="py-2">Súper</th><th className="text-right">Distancia</th><th className="text-right">Productos</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {l.todo_en_un_solo_supermercado.map((t, n) => (
                  <tr key={t.supermercado_id} className={cn("border-t", n === 0 && t.tiene_todo && "bg-accent font-semibold")}>
                    <td className="py-2.5 pl-1"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: t.color }} />{t.supermercado}{t.requiere_membresia && <Badge variant="neutro">membresía</Badge>}</span></td>
                    <td className="text-right font-mono">{t.distancia_km != null ? `${t.distancia_km} km` : "—"}</td>
                    <td className="text-right font-mono">{t.productos_disponibles}/{l.comprar.length}</td>
                    <td className="pr-1 text-right font-mono">{dinero(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {l.ya_tienes_en_alacena.length > 0 && (
        <section className="grid gap-2"><h2 className="font-bold">Ya lo tienes en casa</h2>
          <div className="flex flex-wrap gap-2">{l.ya_tienes_en_alacena.map((i) => <Badge key={i.ingrediente} variant="facil">{i.ingrediente}</Badge>)}</div></section>
      )}
      {l.sin_precio.length > 0 && (
        <section className="grid gap-2"><h2 className="font-bold">Sin precio todavía</h2>
          <p className="text-sm text-muted-foreground">No los encontramos en los súper que tienes cerca. Búscalos en el mercado o la tiendita.</p>
          <div className="flex flex-wrap gap-2">{l.sin_precio.map((i) => <Badge key={i.ingrediente} variant="intermedio">{i.ingrediente} · {cantidad(i.falta, i.unidad)}</Badge>)}</div></section>
      )}
      <p className="text-xs text-muted-foreground">Algunos links de compra son de afiliado: si compras ahí, Foráneo en apuros gana una pequeña comisión y a ti no te cuesta más.</p>
      {marcados.size > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(5.9rem+env(safe-area-inset-bottom))] z-30 px-4 sm:bottom-6">
          <Button size="lg" onClick={pasarAlacena} disabled={pasando} className="entrar-pantalla mx-auto flex w-full max-w-md shadow-lg">
            <Jar weight="fill" />{pasando ? "Pasando…" : `Ya lo compré: pasar ${marcados.size} a mi alacena`}
          </Button>
        </div>
      )}
    </div>
  );
}

