/* Preferencias de este dispositivo: cómo leer (dislexia, letra clara, grande), color de la app y tema. */
export type Letra = "normal" | "dislexia" | "clara";
export type Color = "nopal" | "jamaica" | "talavera" | "cempasuchil" | "uva" | "agave";
export type Tema = "auto" | "claro" | "oscuro";
export type Oscuro = "pizarra" | "negro" | "gris";
export type Esquinas = "redondas" | "rectas";
export type Tinta = "normal" | "crema" | "menta" | "lila";
export type Lectura = { letra: Letra; grande: boolean; color: Color; tema: Tema; oscuro: Oscuro; esquinas: Esquinas; tinta: Tinta; movimiento: boolean; v?: number };

const CLAVE = "fa_lectura";
const VERSION = 2; // v2: el oscuro pasó a ser el tema por defecto
const BASE: Lectura = { letra: "normal", grande: false, color: "nopal", tema: "oscuro", oscuro: "pizarra", esquinas: "redondas", tinta: "normal", movimiento: true, v: VERSION };
const FUENTES: Record<Exclude<Letra, "normal">, string> = {
  dislexia: "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap",
  clara: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap",
};

export function leerLectura(): Lectura {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || "{}");
    // Quien guardó antes de v2 tenía "Como mi teléfono" por defecto sin haberlo elegido: pasa a oscuro.
    if ((guardado.v ?? 1) < VERSION) guardado.tema = "oscuro";
    return { ...BASE, ...guardado, v: VERSION };
  }
  catch { return { ...BASE }; }
}

const oscuro = (t: Tema) => t === "oscuro" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);

export function aplicarLectura(l: Lectura) {
  const html = document.documentElement;
  if (l.letra !== "normal" && !document.querySelector(`link[data-letra="${l.letra}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = FUENTES[l.letra]; link.dataset.letra = l.letra;
    document.head.appendChild(link);
  }
  html.dataset.letra = l.letra;
  html.dataset.grande = l.grande ? "1" : "0";
  html.dataset.color = l.color;
  html.dataset.oscuro = l.oscuro;
  html.dataset.esquinas = l.esquinas;
  html.dataset.tinta = l.tinta;
  html.dataset.movimiento = l.movimiento ? "si" : "no";
  html.classList.toggle("dark", oscuro(l.tema));
}

export function guardarLectura(l: Lectura) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...l, v: VERSION })); } catch { /* sin almacenamiento */ }
  aplicarLectura(l);
}

/** Script que corre antes de pintar, para que no parpadeen la letra, el color ni el tema. */
export const SCRIPT_LECTURA = `try{var l=JSON.parse(localStorage.getItem('${CLAVE}')||'{}'),d=document.documentElement;var f={dislexia:'${FUENTES.dislexia}',clara:'${FUENTES.clara}'};if(f[l.letra]){var k=document.createElement('link');k.rel='stylesheet';k.href=f[l.letra];k.dataset.letra=l.letra;document.head.appendChild(k);d.dataset.letra=l.letra}if(l.grande)d.dataset.grande='1';if(l.color)d.dataset.color=l.color;if((l.v||1)<${VERSION})l.tema='oscuro';d.dataset.oscuro=l.oscuro||'pizarra';d.dataset.esquinas=l.esquinas||'redondas';d.dataset.tinta=l.tinta||'normal';d.dataset.movimiento=l.movimiento===false?'no':'si';var t=l.tema||'oscuro';d.classList.toggle('dark',t==='oscuro'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches))}catch(e){}`;

export const OPCIONES_LETRA: { v: Letra; t: string; d: string }[] = [
  { v: "normal", t: "Normal", d: "La letra de siempre" },
  { v: "dislexia", t: "Para dislexia", d: "Letra Lexend con más espacio entre letras y renglones" },
  { v: "clara", t: "Letra muy clara", d: "Atkinson Hyperlegible: no se confunden la I, la l y el 1" },
];

export const COLORES: { v: Color; t: string; muestra: string }[] = [
  { v: "nopal", t: "Nopal", muestra: "#1b7d44" },
  { v: "jamaica", t: "Jamaica", muestra: "#b0245a" },
  { v: "talavera", t: "Talavera", muestra: "#1f5fae" },
  { v: "cempasuchil", t: "Cempasúchil", muestra: "#b04a00" },
  { v: "uva", t: "Uva", muestra: "#6a3fc0" },
  { v: "agave", t: "Agave", muestra: "#0f7473" },
];

export const TEMAS: { v: Tema; t: string }[] = [
  { v: "oscuro", t: "Oscuro" }, { v: "claro", t: "Claro" }, { v: "auto", t: "Como mi teléfono" },
];

export const OSCUROS: { v: Oscuro; t: string; fondo: string; tarjeta: string }[] = [
  { v: "pizarra", t: "Pizarra", fondo: "#131f24", tarjeta: "#1b2b32" },
  { v: "negro", t: "Negro", fondo: "#000000", tarjeta: "#1c1c1e" },
  { v: "gris", t: "Gris", fondo: "#121212", tarjeta: "#1e1e1e" },
];

/** Color de las letras. Cada uno tiene su versión para claro y para oscuro. */
export const TINTAS: { v: Tinta; t: string; claro: string; oscuro: string }[] = [
  { v: "normal", t: "Normal", claro: "#16201a", oscuro: "#f1f7fb" },
  { v: "crema", t: "Crema", claro: "#3d2b17", oscuro: "#f6ead2" },
  { v: "menta", t: "Menta", claro: "#0f3d27", oscuro: "#d3f5e2" },
  { v: "lila", t: "Lila", claro: "#2c1f5c", oscuro: "#e4dcfd" },
];
