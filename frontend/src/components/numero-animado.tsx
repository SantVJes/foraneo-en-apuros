"use client";

import * as React from "react";

/** Muestra un número que "corre" hasta su nuevo valor y da un brinquito cuando cambia. */
export function NumeroAnimado({ valor, formato = (n) => String(Math.round(n)), duracion = 600, className }: {
  valor: number; formato?: (n: number) => string; duracion?: number; className?: string;
}) {
  const [mostrado, setMostrado] = React.useState(valor);
  const [brinca, setBrinca] = React.useState(0);
  const anterior = React.useRef(valor);

  React.useEffect(() => {
    const desde = anterior.current;
    anterior.current = valor;
    if (desde === valor) return;
    const quieto = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto) { setMostrado(valor); return; }
    setBrinca((b) => b + 1);
    const inicio = performance.now();
    let cuadro = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      const suave = 1 - Math.pow(1 - p, 3);
      setMostrado(desde + (valor - desde) * suave);
      if (p < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, duracion]);

  return <span key={brinca} className={brinca ? `brinco ${className ?? ""}` : className}>{formato(mostrado)}</span>;
}
