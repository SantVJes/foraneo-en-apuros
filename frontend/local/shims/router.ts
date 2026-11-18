/* Rutas con # para que el HTML funcione abriéndolo directo del disco (file://). */
import * as React from "react";

export function rutaActual() {
  const h = location.hash.replace(/^#/, "") || "/";
  const [p] = h.split("?");
  return p.endsWith("/") ? p : p + "/";
}
const oyentes = new Set<() => void>();
window.addEventListener("hashchange", () => { oyentes.forEach((f) => f()); window.scrollTo(0, 0); });
export function ir(href: string, reemplazar = false) {
  const h = "#" + href;
  if (reemplazar) { history.replaceState(null, "", h); oyentes.forEach((f) => f()); window.scrollTo(0, 0); }
  else location.hash = href;
}
export function useRuta() {
  return React.useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f); }; }, rutaActual, rutaActual);
}
