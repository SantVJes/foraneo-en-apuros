"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, CalendarCheck, CaretRight, Heartbeat, Crosshair as LocateFixed, ForkKnife, Leaf, MagnifyingGlass as Search, Palette, SignOut as LogOut, Storefront, Trash as Trash2, User, UsersThree, Wallet, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Cabeza, Cargando, Etiqueta } from "@/components/app-shell";
import { ElegirEstilo, ElegirLectura } from "@/components/elegir-lectura";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckboxChip } from "@/components/ui/checkbox-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { cerrarSesion } from "@/lib/auth-store";
import { useDatos } from "@/lib/datos";
import { DIAS, TIPOS } from "@/lib/formato";
import { Rutina } from "@/components/rutina";
import type { Ingrediente, Usuario } from "@/lib/tipos";
import { cn } from "@/lib/utils";

type Cercano = { id: number; nombre: string; color: string; cerca: boolean; distancia_km: number | null; requiere_membresia: boolean; tienes_membresia: boolean; sucursal: { nombre: string } | null };
type Lugar = { nombre: string; lat: number; lng: number };

export default function Yo() {
  const router = useRouter();
  const { usuario, opciones, supers, setUsuario, ingredientes: cargarIng } = useDatos();
  const u = usuario!;
  const [ingredientes, setIngredientes] = React.useState<Ingrediente[] | null>(null);
  const [nuevo, setNuevo] = React.useState(false);
  const [modo, setModo] = React.useState(u.modo_compra);
  const [ubic, setUbic] = React.useState({ lat: u.lat, lng: u.lng, texto: u.lat != null ? "Ubicación guardada." : "Todavía no tenemos tu ubicación." });
  const [radio, setRadio] = React.useState(Number(u.radio_km));
  const [cercanos, setCercanos] = React.useState<{ radio_km: number; mapa_consultado: boolean; supermercados: Cercano[] } | null>(null);
  const [buscando, setBuscando] = React.useState(false);
  const [lugares, setLugares] = React.useState<Lugar[]>([]);
  const [excluidos, setExcluidos] = React.useState<number[]>(u.ingredientes_excluidos);
  const [excluir, setExcluir] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [rutina, setRutina] = React.useState<Record<string, string[]>>(() =>
    Object.fromEntries(DIAS.map((_, d) => [String(d), u.rutina_comidas?.[String(d)] ?? Object.keys(TIPOS)])));
  const [borrarCuenta, setBorrarCuenta] = React.useState(false);
  const [pestana, setPestana] = React.useState("tu");
  // /yo/?tab=rutina abre directo esa sección (lo usa "Termina tu perfil").
  React.useEffect(() => {
    const t = new URLSearchParams(location.search || location.hash.split("?")[1] || "").get("tab");
    if (t && ["tu", "super", "comida", "rutina", "estilo"].includes(t)) {
      setPestana(t);
      // Te lleva directo a esa sección (si no, quedaba abajo del perfil y había que buscarla).
      setTimeout(() => {
        document.getElementById(`tab-${t}`)?.scrollIntoView({ block: "nearest", inline: "center" });
        document.getElementById(`panel-${t}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, []);
  React.useEffect(() => { if (pestana === "estilo") try { localStorage.setItem("fa_estilo_visto", "1"); } catch { /* nada */ } }, [pestana]);
  // El botón de guardar solo aparece cuando cambiaste algo.
  const [sucio, setSucio] = React.useState(false);

  React.useEffect(() => { cargarIng().then(setIngredientes); setNuevo(location.search.includes("nuevo")); }, [cargarIng]);

  React.useEffect(() => {
    if (ubic.lat == null || ubic.lng == null) return setCercanos(null);
    const t = setTimeout(() => {
      api<typeof cercanos>(`/supermercados/cercanos/?lat=${ubic.lat}&lng=${ubic.lng}&radio_km=${radio}`).then(setCercanos).catch(() => setCercanos(null));
    }, 500);
    return () => clearTimeout(t);
  }, [ubic.lat, ubic.lng, radio]);

  const cambio = (orig: string) => u.sustituciones.find((s) => s.original === orig)?.reemplazo || "";
  const porNombre = (n: string) => ingredientes?.find((i) => i.nombre === n);
  const poner = (lat: number, lng: number, texto: string) => setUbic({ lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, texto });

  function usarGps() {
    if (!navigator.geolocation) return toast("Tu navegador no comparte ubicación. Escribe tu colonia.");
    toast("Pidiendo tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (p) => poner(p.coords.latitude, p.coords.longitude, "Usando tu ubicación actual. Dale a Guardar."),
      () => toast("No nos dejaste ver tu ubicación. Escribe tu colonia y ciudad."),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  }
  async function buscarLugar(q: string) {
    if (q.trim().length < 3) return toast("Escribe al menos 3 letras.");
    setBuscando(true);
    try { const r = await api<Lugar[]>(`/ubicacion/buscar/?q=${encodeURIComponent(q)}`); setLugares(r); if (!r.length) toast("No encontramos esa dirección."); }
    catch (e) { toast((e as Error).message); } finally { setBuscando(false); }
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cambios: { original_id: number; reemplazo_id: number }[] = [];
    const aceite = porNombre("Aceite"), oliva = porNombre("Aceite de oliva"), leche = porNombre("Leche");
    if (f.get("oliva") && aceite && oliva) cambios.push({ original_id: aceite.id, reemplazo_id: oliva.id });
    const otraLeche = porNombre(String(f.get("leche") || ""));
    if (otraLeche && leche) cambios.push({ original_id: leche.id, reemplazo_id: otraLeche.id });
    setGuardando(true);
    try {
      setUsuario(await api<Usuario>("/auth/yo/", { method: "PATCH", body: {
        first_name: String(f.get("nombre") || ""),
        presupuesto_semanal: String(f.get("presupuesto") || "0"), personas: Number(f.get("personas")) || 1,
        modo_compra: modo, radio_km: String(radio), lat: ubic.lat, lng: ubic.lng,
        membresias: f.getAll("membresia").map(Number), restricciones: f.getAll("restr").map(String),
        ingredientes_excluidos: excluidos, cambios, rutina_comidas: rutina,
      } }));
      if (nuevo) { toast("Guardado. Ahora arma tu semana."); router.push("/semana/"); }
      else toast("Guardado.");
      setSucio(false);
    } catch (err) { toast((err as Error).message); } finally { setGuardando(false); }
  }

  if (!ingredientes || !opciones) return <Cargando texto="Cargando tu perfil…" />;
  const membresia = supers.filter((s) => s.requiere_membresia);

  const restr = u.restricciones.map((r) => opciones.restricciones.find((o) => o.valor === r)?.nombre || r);
  const enCasa = Object.values(rutina).reduce((n, v) => n + v.length, 0);
  const resumen: [string, string, typeof Wallet][] = [
    ["Presupuesto", `$${Math.round(Number(u.presupuesto_semanal)).toLocaleString("es-MX")}`, Wallet],
    ["Cocinas para", `${u.personas} ${u.personas === 1 ? "persona" : "personas"}`, UsersThree],
    ["En casa", `${enCasa} comidas`, CalendarCheck],
    ["Dieta", restr.length ? restr.slice(0, 2).join(", ") + (restr.length > 2 ? "…" : "") : "De todo", Leaf],
  ];
  return (
    <div className="pagina grid grid-cols-1 gap-5">
      <Cabeza etiqueta={nuevo ? "Cuéntanos de ti" : "Tu perfil"} titulo="Yo" />

      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-4 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--primary)_18%,transparent),color-mix(in_srgb,var(--mango)_28%,transparent))] p-5 dark:bg-[linear-gradient(120deg,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_75%)]">
          <span aria-hidden className="grid size-16 shrink-0 -rotate-6 place-items-center rounded-2xl bg-mango font-display text-3xl font-extrabold text-mango-foreground shadow-[inset_0_0_0_2px_var(--foreground)]">
            {(u.first_name || u.email).slice(0, 1).toUpperCase()}
          </span>
          <div className="grid min-w-0">
            <span className="truncate text-xl font-extrabold">{u.first_name || "Sin nombre"}</span>
            <span className="truncate text-sm text-muted-foreground">{u.email}</span>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-4">
          {resumen.map(([t, v, Icono]) => (
            <div key={t} className="grid gap-0.5 bg-card px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground"><Icono className="size-4 text-primary" weight="duotone" aria-hidden />{t}</dt>
              <dd className="truncate font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {!nuevo && (
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["/meta/", "Tu meta de salud", "Calorías, peso y cómo repartes la semana", Heartbeat],
            ["/recetas/", "Tus recetas", "Las que escribiste y las que guardaste", BookOpenText],
          ] as const).map(([href, t, d, I]) => (
            <Link key={href} href={href} className="group flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-texto"><I className="size-6" weight="duotone" aria-hidden /></span>
              <span className="grid min-w-0 flex-1 gap-0.5"><span className="font-semibold">{t}</span><span className="text-sm text-muted-foreground">{d}</span></span>
              <CaretRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      )}

      <div role="tablist" aria-label="Secciones de tu perfil" className="sticky top-[calc(4.1rem+env(safe-area-inset-top))] z-20 -mx-4 flex gap-1.5 overflow-x-auto bg-background px-4 py-2 [scrollbar-width:none]">
        {PESTANAS.map(({ v, t, I }) => (
          <button key={v} type="button" role="tab" id={`tab-${v}`} aria-selected={pestana === v} aria-controls={`panel-${v}`} onClick={() => setPestana(v)}
            className={cn("flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-semibold transition-all duration-200",
              pestana === v ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground")}>
            <I className={cn("size-[1.15rem]", pestana === v && "icono-rebote")} weight="duotone" aria-hidden />{t}
          </button>
        ))}
      </div>

      <form onSubmit={guardar} className="grid grid-cols-1 gap-5 pb-20 sm:pb-0" onChange={(e) => { if (!(e.target as HTMLElement).closest("[data-sin-guardar]")) setSucio(true); }}
        onClickCapture={(e) => { const b = (e.target as HTMLElement).closest("button,label"); if (b && (b as HTMLButtonElement).type !== "submit" && !b.closest("[data-sin-guardar]")) setSucio(true); }}>
        <Panel v="tu" actual={pestana}>
          <Card className="gap-3">
            <h2 className="text-2xl font-bold">Tu dinero</h2>
            <Campo id="nombre" label="¿Cómo te llamas?"><Input id="nombre" name="nombre" defaultValue={u.first_name} autoComplete="given-name" /></Campo>
            <Campo id="presupuesto" label="Presupuesto por semana (MXN)"><Input id="presupuesto" name="presupuesto" type="number" min={0} step={50} inputMode="decimal" defaultValue={u.presupuesto_semanal} /></Campo>
            <Campo id="personas" label="¿Para cuántas personas cocinas?"><Input id="personas" name="personas" type="number" min={1} max={12} inputMode="numeric" defaultValue={u.personas} /></Campo>
          </Card>

          <Card className="gap-3">
            <h2 className="text-2xl font-bold">Tu cuenta</h2>
            <div data-sin-guardar className="flex flex-wrap gap-3">
          <Button size="lg" type="button" variant="outline" onClick={async () => { await cerrarSesion(); router.replace("/"); }}><LogOut />Cerrar sesión</Button>
          <Button size="lg" type="button" variant="ghost" className="text-destructive" onClick={async () => {
            if (!borrarCuenta) return setBorrarCuenta(true);
            try { await api("/auth/yo/", { method: "DELETE" }); await cerrarSesion(); toast("Borramos tu cuenta y todos tus datos."); router.replace("/"); }
            catch (err) { toast((err as Error).message); }
          }}><Trash2 />{borrarCuenta ? "¿Seguro? Se borra todo. Toca otra vez" : "Borrar mi cuenta"}</Button>
            </div>
          </Card>
        </Panel>

        <Panel v="super" actual={pestana}>
          <Card className="gap-3">
            <h2 className="text-2xl font-bold">Cómo compras</h2>
            <Etiqueta className="mt-2">¿Cómo prefieres comprar?</Etiqueta>
            <ToggleGroup type="single" value={modo} onValueChange={(v) => v && setModo(v as typeof modo)} aria-label="Cómo prefieres comprar">
              <ToggleGroupItem value="varios">Lo más barato en varios</ToggleGroupItem>
              <ToggleGroupItem value="un_super">Todo en un súper</ToggleGroupItem>
            </ToggleGroup>
            {membresia.length > 0 && (
              <>
                <Etiqueta className="mt-2">¿Tienes membresía?</Etiqueta>
                <div className="flex flex-wrap gap-2">{membresia.map((s) => <CheckboxChip key={s.id} type="checkbox" name="membresia" value={s.id} defaultChecked={u.membresias.includes(s.id)}>{s.nombre}</CheckboxChip>)}</div>
                <p className="text-sm text-muted-foreground">Si no tienes, no te mandamos a comprar ahí.</p>
              </>
            )}
          </Card>
          <Card className="gap-3">
            <h2 className="text-2xl font-bold">¿Dónde estás?</h2>
            <p className="text-sm text-muted-foreground">{ubic.texto}</p>
            <div><Button type="button" variant="secondary" onClick={usarGps}><LocateFixed />Usar mi ubicación</Button></div>
            <div className="flex gap-2">
              <Input id="buscar" type="search" placeholder="O escribe tu colonia y ciudad" aria-label="Buscar colonia o ciudad"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarLugar(e.currentTarget.value); } }} />
              <Button type="button" variant="outline" disabled={buscando} onClick={() => buscarLugar((document.getElementById("buscar") as HTMLInputElement).value)}><Search />Buscar</Button>
            </div>
            {lugares.length > 0 && (
              <div className="grid max-h-52 gap-1.5 overflow-auto">
                {lugares.map((r) => (
                  <button key={r.nombre} type="button" className="min-h-11 rounded-lg border bg-card p-2.5 text-left text-sm hover:border-primary"
                    onClick={() => { setLugares([]); poner(r.lat, r.lng, r.nombre.split(",").slice(0, 3).join(",")); }}>{r.nombre}</button>
                ))}
              </div>
            )}
            <div className="grid gap-1">
              <div className="flex items-center justify-between"><Etiqueta>Buscar súper a la redonda</Etiqueta><output className="font-mono text-sm">{radio} km</output></div>
              <Slider min={1} max={30} step={0.5} value={[radio]} onValueChange={([v]) => setRadio(v)} />
            </div>
            {cercanos && (
              <div className="grid gap-1.5">
                <Etiqueta>{cercanos.supermercados.some((s) => s.cerca) ? `${cercanos.supermercados.filter((s) => s.cerca).length} cadenas a menos de ${cercanos.radio_km} km` : `Ningún súper a menos de ${cercanos.radio_km} km`}</Etiqueta>
                {!cercanos.mapa_consultado && <p className="text-xs text-muted-foreground">No pudimos consultar el mapa ahora; mostramos las sucursales que ya conocemos.</p>}
                {cercanos.supermercados.map((s) => (
                  <div key={s.id} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5", !s.cerca && "opacity-50")}>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="grid min-w-0 flex-1"><b className="text-sm">{s.nombre}</b>{s.sucursal && <span className="truncate text-xs text-muted-foreground">{s.sucursal.nombre}</span>}</span>
                    <span className="font-mono text-xs">{s.cerca ? `${s.distancia_km} km` : "lejos"}{s.requiere_membresia && !s.tienes_membresia ? " · sin membresía" : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Panel>

        <Panel v="comida" actual={pestana}>
        <Card className="gap-3">
          <h2 className="text-2xl font-bold">Dieta y alergias</h2>
          <p className="text-sm text-muted-foreground">Marca lo que no comes y no te lo sugerimos.</p>
          <div className="flex flex-wrap gap-2">
            {opciones.restricciones.map((r) => <CheckboxChip key={r.valor} tono="alerta" type="checkbox" name="restr" value={r.valor} defaultChecked={u.restricciones.includes(r.valor)}>{r.nombre}</CheckboxChip>)}
          </div>
        </Card>

          <Card className="gap-3">
            <h2 className="text-2xl font-bold">Lo que no te gusta</h2>
            <div className="flex gap-2">
              <Input list="lista-excluir" value={excluir} onChange={(e) => setExcluir(e.target.value)} placeholder="Cebolla, champiñones…" aria-label="Ingrediente que no comes" autoComplete="off" />
              <Button type="button" variant="outline" onClick={() => {
                const ing = ingredientes.find((i) => i.nombre.toLowerCase() === excluir.trim().toLowerCase());
                if (!ing) return toast("Elige un ingrediente de la lista.");
                setExcluidos((x) => [...new Set([...x, ing.id])]); setExcluir("");
              }}>Agregar</Button>
            </div>
            <datalist id="lista-excluir">{ingredientes.map((i) => <option key={i.id} value={i.nombre} />)}</datalist>
            <div className="flex flex-wrap gap-2">
              {excluidos.length ? excluidos.map((id) => {
                const ing = ingredientes.find((i) => i.id === id);
                return ing && <Button key={id} type="button" size="sm" variant="secondary" onClick={() => setExcluidos((x) => x.filter((v) => v !== id))} aria-label={`Quitar ${ing.nombre}`}>{ing.nombre}<X /></Button>;
              }) : <span className="text-sm text-muted-foreground">Nada por ahora.</span>}
            </div>
          </Card>
          <Card className="gap-3">
            <h2 className="text-2xl font-bold">Tus cambios</h2>
            <p className="text-sm text-muted-foreground">Cambiamos el ingrediente en todas las recetas y en tu lista.</p>
            <div><CheckboxChip type="checkbox" name="oliva" value="1" defaultChecked={cambio("Aceite") === "Aceite de oliva"}>Cocino con aceite de oliva</CheckboxChip></div>
            <Etiqueta className="mt-1">Leche</Etiqueta>
            <div className="flex flex-wrap gap-2">
              {[["", "Normal"], ["Leche deslactosada", "Deslactosada"], ["Leche de almendra", "De almendra"]].map(([v, n]) => (
                <CheckboxChip key={n} type="radio" name="leche" value={v} defaultChecked={cambio("Leche") === v}>{n}</CheckboxChip>
              ))}
            </div>
          </Card>
                </Panel>

        <Panel v="rutina" actual={pestana}>
          <Rutina rutina={rutina} setRutina={setRutina} />
        </Panel>

        <Panel v="estilo" actual={pestana}>
        <Card data-sin-guardar className="gap-3 md:col-span-2">
          <h2 className="text-2xl font-bold">Hazla tuya</h2>
          <p className="text-sm text-muted-foreground">Elige el color, el tema y la letra. Se guarda en este teléfono y cambia al momento.</p>
          <ElegirEstilo />
          <h3 className="mt-2 font-semibold">Cómo prefieres leer</h3>
          <ElegirLectura />
        </Card>

        </Panel>

        <div className={cn("fixed inset-x-0 bottom-[calc(5.9rem+env(safe-area-inset-bottom))] z-30 px-4 transition-all duration-300 sm:static sm:px-0",
          sucio || nuevo ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0 sm:hidden")}>
          <Button size="lg" type="submit" disabled={guardando} className="w-full shadow-lg sm:w-fit sm:shadow-none">{guardando ? "Guardando…" : "Guardar cambios"}</Button>
        </div>
      </form>
    </div>
  );
}

const PESTANAS = [
  { v: "tu", t: "Tú", I: User }, { v: "super", t: "Súper", I: Storefront }, { v: "comida", t: "Comida", I: ForkKnife },
  { v: "rutina", t: "Rutina", I: CalendarCheck }, { v: "estilo", t: "Estilo", I: Palette },
];

/** Una pestaña del perfil. Las otras se esconden pero siguen en el formulario, así Guardar manda todo. */
function Panel({ v, actual, children }: { v: string; actual: string; children: React.ReactNode }) {
  return (
    <section role="tabpanel" id={`panel-${v}`} aria-labelledby={`tab-${v}`} hidden={v !== actual} className="entrar-pantalla grid scroll-mt-[8.5rem] items-start gap-5 md:grid-cols-2">
      {children}
    </section>
  );
}

function Campo({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
