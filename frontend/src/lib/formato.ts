export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const TIPOS: Record<string, string> = { desayuno: "Desayuno", comida: "Comida", cena: "Cena" };
export const DIF: Record<string, string> = { facil: "Fácil", intermedio: "Intermedio", complicado: "Complicado" };

export const dinero = (n: number | string) =>
  "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function cantidad(n: number | string, unidad: string) {
  const v = Number(n);
  if (unidad === "g" && v >= 1000) return (v / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " kg";
  if (unidad === "ml" && v >= 1000) return (v / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " L";
  const u = unidad === "pieza" ? (v === 1 ? " pieza" : " piezas") : " " + unidad;
  return v.toLocaleString("es-MX", { maximumFractionDigits: 1 }) + u;
}

export const fechaLarga = (f: string) =>
  new Date(f + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "long" });
