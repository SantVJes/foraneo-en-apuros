/* Lo que gastas en el súper, para decirte cuánto llevas este mes y cuánto te ahorraste contra comer fuera.
   Se guarda en este dispositivo (cada vez que tocas "Ya lo compré" en la lista). */

const CLAVE = "fa_gastos";
/** Cuánto cuesta en promedio una comida fuera (fonda o comida corrida). Es una estimación. */
export const COMIDA_FUERA = 90;

export type Compra = { plan: number; fecha: string; monto: number; comidas: number; total?: number };

export function leerCompras(): Compra[] {
  try { return JSON.parse(localStorage.getItem(CLAVE) || "[]"); } catch { return []; }
}

/** Suma una compra a la semana `plan`. Las comidas de esa semana se cuentan una sola vez.
    `total` es lo que cuesta toda la lista: si solo compraste la mitad, solo cuenta la mitad de las comidas. */
export function anotarCompra(plan: number, monto: number, comidas: number, total: number) {
  const todas = leerCompras();
  const hoy = new Date().toISOString().slice(0, 10);
  const ya = todas.find((c) => c.plan === plan);
  // El total de la primera vez es el de la lista completa; las siguientes compras ya no lo cambian.
  if (ya) { ya.monto += monto; ya.comidas = comidas; ya.total = Math.max(ya.total || 0, ya.monto); ya.fecha = hoy; } else todas.push({ plan, fecha: hoy, monto, comidas, total: Math.max(total, monto) });
  try { localStorage.setItem(CLAVE, JSON.stringify(todas)); } catch { /* sin almacenamiento */ }
}

export function resumenDelMes(ahora = new Date()) {
  const mes = ahora.toISOString().slice(0, 7);
  const delMes = leerCompras().filter((c) => c.fecha.startsWith(mes));
  const gastado = delMes.reduce((s, c) => s + c.monto, 0);
  // Comidas que ya tienes cubiertas con lo que compraste (proporcional a cuánto de la lista llevas).
  const comidas = Math.round(delMes.reduce((s, c) => s + c.comidas * (c.total ? Math.min(1, c.monto / c.total) : 1), 0));
  return { gastado, comidas, fuera: comidas * COMIDA_FUERA, ahorro: Math.max(0, comidas * COMIDA_FUERA - gastado), compras: delMes.length };
}
