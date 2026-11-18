/* Rutas con # para que el HTML funcione abriéndolo directo del disco (file://).
   La ruta vive en memoria: así también funciona dentro de vistas previas (iframes con srcdoc) donde
   el navegador no deja tocar el historial. */
import * as React from "react";

const normal = (h: string) => { const p = (h.replace(/^#/, "") || "/").split("?")[0]; return p.endsWith("/") ? p : p + "/"; };
let leida = "/";
try { leida = location.hash; } catch { /* nada */ }
let actual = normal(leida);
let consulta = leida.split("?")[1] || "";

const oyentes = new Set<() => void>();
const avisar = () => { oyentes.forEach((f) => f()); try { window.scrollTo(0, 0); } catch { /* nada */ } };
try {
  window.addEventListener("hashchange", () => {
    const h = location.hash; const r = normal(h);
    if (r === actual && (h.split("?")[1] || "") === consulta) return;
    actual = r; consulta = h.split("?")[1] || ""; avisar();
  });
} catch { /* nada */ }

export function rutaActual() { return actual; }
export function consultaActual() { return consulta; }
export function ir(href: string, reemplazar = false) {
  actual = normal(href); consulta = href.split("?")[1] || "";
  try {
    if (reemplazar) history.replaceState(null, "", "#" + href);
    else history.pushState(null, "", "#" + href);
  } catch { /* vista previa sin historial: la ruta sigue en memoria */ }
  avisar();
}
export function useRuta() {
  return React.useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f); }; }, rutaActual, rutaActual);
}
